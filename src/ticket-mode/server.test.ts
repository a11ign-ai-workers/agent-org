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

/** A ticket whose title is `title`: its scope is what decides its repository. */
const ticket = (key: string, title = `fix(nbl-ui-netbox): ${key}`) => ({ key, title, description: "", url: "", branch: key.toLowerCase(), status: "Backlog", statusOrder: 0, team: "NBF", project: null, priority: 0 }) as Ticket;
const PACKAGES = { "nbl-ui-netbox": ["ui-netbox", "ui-visual-explorer"], "platform-monorepo": [] };
const TOKEN = "a".repeat(48);

function board(port = 4747) {
  const dir = tmpDir("ticket-server-");
  const settings = parseTicketSettings({ clones: { "nbl-ui-netbox": "/r/netbox", "platform-monorepo": "/r/pm" }, stateDir: dir, tickets: { port } });
  const assigned = [ticket("NBF-1"), ticket("NBF-2"), ticket("NBF-3", "Visual Explorer UI - Fit to View does nothing"), ticket("NBF-4", "fix(ci): lint-staged")];
  const source: TicketSource = { assigned: async () => assigned, read: async (key) => (key === "VE-9" ? ticket("VE-9", "feat(ui-visual-explorer): zoom") : null), download: async () => [] };
  const ticks: string[] = [];
  const pool = { tick: async () => { ticks.push("tick"); }, stop: (key: string) => { ticks.push(`stop ${key}`); }, reconcile: () => {}, ensureSession: async () => {} };
  const made = createBoard({ settings, source, token: TOKEN, packages: PACKAGES, queuePath: join(dir, "queue.json"), choicePath: join(dir, "choice.json"), pool, now: () => 7 });
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

test("each ticket is listed with the repository its title names, a package resolving to the repository that holds it", async () => {
  const b = board();
  const [, tickets] = await b.api("GET", "/api/tickets", {}) as [number, any[]];
  assert.deepEqual(tickets.map((t) => [t.key, t.resolved]), [
    ["NBF-1", { repo: "nbl-ui-netbox", package: null }],
    ["NBF-2", { repo: "nbl-ui-netbox", package: null }],
    ["NBF-3", null],
    ["NBF-4", null],
  ], "no scope, and a scope that is neither a repository nor a package (`ci`), resolve to nothing");
});

test("queueing works each ticket in the repository its title names, with the model and effort chosen, remembers them, and wakes the pool", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  const [status, queue] = await b.api("POST", "/api/queue", { keys: ["NBF-2", "VE-9"], model: "opus", effort: "max" }) as [number, any];
  assert.equal(status, 200);
  assert.deepEqual(queue.entries.map((e: any) => [e.ticket.key, e.repos, e.model, e.effort]), [
    ["NBF-2", ["nbl-ui-netbox"], "opus", "max"],
    ["VE-9", ["nbl-ui-netbox"], "opus", "max"],
  ], "VE-9 was not in the assigned list, so it was read by key, and its package `ui-visual-explorer` is in nbl-ui-netbox");
  assert.ok(existsSync(join(b.dir, "queue.json")));
  assert.deepEqual(b.ticks, ["tick"]);
  const [, config] = await b.api("GET", "/api/config", {}) as [number, any];
  assert.deepEqual(config.choice, { model: "opus", effort: "max" });
});

test("a ticket whose title names no repository is refused with how to retitle it, and then nothing in the request is queued", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NBF-1", "NBF-3", "NBF-4"], model: "opus", effort: "high" }),
    /no repository in the title of NBF-3, NBF-4: retitle as <type>\(<repo or package>\): <what>/);
  assert.deepEqual(b.store.get().entries, [], "NBF-1 resolved, but a partial queue would hide the two that did not");
});

test("an unknown model or an unknown ticket is refused, and nothing is queued", async () => {
  const b = board();
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NBF-1"], model: "gpt", effort: "high" }), /model must be one of/);
  await assert.rejects(b.api("POST", "/api/queue", { keys: ["NOPE-1"], model: "opus", effort: "high" }), /no ticket NOPE-1/);
  assert.deepEqual(b.store.get().entries, []);
});

test("an amend is held to the rules queueing uses: an unknown repository, model or effort is refused and the entry is unchanged", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  await b.api("POST", "/api/queue", { keys: ["NBF-1"], model: "opus", effort: "high" });
  const before = JSON.stringify(b.store.get());
  await assert.rejects(b.api("POST", "/api/queue/NBF-1/amend", { repos: ["nbl-ui-elsewhere"] }), /not in the host file's clones/);
  await assert.rejects(b.api("POST", "/api/queue/NBF-1/amend", { model: "gpt" }), /model must be one of/);
  await assert.rejects(b.api("POST", "/api/queue/NBF-1/amend", { effort: "extreme" }), /effort must be one of/);
  assert.equal(JSON.stringify(b.store.get()), before);
  await b.api("POST", "/api/queue/NBF-1/amend", { model: "sonnet", repos: ["platform-monorepo"] });
  assert.deepEqual(b.store.get().entries.map((e) => [e.repos, e.model, e.effort]), [[["platform-monorepo"], "sonnet", "high"]]);
});

test("the board's queue starts paused, and Start and Pause go through the API", async () => {
  const b = board();
  const [, queue] = await b.api("GET", "/api/queue", {}) as [number, any];
  assert.equal(queue.paused, true);
  await b.api("POST", "/api/paused", { paused: false });
  assert.equal(b.store.get().paused, false);
  assert.deepEqual(b.ticks, ["tick"], "starting wakes the pool");
  await assert.rejects(b.api("POST", "/api/paused", { paused: "no" }), /true or false/);
  await b.api("POST", "/api/paused", { paused: true });
  assert.equal(b.store.get().paused, true);
});

test("remove, stop and max go through the board", async () => {
  const b = board();
  await b.api("GET", "/api/tickets", {});
  await b.api("POST", "/api/queue", { keys: ["NBF-1", "NBF-2"], model: "sonnet", effort: "high" });
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
