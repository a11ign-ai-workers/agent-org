// no-token: gh -- the page's own script runs against a fake DOM and a canned fetch; no browser, no socket
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const SCRIPT = /<script>([\s\S]*)<\/script>/.exec(readFileSync(new URL("./ui.html", import.meta.url), "utf8"))![1];

class Node_ {
  children: Node_[] = [];
  attrs: Record<string, string> = {};
  listeners: Record<string, (() => void)[]> = {};
  className = "";
  textContent = "";
  value = "";
  checked = false;
  hidden = false;
  disabled = false;
  tag: string;
  constructor(tag: string) { this.tag = tag; }
  append(...nodes: (Node_ | string)[]) { for (const n of nodes) this.children.push(typeof n === "string" ? Object.assign(new Node_("#text"), { textContent: n }) : n); }
  replaceChildren(...nodes: Node_[]) { this.children = []; this.append(...nodes); }
  setAttribute(k: string, v: string) { this.attrs[k] = v; }
  getAttribute(k: string) { return this.attrs[k]; }
  addEventListener(type: string, fn: () => void) { (this.listeners[type] ??= []).push(fn); }
  fire(type: string) { for (const fn of this.listeners[type] ?? []) fn(); }
  text(): string { return this.textContent + this.children.map((c) => c.text()).join(""); }
  all(): Node_[] { return [this, ...this.children.flatMap((c) => c.all())]; }
}

const TICKETS = [
  { key: "T-1", title: "fix(netbox): one", status: "Backlog", statusOrder: 0, priority: 2, project: "Alpha", url: "", resolved: { repo: "netbox", package: null } },
  { key: "T-2", title: "fix(netbox): two", status: "Backlog", statusOrder: 0, priority: 2, project: "Beta", url: "", resolved: { repo: "netbox", package: null } },
  { key: "T-3", title: "no scope", status: "Backlog", statusOrder: 0, priority: 2, project: "Alpha", url: "", resolved: null },
  { key: "T-4", title: "fix(netbox): four", status: "Todo", statusOrder: 1, priority: 2, project: null, url: "", resolved: { repo: "netbox", package: null } },
];

/** Run the page's script against a fake document, with `storage` as its localStorage. Resolves once the first render has happened. */
async function page(storage: Map<string, string>, config: Record<string, unknown> = {}) {
  const byId = new Map<string, Node_>();
  const posts: { path: string; body: any }[] = [];
  const document = {
    getElementById: (id: string) => { if (!byId.has(id)) byId.set(id, new Node_(`#${id}`)); return byId.get(id)!; },
    createElement: (tag: string) => new Node_(tag),
    querySelectorAll: () => [],
    activeElement: null,
  };
  const fetch = async (path: string, init: { method: string; body?: string } = { method: "GET" }) => {
    const body = init.body === undefined ? undefined : JSON.parse(init.body);
    if (init.method === "POST") posts.push({ path, body });
    const value = path === "/api/config" ? { models: ["opus"], efforts: ["high"], choice: { model: "opus", effort: "high" }, max: 3, unreadable: {}, ...config }
      : path === "/api/tickets" ? TICKETS : { entries: [], max: 3, paused: true };
    return { ok: true, json: async () => value, statusText: "" };
  };
  const localStorage = { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => { storage.set(k, v); } };
  runInNewContext(SCRIPT, { document, fetch, localStorage, setInterval: () => 0, Date, JSON, Object, Array, Set, Map, String, Number, Boolean, Math });
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setImmediate(resolve));
  const $ = (id: string) => document.getElementById(id);
  const groups = () => $("groups").children;
  const shownKeys = () => $("groups").all().filter((n) => n.className.startsWith("row")).map((n) => n.children[1].text());
  const chip = (name: string) => $("projects").children.find((c) => c.tag === "button" && c.children[0]?.text() === name || c.textContent === name)!;
  return { $, groups, shownKeys, chip, posts };
}

test("a project chip filters the list, several can be chosen at once, and All projects clears them; the choice is kept in localStorage", async () => {
  const storage = new Map<string, string>();
  const p = await page(storage);
  assert.deepEqual(p.shownKeys(), ["T-1", "T-2", "T-3", "T-4"]);
  for (const chipText of ["Alpha2", "Beta1", "(no project)1"]) assert.ok(p.$("projects").text().includes(chipText), `a chip with its count: ${chipText}`);
  p.chip("Beta").fire("click");
  assert.deepEqual(p.shownKeys(), ["T-2"]);
  p.chip("(no project)").fire("click");
  assert.deepEqual(p.shownKeys(), ["T-2", "T-4"], "a second chip adds its tickets");
  assert.deepEqual(JSON.parse(storage.get("ticket-mode.projects")!).sort(), ["(no project)", "Beta"]);
  p.chip("All projects").fire("click");
  assert.deepEqual(p.shownKeys(), ["T-1", "T-2", "T-3", "T-4"]);
  assert.equal(storage.get("ticket-mode.projects"), "[]");
});

test("a remembered project filter is applied when the page loads again", async () => {
  const p = await page(new Map([["ticket-mode.projects", JSON.stringify(["Alpha"])]]));
  assert.deepEqual(p.shownKeys(), ["T-1", "T-3"]);
});

test("a status group folds from its header, stays folded after a reload, and unfolds again", async () => {
  const storage = new Map<string, string>();
  const first = await page(storage);
  const folder = (p: typeof first) => p.groups()[0].all().find((n) => n.className === "fold")!;
  assert.ok(!first.groups()[0].className.includes("collapsed"));
  folder(first).fire("click");
  assert.ok(first.groups()[0].className.includes("collapsed"));
  assert.equal(first.groups()[1].className.includes("collapsed"), false, "only that group folds");
  assert.deepEqual(JSON.parse(storage.get("ticket-mode.folded")!), ["Backlog"]);
  const reloaded = await page(storage);
  assert.ok(reloaded.groups()[0].className.includes("collapsed"), "the reload keeps it folded");
  folder(reloaded).fire("click");
  assert.ok(!reloaded.groups()[0].className.includes("collapsed"));
  assert.equal(storage.get("ticket-mode.folded"), "[]");
});

test("Select all takes the visible tickets that name a repository, and queues exactly those", async () => {
  const p = await page(new Map([["ticket-mode.projects", JSON.stringify(["Alpha"])]]));
  p.$("all").checked = true;
  p.$("all").fire("change");
  p.$("queue").fire("click");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(p.posts.find((x) => x.path === "/api/queue")?.body.keys, ["T-1"], "T-3 is visible but names no repository; T-2 and T-4 are filtered out");
});

test("a clone the server could not read is shown on the page", async () => {
  const p = await page(new Map(), { unreadable: { netbox: "not a repository" } });
  assert.equal(p.$("unreadable").hidden, false);
  assert.match(p.$("unreadable").textContent, /netbox \(not a repository\)/);
  assert.equal((await page(new Map())).$("unreadable").hidden, true, "control: hidden when every clone read");
});
