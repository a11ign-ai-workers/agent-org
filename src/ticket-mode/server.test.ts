// no-token: gh -- Linear and the pool are injected; the one server listens on 127.0.0.1 for the length of a test
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { parseTicketSettings } from "./settings.ts";
import { carriesToken, createBoard, refusal } from "./server.ts";
import type { Ticket, TicketSource } from "./source.ts";

const ticket = (key: string) => ({ key, title: key, description: "", url: "", branch: key.toLowerCase(), status: "Backlog", statusOrder: 0, team: "NBF", project: null, priority: 0 }) as Ticket;
const TOKEN = "a".repeat(48);

function board(port = 4747) {
  const dir = tmpDir("ticket-server-");
  const settings = parseTicketSettings({ clones: { "nbl-ui-netbox": "/r/netbox", "platform-monorepo": "/r/pm" }, stateDir: dir, tickets: { port } });
  const source: TicketSource = { assigned: async () => [ticket("NBF-1"), ticket("NBF-2")], read: async (key) => (key === "VE-9" ? ticket("VE-9") : null), download: async () => [] };
  const ticks: string[] = [];
  const pool = { tick: async () => { ticks.push("tick"); }, stop: (key: string) => { ticks.push(`stop ${key}`); }, reconcile: () => {}, ensureSession: () => {} };
  const made = createBoard({ settings, source, token: TOKEN, queuePath: join(dir, "queue.json"), choicePath: join(dir, "choice.json"), pool, now: () => 7 });
  return { ...made, ticks, dir };
}

test("a request to another host is refused, and so is a write from another origin", () => {
  assert.equal(refusal({ headers: { host: "127.0.0.1:4747" }, method: "GET" }, 4747), null);
  assert.equal(refusal({ headers: { host: "localhost:4747" }, method: "POST", origin: undefined } as any, 4747), null);
  assert.match(String(refusal({ headers: { host: "evil.example:4747" }, method: "GET" }, 4747)), /own host/, "a DNS-rebound name is refused");
  assert.match(String(refusal({ headers: { host: "127.0.0.1:4747", origin: "https://evil.example" }, method: "POST" }, 4747)), /another origin/);
  assert.equal(refusal({ headers: { host: "127.0.0.1:4747", origin: "http://127.0.0.1:4747" }, method: "POST" }, 4747), null);
});

test("the token is taken from the cookie or the header, and a wrong or missing one is not", () => {
  assert.equal(carriesToken({ headers: { cookie: `x=1; ticket_token=${TOKEN}` } }, TOKEN), true);
  assert.equal(carriesToken({ headers: { "x-ticket-token": TOKEN } }, TOKEN), true);
  assert.equal(carriesToken({ headers: { cookie: "ticket_token=wrong" } }, TOKEN), false);
  assert.equal(carriesToken({ headers: {} }, TOKEN), false);
});

test("queueing takes the tickets you selected to the repositories, model and effort you chose, remembers the choice, and wakes the pool", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  const [status, queue] = await b.api("POST", "/api/queue", { keys: ["NBF-2", "VE-9"], repos: ["nbl-ui-netbox", "platform-monorepo"], model: "opus", effort: "max" }) as [number, any];
  assert.equal(status, 200);
  assert.deepEqual(queue.entries.map((e: any) => [e.ticket.key, e.repos, e.model, e.effort]), [
    ["NBF-2", ["nbl-ui-netbox", "platform-monorepo"], "opus", "max"],
    ["VE-9", ["nbl-ui-netbox", "platform-monorepo"], "opus", "max"],
  ], "VE-9 was not in the assigned list, so it was read by key");
  assert.ok(existsSync(join(b.dir, "queue.json")));
  assert.deepEqual(b.ticks, ["tick"]);
  const [, config] = await b.api("GET", "/api/config", {}) as [number, any];
  assert.deepEqual(config.choice, { repos: ["nbl-ui-netbox", "platform-monorepo"], model: "opus", effort: "max" });
  assert.deepEqual(config.repos, ["nbl-ui-netbox", "platform-monorepo"]);
});

test("a repository not in the host file, an unknown model or an unknown ticket is refused, and nothing is queued", async () => {
  const b = board();
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NBF-1"], repos: ["nbl-ui-elsewhere"], model: "opus", effort: "high" }), /not in the host file's clones/);
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NBF-1"], repos: ["nbl-ui-netbox"], model: "gpt", effort: "high" }), /model must be one of/);
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NOPE-1"], repos: ["nbl-ui-netbox"], model: "opus", effort: "high" }), /no ticket NOPE-1/);
  assert.deepEqual(b.store.get().entries, []);
});

test("remove, stop and max go through the board", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  await b.api("POST", "/api/queue", { keys: ["NBF-1", "NBF-2"], repos: ["nbl-ui-netbox"], model: "sonnet", effort: "high" });
  await b.api("POST", "/api/queue/NBF-1/remove", {});
  await b.api("POST", "/api/queue/NBF-2/stop", {});
  await b.api("POST", "/api/max", { max: 5 });
  assert.deepEqual(b.store.get().entries.map((e) => e.ticket.key), ["NBF-2"]);
  assert.ok(b.ticks.includes("stop NBF-2"));
  assert.equal(b.store.get().max, 5);
});

test("over HTTP: no token is 401, the printed URL sets the cookie, and the cookie then reaches the API", async () => {
  const probe: Server = createServer();
  await new Promise<void>((done) => probe.listen(0, "127.0.0.1", done));
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((done) => probe.close(() => done()));
  const b = board(port);
  const server = createServer((req, res) => { void b.handle(req, res); });
  await new Promise<void>((done) => server.listen(port, "127.0.0.1", done));
  try {
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(`${base}/api/queue`)).status, 401);
    const entry = await fetch(`${base}/?token=${TOKEN}`, { redirect: "manual" });
    assert.equal(entry.status, 303);
    const cookie = String(entry.headers.get("set-cookie"));
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const queue = await fetch(`${base}/api/queue`, { headers: { cookie: cookie.split(";")[0] } });
    assert.equal(queue.status, 200);
    const page = await fetch(`${base}/`, { headers: { cookie: cookie.split(";")[0] } });
    assert.match(await page.text(), /<title>Ticket queue<\/title>/);
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});
