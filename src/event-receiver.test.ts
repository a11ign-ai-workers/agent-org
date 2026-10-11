// agent-org#978: the event receiver. `receiveDelivery` is a pure function, so most of these need no socket; the last block starts `serve` on a loopback port for the cases only a socket shows
// (the bound address, a body refused before it is read, the heartbeat of a process that refused to start).
//
// POSITIVE CONTROL: the first test sends a correctly signed delivery and requires it queued; every refusal below it is only worth anything because that one is accepted.
// NEGATIVE CONTROL: each refusal test asserts the queue AND the ledger are still empty, and the same body under the right signature is then accepted, so the refusal is the signature's and not the body's.
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { HEARTBEAT_MS, MAX_BODY_BYTES, openLedger, parseArgs, receiveDelivery, serve, SEEN_LIMIT } from "./event-receiver.ts";
import type { QueueLine } from "./event-receiver.ts";

const SECRET = "s3cr3t-DISTINCTIVE-value-0451";
const NOW = new Date("2026-10-11T14:00:00.000Z");
const directories: string[] = [];
const scratch = () => {
  const directory = mkdtempSync(join(tmpdir(), "event-receiver-"));
  directories.push(directory);
  return directory;
};
after(() => { for (const directory of directories) rmSync(directory, { recursive: true, force: true }); });

const sign = (body: string | Buffer, secret = SECRET) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const PULL_REQUEST = JSON.stringify({ action: "opened", number: 7, repository: { full_name: "a11ign/agent-org" }, pull_request: { number: 7, head: { sha: "abc123" } } });

function harness() {
  const queue: QueueLine[] = [];
  const ids = new Set<string>();
  const ports = { secret: SECRET, seen: { has: (id: string) => ids.has(id), add: (id: string) => void ids.add(id) }, append: (line: QueueLine) => void queue.push(line), now: () => NOW };
  return { queue, ids, ports };
}
const delivery = (body: string, over: Record<string, string | undefined> = {}) => ({
  headers: { "x-hub-signature-256": sign(body), "x-github-delivery": "d-1", "x-github-event": "pull_request", ...over },
  rawBody: body,
});

test("POSITIVE CONTROL: a delivery signed with the secret is queued with its fields", () => {
  const { queue, ids, ports } = harness();
  const reply = receiveDelivery(delivery(PULL_REQUEST), ports);
  assert.equal(reply.status, 200);
  assert.deepEqual(queue, [{ deliveryId: "d-1", event: "pull_request", action: "opened", repo: "a11ign/agent-org", number: 7, sha: "abc123", receivedAt: NOW.toISOString() }]);
  assert.ok(ids.has("d-1"));
});

test("NEGATIVE CONTROL: a body altered by one byte, a wrong secret, a missing header and a sha1= header are each 401 and store nothing", () => {
  const cases: [string, ReturnType<typeof delivery>][] = [
    ["one byte altered", { ...delivery(PULL_REQUEST), rawBody: PULL_REQUEST.replace("opened", "opener") }],
    ["wrong secret", delivery(PULL_REQUEST, { "x-hub-signature-256": sign(PULL_REQUEST, "another secret") })],
    ["missing header", delivery(PULL_REQUEST, { "x-hub-signature-256": undefined })],
    ["sha1= header", delivery(PULL_REQUEST, { "x-hub-signature-256": `sha1=${createHmac("sha1", SECRET).update(PULL_REQUEST).digest("hex")}` })],
    ["sha256= of the wrong length", delivery(PULL_REQUEST, { "x-hub-signature-256": "sha256=abcd" })],
  ];
  for (const [name, attempt] of cases) {
    const { queue, ids, ports } = harness();
    assert.equal(receiveDelivery(attempt, ports).status, 401, name);
    assert.deepEqual(queue, [], name);
    assert.equal(ids.size, 0, `${name}: a refused delivery must not mark its id seen`);
    // the unaltered, correctly signed delivery under the same id is then accepted: the id was not burned
    assert.equal(receiveDelivery(delivery(PULL_REQUEST), ports).status, 200, name);
  }
});

test("a replayed delivery id is appended once and answered 202", () => {
  const { queue, ports } = harness();
  assert.equal(receiveDelivery(delivery(PULL_REQUEST), ports).status, 200);
  assert.equal(receiveDelivery(delivery(PULL_REQUEST), ports).status, 202);
  assert.equal(queue.length, 1);
});

test("a missing X-GitHub-Delivery or X-GitHub-Event is 400, and nothing is stored", () => {
  for (const header of ["x-github-delivery", "x-github-event"]) {
    const { queue, ports } = harness();
    assert.equal(receiveDelivery(delivery(PULL_REQUEST, { [header]: undefined }), ports).status, 400, header);
    assert.deepEqual(queue, []);
  }
});

test("a signed body that is not JSON is 400 and the id is not marked seen", () => {
  const { queue, ids, ports } = harness();
  assert.equal(receiveDelivery(delivery("not json"), ports).status, 400);
  assert.deepEqual(queue, []);
  assert.equal(ids.size, 0);
});

test("ping is answered 200 and not stored; an unlisted event type is 202 naming it and not stored", () => {
  const { queue, ports } = harness();
  const ping = receiveDelivery(delivery("{}", { "x-github-event": "ping" }), ports);
  assert.equal(ping.status, 200);
  const star = receiveDelivery(delivery("{}", { "x-github-event": "star", "x-github-delivery": "d-2" }), ports);
  assert.equal(star.status, 202);
  assert.deepEqual(star.body, { ignored: "star" });
  assert.match(star.log ?? "", /ignored star/);
  assert.deepEqual(queue, []);
});

test("every listed event type is stored, with number and sha read from where that event keeps them", () => {
  const repository = { full_name: "a11ign/agent-org" };
  const bodies: Record<string, object> = {
    pull_request_review: { action: "submitted", repository, pull_request: { number: 3, head: { sha: "s1" } } },
    check_suite: { action: "completed", repository, check_suite: { head_sha: "s2", pull_requests: [{ number: 4 }, { number: 5 }] } },
    check_run: { action: "created", repository, check_run: { head_sha: "s3", pull_requests: [] } },
    workflow_run: { action: "completed", repository, workflow_run: { head_sha: "s4", pull_requests: [{ number: 6 }] } },
    issues: { action: "labeled", repository, issue: { number: 9 } },
    issue_comment: { action: "created", repository, issue: { number: 10 } },
    merge_group: { action: "checks_requested", repository, merge_group: { head_sha: "s5" } },
  };
  const expected: Record<string, [number | null, string | null]> = {
    pull_request_review: [3, "s1"], check_suite: [4, "s2"], check_run: [null, "s3"], workflow_run: [6, "s4"], issues: [9, null], issue_comment: [10, null], merge_group: [null, "s5"],
  };
  for (const [event, payload] of Object.entries(bodies)) {
    const { queue, ports } = harness();
    assert.equal(receiveDelivery(delivery(JSON.stringify(payload), { "x-github-event": event }), ports).status, 200, event);
    assert.deepEqual([queue[0].number, queue[0].sha], expected[event], event);
    assert.equal(queue[0].event, event);
  }
});

test("an oversize body is 413, even when it is signed", () => {
  const { queue, ports } = harness();
  const big = "x".repeat(MAX_BODY_BYTES + 1);
  assert.equal(receiveDelivery(delivery(big), ports).status, 413);
  assert.deepEqual(queue, []);
});

test("the secret appears in no reply and no log line, for an accepted and each refused delivery", () => {
  const { ports } = harness();
  const replies = [
    receiveDelivery(delivery(PULL_REQUEST), ports),
    receiveDelivery(delivery(PULL_REQUEST, { "x-hub-signature-256": sign(PULL_REQUEST, "nope") }), ports),
    receiveDelivery(delivery(PULL_REQUEST, { "x-hub-signature-256": undefined }), ports),
    receiveDelivery(delivery("not json", { "x-github-delivery": "d-9" }), ports),
  ];
  assert.ok(replies.length > 3);
  assert.doesNotMatch(JSON.stringify(replies), new RegExp(SECRET));
});

test("the ledger keeps the newest ids up to its bound and is read again at start", () => {
  const path = join(scratch(), "queue.seen");
  const first = openLedger(path, 3);
  for (const id of ["a", "b", "c", "d"]) first.add(id);
  assert.equal(first.has("a"), false, "the oldest is dropped past the bound");
  const second = openLedger(path, 3);
  assert.deepEqual(["b", "c", "d"].map((id) => second.has(id)), [true, true, true]);
  assert.equal(second.has("a"), false);
  assert.equal(SEEN_LIMIT, 10_000);
});

test("parseArgs takes the three flags in both spellings and has no way to name an address", () => {
  const ok = parseArgs(["--port", "8080", "--secret-file=/a/secret", "--queue", "/a/queue"]);
  assert.deepEqual(ok, { port: 8080, secretFile: "/a/secret", queue: "/a/queue" });
  for (const bad of [["--host", "0.0.0.0"], ["--host=0.0.0.0"], ["--address=10.0.0.1"], ["--bind", "::"]]) {
    assert.throws(() => parseArgs([...bad, "--port=1", "--secret-file=/a", "--queue=/b"]), /unknown argument/);
  }
  assert.throws(() => parseArgs(["--port=1", "--secret-file=rel", "--queue=/b"]), /absolute/);
  assert.throws(() => parseArgs(["--port=1", "--queue=/b"]), /--secret-file is required/);
  assert.throws(() => parseArgs(["--port=99999", "--secret-file=/a", "--queue=/b"]), /not a port/);
});

function post(port: number, body: string, headers: Record<string, string>): Promise<{ status: number; text: string; }> {
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, method: "POST", path: "/", headers: { "content-length": String(Buffer.byteLength(body)), ...headers } }, (response) => {
      let text = "";
      response.on("data", (chunk) => (text += chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, text }));
    });
    outgoing.on("error", reject);
    outgoing.end(body);
  });
}

test("serve: binds 127.0.0.1, queues a signed delivery once, refuses a wrong signature and an oversize body", async () => {
  const directory = scratch();
  const secretFile = join(directory, "secret");
  const queue = join(directory, "queue.ndjson");
  writeFileSync(secretFile, `${SECRET}\n`);
  const logs: string[] = [];
  const started = await serve({ port: 0, secretFile, queue, log: (line) => logs.push(line), now: () => NOW, every: () => () => undefined });
  try {
    const address = started.server.address();
    assert.ok(typeof address === "object" && address !== null);
    assert.equal(address.address, "127.0.0.1");
    const headers = { "x-hub-signature-256": sign(PULL_REQUEST), "x-github-delivery": "live-1", "x-github-event": "pull_request" };
    assert.equal((await post(started.port, PULL_REQUEST, headers)).status, 200);
    assert.equal((await post(started.port, PULL_REQUEST, headers)).status, 202);
    assert.equal(readFileSync(queue, "utf8").trim().split("\n").length, 1);
    assert.equal((await post(started.port, PULL_REQUEST, { ...headers, "x-hub-signature-256": sign(PULL_REQUEST, "wrong"), "x-github-delivery": "live-2" })).status, 401);
    assert.equal(readFileSync(queue, "utf8").trim().split("\n").length, 1);
    const huge = "x".repeat(MAX_BODY_BYTES + 10);
    assert.equal((await post(started.port, huge, headers)).status, 413);
    assert.doesNotMatch(logs.join("\n"), new RegExp(SECRET));
  } finally {
    await started.stop();
  }
});

test("heartbeat: written at start, refreshed on the timer by the injected clock; not written by a start that refused", async () => {
  const directory = scratch();
  const secretFile = join(directory, "secret");
  const queue = join(directory, "queue.ndjson");
  const alive = `${queue}.alive`;

  const missing = join(directory, "absent");
  await assert.rejects(serve({ port: 0, secretFile: missing, queue, log: () => undefined }), (error: Error) => error.message.includes(missing) && !error.message.includes(SECRET));
  writeFileSync(secretFile, "\n");
  await assert.rejects(serve({ port: 0, secretFile, queue, log: () => undefined }), /missing or empty/);
  assert.equal(existsSync(alive), false, "a process that refused to start must not look alive");

  writeFileSync(secretFile, SECRET);
  let clock = new Date("2026-10-11T14:00:00.000Z");
  let tick: (() => void) | null = null;
  let interval = 0;
  const started = await serve({ port: 0, secretFile, queue, log: () => undefined, now: () => clock, every: (run, ms) => { tick = run; interval = ms; return () => undefined; } });
  try {
    assert.equal(readFileSync(alive, "utf8").trim(), "2026-10-11T14:00:00.000Z");
    assert.equal(interval, HEARTBEAT_MS);
    clock = new Date("2026-10-11T14:00:30.000Z");
    assert.ok(tick !== null);
    (tick as () => void)();
    assert.equal(readFileSync(alive, "utf8").trim(), "2026-10-11T14:00:30.000Z");
  } finally {
    await started.stop();
  }
});
