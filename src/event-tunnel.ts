// a11ign/a11ign#5197: THE LAST MILE OF THE EVENT FEED -- the two host steps no unit can take, and the reading that says whether the feed is live.
//
//   node src/event-tunnel.ts up           serve the receiver's loopback port at `events.publicUrl` over Tailscale Funnel (the unit's ExecStart)
//   node src/event-tunnel.ts down         take that one path off Funnel (the unit's ExecStop)
//   node src/event-tunnel.ts register     create the webhook secret file if absent, then set the scheduler App's webhook URL and secret
//   node src/event-tunnel.ts deliveries   print the App's recent deliveries (id, event, action, status), never a payload or a secret
//
// THE UNIT is `host/event-tunnel.service.in` (owned by `host-units.ts`, shipped for `events.tunnel: "tailscale-funnel"`) and runs `up` and `down`; the receiver is `event-receiver.ts`.
// `up` and `down` touch ONE path on port 443 and never `reset` or an unscoped `off`: the node's other serve mounts (the trace pages, tailnet-only on 8443) are not this file's.
//
// THE SECRET is generated once into the file the receiver reads (`events.receiver.secretPath`, mode 600 in a 700 directory) and is NEVER REPLACED by this file: a second `register` that
// rotated it would break every delivery until the App's copy caught up, and the file is the one place both halves read it from. It appears in no output, argument or error here.
//
// REGISTRATION IS `PATCH /app/hook/config` BY THE APP'S OWN JWT (not an installation token): GitHub accepts `url`, `content_type`, `secret` and `insecure_ssl` there and has NO field for
// `active` or for the subscribed events. Those two are the chairman's clicks in the App's settings (the row's step 4c), and this file says so rather than pretending to set them.
//
// A DELIVERY READ answers "is the feed live" from GitHub's side (`GET /app/hook/deliveries`): a `ping` is answered 200 by the receiver and, by design, never queued, so its proof is its
// status here and the receiver's heartbeat, while a `pull_request` is proven by its `deliveryId` in the queue.
import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { GITHUB_API, appJwt } from "./app-token.ts";

const SECRET_BYTES = 32;
const SECRET_FILE_MODE = 0o600;
const SECRET_DIR_MODE = 0o700;
const REQUEST_TIMEOUT_MS = 15_000;
const DELIVERIES_PER_PAGE = 30;
const HTTP_OK = 200;
/** What the App must subscribe to (the row's step 4c): the receiver stores the first eight; `status` and `push` are accepted and ignored (202), so the gate does not read them yet. */
export const SUBSCRIBED_EVENTS = Object.freeze(["Pull request", "Pull request review", "Check run", "Check suite", "Workflow run", "Status", "Issues", "Issue comment", "Merge group", "Push"]);

export type Reply = { status: number, text: () => Promise<string> };
export type Fetch = (url: string, init: { method: string, headers: Record<string, string>, body?: string }) => Promise<Reply>;
export type App = { appId: string, keyPath: string };
export type Delivery = { id: number, guid: string, event: string, action: string | null, status: string, statusCode: number, deliveredAt: string, redelivery: boolean };

/** A failure that names the call and its status, never a body that could echo a secret. */
export class EventTunnelFailure extends Error {
  constructor(why: string, options?: { cause?: unknown }) {
    super(`event-tunnel: ${why}`, options);
    this.name = "EventTunnelFailure";
  }
}

/** The secret file's state after the call: `created` this time, or `kept` because one was already there (and is never read, rewritten or measured). */
export function ensureSecretFile(path: string, { random = () => randomBytes(SECRET_BYTES).toString("hex") }: { random?: () => string } = {}): "created" | "kept" {
  if (existsSync(path)) return "kept";
  mkdirSync(dirname(path), { recursive: true, mode: SECRET_DIR_MODE });
  const scratch = `${path}.${process.pid}.${randomUUID()}`;
  writeFileSync(scratch, `${random()}\n`, { mode: SECRET_FILE_MODE });
  renameSync(scratch, path);
  return "created";
}

type Call = { fetch: Fetch, app: App, privateKey: string, now: number, apiBase?: string };

async function callApp({ fetch, app, privateKey, now, apiBase = GITHUB_API }: Call, request: { method: string, path: string, body?: unknown }): Promise<unknown> {
  const jwt = appJwt({ appId: app.appId, privateKey, now });
  const headers: Record<string, string> = { authorization: `Bearer ${jwt}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" };
  if (request.body !== undefined) headers["content-type"] = "application/json";
  let reply: Reply;
  try {
    reply = await fetch(`${apiBase}${request.path}`, { method: request.method, headers, ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }) });
  } catch (cause) {
    throw new EventTunnelFailure(`${request.method} ${request.path} did not answer`, { cause });
  }
  const text = await reply.text();
  if (reply.status !== HTTP_OK) throw new EventTunnelFailure(`${request.method} ${request.path} answered ${reply.status}`);
  try {
    return JSON.parse(text) as unknown;
  } catch (cause) {
    throw new EventTunnelFailure(`${request.method} ${request.path} answered something that is not JSON`, { cause });
  }
}

/** Sets where GitHub posts and what it signs with. Returns the URL GitHub now holds, which is the one thing worth quoting back (the secret is write-only there too). */
export async function registerWebhook(call: Call, { publicUrl, secret }: { publicUrl: string, secret: string }): Promise<{ url: string }> {
  if (secret === "") throw new EventTunnelFailure("the secret is empty: refusing to set a webhook that signs with nothing");
  const config = await callApp(call, { method: "PATCH", path: "/app/hook/config", body: { url: publicUrl, content_type: "json", secret, insecure_ssl: "0" } }) as { url?: unknown };
  if (config.url !== publicUrl) throw new EventTunnelFailure(`GitHub answered with a webhook URL other than the one set`);
  return { url: publicUrl };
}

const textOrNull = (value: unknown) => (typeof value === "string" && value !== "" ? value : null);

/** The newest deliveries GitHub recorded for the App's webhook: what the log says happened to each, with no payload. */
export async function recentDeliveries(call: Call, { count = DELIVERIES_PER_PAGE }: { count?: number } = {}): Promise<Delivery[]> {
  const list = await callApp(call, { method: "GET", path: `/app/hook/deliveries?per_page=${Math.min(Math.max(1, Math.trunc(count)), 100)}` });
  if (!Array.isArray(list)) throw new EventTunnelFailure("the delivery list is not a list");
  return list.map((entry: Record<string, unknown>) => ({
    id: Number(entry.id), guid: String(entry.guid), event: String(entry.event), action: textOrNull(entry.action), status: String(entry.status),
    statusCode: Number(entry.status_code), deliveredAt: String(entry.delivered_at), redelivery: entry.redelivery === true,
  }));
}

/** One delivery as a line a person can quote: the GUID is `X-GitHub-Delivery`, which is the `deliveryId` the receiver queues. */
export const deliveryLine = (delivery: Delivery) =>
  `${delivery.deliveredAt} ${delivery.guid} ${delivery.event}${delivery.action === null ? "" : `.${delivery.action}`} ${delivery.statusCode} ${delivery.status}${delivery.redelivery ? " (redelivery)" : ""}`;

const FUNNEL_PORT = "443";

/** The `tailscale` arguments that mount (`up`) or remove (`down`) the receiver's path. `--yes` because nobody is at the terminal to answer Funnel's first-time prompt. */
export function funnelArguments({ publicUrl, port }: { publicUrl: string, port: number }): { up: string[], down: string[] } {
  const path = `--set-path=${new URL(publicUrl).pathname}`;
  return {
    up: ["funnel", "--bg", "--yes", `--https=${FUNNEL_PORT}`, path, `http://127.0.0.1:${port}`],
    down: ["funnel", "--yes", `--https=${FUNNEL_PORT}`, path, "off"],
  };
}

type Declared = { app: App, publicUrl: string, secretPath: string };

/** The scheduler App, the public URL and the secret path, from the host's declaration -- or a refusal naming the field that is missing. */
export function declaredTunnel(host: { github?: { identity?: Record<string, unknown> }, events?: { tunnel?: string, publicUrl?: string, receiver?: { secretPath: string, port: number } } }): Declared {
  const scheduler = host.github?.identity?.scheduler as { mode?: string, appId?: string, keyPath?: string } | undefined;
  if (scheduler?.mode !== "github-apps" || !scheduler.appId || !scheduler.keyPath) {
    throw new EventTunnelFailure("`github.identity.scheduler` is not a `github-apps` identity with an appId and keyPath: there is no App to register");
  }
  const { events } = host;
  if (events?.tunnel !== "tailscale-funnel" || events.publicUrl === undefined || events.receiver === undefined) {
    throw new EventTunnelFailure("`events.tunnel` is not `tailscale-funnel` with a `publicUrl` and a `receiver`: nothing is exposed to register");
  }
  return { app: { appId: scheduler.appId, keyPath: scheduler.keyPath }, publicUrl: events.publicUrl, secretPath: events.receiver.secretPath };
}

const realFetch: Fetch = (url, init) => globalThis.fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

/** The two facts the funnel needs, or a refusal naming what is missing. Shares `declaredTunnel`'s reading of `events`. */
export function funnelFacts(host: Parameters<typeof declaredTunnel>[0]): { publicUrl: string, port: number } {
  const { events } = host;
  if (events?.tunnel !== "tailscale-funnel" || events.publicUrl === undefined || events.receiver === undefined) {
    throw new EventTunnelFailure("`events.tunnel` is not `tailscale-funnel` with a `publicUrl` and a `receiver`: nothing is exposed to serve");
  }
  return { publicUrl: events.publicUrl, port: events.receiver.port };
}

const realRun = (args: string[]) => { execFileSync("tailscale", args, { stdio: "inherit", timeout: REQUEST_TIMEOUT_MS * 2 }); };

export async function main(argv: string[], deps: { out?: (line: string) => unknown, fetch?: Fetch, now?: () => number, run?: (args: string[]) => void } = {}): Promise<number> {
  const { out = (line: string) => process.stdout.write(`${line}\n`), fetch = realFetch, now = () => Math.floor(Date.now() / 1000), run = realRun } = deps;
  const [command] = argv;
  if (command !== "register" && command !== "deliveries" && command !== "up" && command !== "down") {
    out("usage: node src/event-tunnel.ts <up|down|register|deliveries>");
    return 2;
  }
  try {
    const { homeHostConfig } = await import("./host-config.ts");
    const host = homeHostConfig() as Parameters<typeof declaredTunnel>[0];
    if (command === "up" || command === "down") {
      const { publicUrl, port } = funnelFacts(host);
      const args = funnelArguments({ publicUrl, port })[command];
      out(`tailscale ${args.join(" ")}`);
      run(args);
      return 0;
    }
    const { app, publicUrl, secretPath } = declaredTunnel(host);
    const call: Call = { fetch, app, privateKey: readFileSync(app.keyPath, "utf8"), now: now() };
    if (command === "deliveries") {
      for (const delivery of await recentDeliveries(call)) out(deliveryLine(delivery));
      return 0;
    }
    out(`secret file ${secretPath}: ${ensureSecretFile(secretPath)}`);
    out(`webhook url set: ${(await registerWebhook(call, { publicUrl, secret: readFileSync(secretPath, "utf8").trim() })).url}`);
    out(`still the chairman's clicks (the API has no field for them): Webhook Active, and subscribe to ${SUBSCRIBED_EVENTS.join(", ")}`);
    return 0;
  } catch (error) {
    out(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) process.exitCode = await main(process.argv.slice(2));
