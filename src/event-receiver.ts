// a11ign/a11ign#5043, agent-org#978: GITHUB'S DELIVERIES, RECEIVED ON THIS HOST AND APPENDED TO A LOCAL QUEUE.
//
//   node src/event-receiver.ts --port <n> --secret-file <abs path> --queue <abs path>
//
// WHAT IT DOES: verifies `X-Hub-Signature-256` over the RAW body, drops a delivery id it has seen, and appends one JSON line per accepted event to the queue. Nothing reads the queue yet and
// merging this starts nothing: `poll` stays the default and today's behaviour.
//
// LOOPBACK (127.0.0.1) ONLY, with no flag to change it: the tunnel is what reaches this process, and an unknown flag (`--host`) is refused, never ignored (the shape of `trace/otel-receiver.ts`).
//
// A DELIVERY THAT CANNOT BE READ IS REFUSED WITH A 4xx AND THE REASON, never accepted and dropped. 401 for a signature that is missing, malformed or wrong (nothing stored and the id NOT marked seen,
// so an attacker cannot burn a real delivery's id), 400 for a missing header or a body that is not JSON, 413 for a body over 1 MiB, refused before it is read in full.
//
// THE SECRET is read from a file at start and appears in no output, log line or error message of this file; an empty or missing file is a refusal to start that names the PATH only.
//
// THE LEDGER (`<queue>.seen`) is appended only AFTER the queue line is written: a crash between the two re-delivers, and the ledger then dedupes the retry. It is bounded to the newest
// 10,000 ids and is read again at each start. THE HEARTBEAT (`<queue>.alive`, an ISO time written by atomic rename at start and every 30 s) is how a reader tells a QUIET queue from a DEAD receiver.
import { createHmac, timingSafeEqual } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { IncomingMessage, Server } from "node:http";
import { dirname, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

export const LOOPBACK = "127.0.0.1";
export const MAX_BODY_BYTES = 1024 * 1024;
export const SEEN_LIMIT = 10_000;
export const HEARTBEAT_MS = 30_000;
/** The event types the gate reads (design item 3). */
export const STORED_EVENTS = Object.freeze(["pull_request", "pull_request_review", "check_suite", "check_run", "workflow_run", "issues", "issue_comment", "merge_group"]);
const HTTP = { ok: 200, accepted: 202, badRequest: 400, unauthorized: 401, methodNotAllowed: 405, tooLarge: 413, failed: 500 };
const SIGNATURE = /^sha256=([0-9a-f]{64})$/i;
const USAGE = "node src/event-receiver.ts --port <n> --secret-file <abs path> --queue <abs path>";

export type QueueLine = { deliveryId: string; event: string; action: string | null; repo: string | null; number: number | null; sha: string | null; receivedAt: string; };
export type Seen = { has(id: string): boolean; add(id: string): void; };
export type Reply = { status: number; body: Record<string, unknown>; log: string | null; };
export type Delivery = { headers: Record<string, string | string[] | undefined>; rawBody: Buffer | string; };
export type Ports = { secret: string; seen: Seen; append: (line: QueueLine) => void; now: () => Date; };

const textOrNull = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);
const numberOrNull = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : null);

function headerOf(headers: Delivery["headers"], name: string): string | null {
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) return textOrNull(Array.isArray(value) ? value[0] : value);
  }
  return null;
}

/** `sha256=<hex>` of the raw body against the header, in constant time; a header that is not exactly that shape is wrong, not an error. */
export function signatureMatches(secret: string, rawBody: Buffer | string, header: string | null): boolean {
  const match = header === null ? null : SIGNATURE.exec(header);
  if (match === null) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(match[1], "hex"));
}

/** The pull request a check or workflow event names first, else `null`. */
const firstPullRequest = (object: any) => numberOrNull(Array.isArray(object?.pull_requests) ? object.pull_requests[0]?.number : null);

/** `number` and `sha` of a payload, by event type: what the event names, `null` where it names nothing. */
function subjectOf(event: string, payload: any): { number: number | null; sha: string | null; } {
  switch (event) {
    case "pull_request":
    case "pull_request_review":
      return { number: numberOrNull(payload.pull_request?.number ?? payload.number), sha: textOrNull(payload.pull_request?.head?.sha) };
    case "issues":
    case "issue_comment":
      return { number: numberOrNull(payload.issue?.number), sha: null };
    case "check_suite":
    case "check_run":
    case "workflow_run": {
      const object = payload[event];
      return { number: firstPullRequest(object), sha: textOrNull(object?.head_sha) };
    }
    default: // merge_group
      return { number: null, sha: textOrNull(payload.merge_group?.head_sha) };
  }
}

/**
 * One delivery, decided: no socket, no clock of its own, no file of its own. Order matters: the signature is checked before anything else is read from the delivery, and a refusal
 * stores nothing and marks nothing seen.
 */
export function receiveDelivery({ headers, rawBody }: Delivery, { secret, seen, append, now }: Ports): Reply {
  const refuse = (status: number, error: string): Reply => ({ status, body: { error }, log: `event-receiver: ${status} ${error}` });
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return refuse(HTTP.tooLarge, `body over ${MAX_BODY_BYTES} bytes`);
  const signature = headerOf(headers, "x-hub-signature-256");
  if (signature === null) return refuse(HTTP.unauthorized, "no X-Hub-Signature-256 header");
  if (!signatureMatches(secret, rawBody, signature)) return refuse(HTTP.unauthorized, "X-Hub-Signature-256 is not sha256=<hex> of this body under the secret");
  const deliveryId = headerOf(headers, "x-github-delivery");
  if (deliveryId === null) return refuse(HTTP.badRequest, "no X-GitHub-Delivery header");
  const event = headerOf(headers, "x-github-event");
  if (event === null) return refuse(HTTP.badRequest, "no X-GitHub-Event header");
  if (event === "ping") return { status: HTTP.ok, body: { pong: true }, log: null };
  if (!STORED_EVENTS.includes(event)) return { status: HTTP.accepted, body: { ignored: event }, log: `event-receiver: ignored ${event} (${deliveryId})` };
  if (seen.has(deliveryId)) return { status: HTTP.accepted, body: { duplicate: deliveryId }, log: null };
  let payload: any;
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch (cause) {
    return refuse(HTTP.badRequest, `body is not JSON: ${cause instanceof Error ? cause.message : String(cause)}`);
  }
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) return refuse(HTTP.badRequest, "body is not a JSON object");
  const line: QueueLine = {
    deliveryId, event, action: textOrNull(payload.action), repo: textOrNull(payload.repository?.full_name), ...subjectOf(event, payload), receivedAt: now().toISOString(),
  };
  append(line);
  seen.add(deliveryId); // AFTER the queue line: a crash between the two re-delivers, and the ledger dedupes the retry
  return { status: HTTP.ok, body: { queued: deliveryId }, log: `event-receiver: queued ${event} ${deliveryId}` };
}

/** The ledger: the newest `limit` ids of the file at `path`, appended to as ids arrive and rewritten whole when it outgrows the bound. */
export function openLedger(path: string, limit = SEEN_LIMIT): Seen {
  const read = () => (existsSync(path) ? readFileSync(path, "utf8").split("\n").filter((id) => id !== "") : []);
  const ids = new Set(read().slice(-limit));
  let lines = ids.size;
  return {
    has: (id) => ids.has(id),
    add(id) {
      if (ids.has(id)) return;
      ids.add(id);
      if (ids.size > limit) ids.delete(ids.values().next().value as string);
      if (lines < limit * 2) {
        mkdirSync(dirname(path), { recursive: true });
        appendFileSync(path, `${id}\n`);
        lines += 1;
        return;
      }
      writeAtomically(path, `${[...ids].join("\n")}\n`);
      lines = ids.size;
    },
  };
}

function writeAtomically(path: string, text: string) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, text);
  renameSync(temporary, path);
}

/** Reads the body up to the bound; the declared length is refused before a byte is read, and a body that lies about it is cut off when it passes the bound. */
async function bodyOf(request: IncomingMessage): Promise<Buffer | null> {
  if (Number(request.headers["content-length"] ?? 0) > MAX_BODY_BYTES) return null;
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) return null;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export type ServeOptions = {
  port: number; secretFile: string; queue: string;
  log?: (line: string) => void; now?: () => Date;
  /** The heartbeat's timer, injectable so a test needs no 30 seconds. Returns what stops it. */
  every?: (run: () => void, ms: number) => () => void;
};

/**
 * Starts the receiver on 127.0.0.1. The secret is read FIRST: a start that refuses has written no heartbeat and bound no port.
 * @throws {Error} naming the secret file's path when it is missing or empty
 */
export async function serve(options: ServeOptions): Promise<{ server: Server; port: number; stop: () => Promise<void>; }> {
  const { port, secretFile, queue, log = (line) => process.stderr.write(`${line}\n`), now = () => new Date() } = options;
  const every = options.every ?? ((run, ms) => {
    const timer = setInterval(run, ms);
    timer.unref();
    return () => clearInterval(timer);
  });
  const secret = existsSync(secretFile) ? readFileSync(secretFile, "utf8").trim() : "";
  if (secret === "") throw new Error(`secret file ${secretFile} is missing or empty: refusing to start`);
  const seen = openLedger(`${queue}.seen`);
  const append = (line: QueueLine) => {
    mkdirSync(dirname(queue), { recursive: true });
    appendFileSync(queue, `${JSON.stringify(line)}\n`);
  };
  const beat = () => writeAtomically(`${queue}.alive`, `${now().toISOString()}\n`);
  const server = createServer(async (request, response) => {
    const reply = ({ status, body, log: line }: Reply) => {
      if (line !== null) log(line);
      response.writeHead(status, { "content-type": "application/json", connection: "close" }).end(JSON.stringify(body));
    };
    try {
      if (request.method !== "POST") return reply({ status: HTTP.methodNotAllowed, body: { error: "POST only" }, log: null });
      const rawBody = await bodyOf(request);
      if (rawBody === null) return reply({ status: HTTP.tooLarge, body: { error: `body over ${MAX_BODY_BYTES} bytes` }, log: `event-receiver: 413 body over ${MAX_BODY_BYTES} bytes` });
      reply(receiveDelivery({ headers: request.headers, rawBody }, { secret, seen, append, now }));
    } catch (error) {
      // the message of a failed write names a path, never the secret, which is in no value this block touches
      reply({ status: HTTP.failed, body: { error: "receiver failed" }, log: `event-receiver: 500 ${error instanceof Error ? error.message : String(error)}` });
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK, resolve);
  });
  beat();
  const stopBeating = every(beat, HEARTBEAT_MS);
  const address = server.address();
  return {
    server, port: typeof address === "object" && address !== null ? address.port : port,
    stop: () => new Promise<void>((resolve) => { stopBeating(); server.close(() => resolve()); server.closeAllConnections(); }),
  };
}

/** `--flag value` or `--flag=value` for exactly `--port`, `--secret-file` and `--queue`; there is deliberately no `--host`. */
export function parseArgs(argv: string[]): { port: number; secretFile: string; queue: string; } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const joined = /^--([a-z-]+)=(.*)$/.exec(argv[index]);
    const name = joined?.[1] ?? /^--([a-z-]+)$/.exec(argv[index])?.[1];
    if (name === undefined || !["port", "secret-file", "queue"].includes(name)) throw new Error(`unknown argument ${argv[index]}: ${USAGE}`);
    const value = joined ? joined[2] : argv[index += 1];
    if (value === undefined) throw new Error(`--${name} needs a value: ${USAGE}`);
    values.set(name, value);
  }
  for (const name of ["port", "secret-file", "queue"]) if (!values.has(name)) throw new Error(`--${name} is required: ${USAGE}`);
  const port = Number(values.get("port"));
  if (!/^\d+$/.test(values.get("port")!) || port > 65_535) throw new Error(`--port ${values.get("port")} is not a port`);
  for (const name of ["secret-file", "queue"]) if (!isAbsolute(values.get(name)!)) throw new Error(`--${name} must be an absolute path, got ${values.get(name)}`);
  return { port, secretFile: values.get("secret-file")!, queue: values.get("queue")! };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const started = await serve(options);
    process.stdout.write(`event-receiver: listening on http://${LOOPBACK}:${started.port}, appending to ${options.queue}\n`);
  } catch (error) {
    process.stderr.write(`event-receiver: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
