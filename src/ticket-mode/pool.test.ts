// no-token: gh -- herdr, git, Linear and the clock are all injected; nothing is spawned
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { countTokens, createPool, findTranscript, herdrName, isStartDialog, parseOutcome, ticketDir, ticketFolder, worktreesIn } from "./pool.ts";
import { emptyQueue, enqueue, retry, setPaused, type Queue } from "./queue.ts";
import { parseTicketSettings } from "./settings.ts";
import type { Ticket, TicketSource } from "./source.ts";

const ticket = (key: string) => ({ key, title: key, description: "", url: `https://linear.app/x/${key}`, branch: key.toLowerCase(), status: "Backlog", statusOrder: 0, team: "NBF", project: null, priority: 0 }) as Ticket;
const source: TicketSource = { assigned: async () => [], read: async () => null, download: async () => [] };

/** A herdr that opens workspaces and starts agents, and reports each label's status from `status`. */
function herdr(status: Map<string, string>, screen: { text: string } = { text: "" }) {
  const calls: string[][] = [];
  let next = 0;
  const run = (args: string[]) => {
    calls.push(args);
    if (args.includes("read")) return screen.text;
    if (args.includes("create")) {
      next += 1;
      return JSON.stringify({ result: { root_pane: { pane_id: `w${next}:p1` }, workspace: { workspace_id: `w${next}` } } });
    }
    if (args.includes("agent") && args.includes("list")) return JSON.stringify({ result: { agents: [...status].map(([label]) => ({ name: null, workspace_id: `w${label.replace(/\D/g, "")}`, agent_session: { value: `session-${label}` } })) } });
    if (args.includes("list")) return JSON.stringify({ result: { workspaces: [...status].map(([label, s]) => ({ label, agent_status: s })) } });
    return JSON.stringify({ type: "ok" });
  };
  return { run, calls };
}

function setup(max = 2, keys = ["NBF-1", "NBF-2", "NBF-3"], tickets: Record<string, unknown> = {}) {
  const root = tmpDir("ticket-pool-");
  const settings = parseTicketSettings({ clones: { "nbl-ui-netbox": "/repos/nbl-ui-netbox", "nbl-ui-platform-libs": "/repos/libs" }, stateDir: join(root, "state"), tickets });
  let queue: Queue = setPaused(enqueue(emptyQueue(max), keys.map(ticket), { model: "sonnet", effort: "high" }, 0), false);
  const store = { get: () => queue, set: (next: Queue) => { queue = next; } };
  const status = new Map<string, string>();
  const screen = { text: "" };
  const h = herdr(status, screen);
  const pool = createPool(store, { settings, source, hook: { node: "/node", bin: "/tool/src/bin.ts" }, herdr: h.run, hostFile: "/work/.agent-org/host.json", now: () => 100, load: () => ({ load: 1, cores: 14 }), transcriptsRoot: join(root, "transcripts"), wait: async () => {} });
  const entry = (key: string) => queue.entries.find((e) => e.ticket.key === key)!;
  return { settings, pool, status, h, entry, store, root, screen };
}

test("a tick starts as many as `max` allows, each in ticket mode's own herdr session, prompt first and the tool list last", async () => {
  const { pool, h, entry, settings } = setup(2);
  await pool.tick();
  assert.deepEqual(["NBF-1", "NBF-2", "NBF-3"].map((k) => entry(k).phase), ["running", "running", "queued"]);
  assert.ok(h.calls.every((args) => args[0] === "--session" && args[1] === "tickets"), "never the org's session");
  assert.ok(h.calls.some((args) => args.includes("start") && args.includes("t-nbf-1")), "herdr's agent name is the key in lower case, which herdr requires");
  const start = h.calls.find((args) => args.includes("start"))!;
  const tail = start.slice(start.indexOf("--") + 1);
  assert.equal(tail[0], `Read ${ticketDir(settings, "NBF-1")}/brief.md and follow it.`);
  assert.deepEqual(tail.slice(-2), ["--disallowedTools", "AskUserQuestion"]);
  assert.ok(tail.includes("--dangerously-skip-permissions") && tail.includes("sonnet"));
  const folder = ticketFolder(settings, "NBF-1");
  const written = JSON.parse(readFileSync(join(folder, ".claude", "settings.local.json"), "utf8"));
  assert.equal(written.permissions.defaultMode, "bypassPermissions", "the settings sit in the ticket's folder, where the worker starts");
  assert.deepEqual(worktreesIn(folder), [], "no worktree is made for it: the worker chooses the repository");
  assert.ok(existsSync(join(ticketDir(settings, "NBF-1"), "brief.md")));
  const create = h.calls.find((args) => args.includes("create"))!;
  assert.ok(create.includes("--cwd") && create.includes(folder), "the worker starts in the ticket's folder");
  for (const pair of ["AGENT_ORG_TICKET=NBF-1", "AGENT_ORG_TICKET_BRANCH=nbf-1", "AGENT_ORG_TICKET_HOST=/work/.agent-org/host.json"]) {
    assert.ok(create.includes(pair), `its shell carries ${pair}, which ticket:worktree reads`);
  }
});

test("each run's brief carries the machine's notes, and its ticket dir a copy of the machine's refusals", async () => {
  const notes = join(tmpDir("ticket-notes-"), "notes.md");
  writeFileSync(notes, "Start apps with `npm run dev:atomic`.\n");
  const deny = [{ pattern: "\\bnpm\\s+run\\s+dev\\b(?!:atomic)", reason: "a fixed port collides with other workers" }];
  const { pool, settings } = setup(1, ["NBF-1"], { brief: notes, deny });
  await pool.tick();
  const dir = ticketDir(settings, "NBF-1");
  assert.match(readFileSync(join(dir, "brief.md"), "utf8"), /## On this machine\n\nStart apps with `npm run dev:atomic`\./);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "deny.json"), "utf8")), deny);
});

test("the machine's plugins are enabled in each worker's settings file", async () => {
  const { pool, settings } = setup(1, ["NBF-1"], { plugins: ["nbl-ui@applied-ai"] });
  await pool.tick();
  const written = JSON.parse(readFileSync(join(ticketFolder(settings, "NBF-1"), ".claude", "settings.local.json"), "utf8"));
  assert.deepEqual(written.enabledPlugins, { "nbl-ui@applied-ai": true });
});

test("a notes file that cannot be read fails the run, naming the setting", async () => {
  const { pool, entry } = setup(1, ["NBF-1"], { brief: "/nowhere/notes.md" });
  await pool.tick();
  const outcome = entry("NBF-1").outcome;
  assert.equal(outcome?.kind, "crashed");
  assert.match(outcome?.kind === "crashed" ? outcome.reason : "", /tickets\.brief names \/nowhere\/notes\.md/);
});

test("a run ends on its outcome file once the agent is idle; idle before it ever worked is not an end", async () => {
  const { pool, status, entry, settings, root } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "idle");
  await pool.tick();
  assert.equal(entry("NBF-1").phase, "running", "idle with no outcome and never seen working: the prompt may not be taken yet");
  writeFileSync(join(ticketDir(settings, "NBF-1"), "outcome.json"), JSON.stringify({ kind: "draft-pr", prs: [{ repo: "nbl-ui-netbox", url: "https://github.com/x/pull/1" }] }));
  // The session's transcript, filed under a project that is not the worktree's, found by the id herdr reports for the run's workspace.
  mkdirSync(join(root, "transcripts", "-Users-me-work"), { recursive: true });
  writeFileSync(join(root, "transcripts", "-Users-me-work", "session-t-nbf-1.jsonl"), JSON.stringify({ message: { usage: { input_tokens: 3, output_tokens: 4 } } }));
  await pool.tick();
  assert.deepEqual(entry("NBF-1").tokens, { input: 3, output: 4 });
  assert.deepEqual(entry("NBF-1").outcome, { kind: "draft-pr", prs: [{ repo: "nbl-ui-netbox", url: "https://github.com/x/pull/1" }] });
  assert.equal(entry("NBF-1").workspace, undefined, "its workspace was closed");
});

test("working then idle with no outcome is `no-outcome`; a workspace gone from two listings is `crashed`", async () => {
  const { pool, status, entry } = setup(2, ["NBF-1", "NBF-2"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "working");
  status.set(herdrName("NBF-2"), "working");
  await pool.tick();
  status.set(herdrName("NBF-1"), "idle");
  status.delete(herdrName("NBF-2"));
  await pool.tick();
  assert.deepEqual(entry("NBF-1").outcome, { kind: "no-outcome" });
  assert.equal(entry("NBF-2").phase, "running", "one missing listing is not enough");
  await pool.tick();
  assert.equal(entry("NBF-2").outcome?.kind, "crashed");
});

test("the repositories a worker has made worktrees in are recorded on its entry as it makes them", async () => {
  const { pool, status, entry, settings } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "working");
  const folder = ticketFolder(settings, "NBF-1");
  mkdirSync(join(folder, "nbl-ui-netbox"), { recursive: true });
  writeFileSync(join(folder, "nbl-ui-netbox", ".git"), "gitdir: /repos/nbl-ui-netbox/.git/worktrees/x\n");
  mkdirSync(join(folder, "notes"), { recursive: true });
  await pool.tick();
  assert.deepEqual(entry("NBF-1").repos, ["nbl-ui-netbox"], "a directory that holds no worktree is not a repository");
});

test("an agent waiting on a person is shown as waiting and keeps running", async () => {
  const { pool, status, entry } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "blocked");
  await pool.tick();
  assert.deepEqual([entry("NBF-1").phase, entry("NBF-1").waiting], ["running", true]);
});

test("stop closes a live run's workspace and records it", async () => {
  const { pool, entry, h } = setup(1, ["NBF-1"]);
  await pool.tick();
  pool.stop("NBF-1");
  assert.deepEqual(entry("NBF-1").outcome, { kind: "stopped" });
  assert.ok(h.calls.some((args) => args.includes("close")));
});

test("after a restart, a run herdr no longer lists is `crashed`, and one it lists carries on", async () => {
  const { pool, status, entry } = setup(2, ["NBF-1", "NBF-2"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "working");
  pool.reconcile();
  assert.equal(entry("NBF-1").phase, "running");
  assert.equal(entry("NBF-2").outcome?.kind, "crashed");
});

test("an outcome file that cannot be read is `needs-human`, saying so", () => {
  assert.deepEqual(parseOutcome("{\"kind\":\"wrong-repo\",\"where\":\"netbox_physical_geometry\"}"), { kind: "wrong-repo", where: "netbox_physical_geometry" });
  assert.equal(parseOutcome("nonsense").kind, "needs-human");
  assert.equal(parseOutcome("{\"kind\":\"merged\"}").kind, "needs-human");
});

test("tokens are read from the session's own transcript, found by its id in whichever project Claude Code filed it", () => {
  const root = tmpDir("ticket-tokens-");
  mkdirSync(join(root, "-Users-me-work"), { recursive: true });
  const file = join(root, "-Users-me-work", "u-123.jsonl");
  writeFileSync(file, [
    JSON.stringify({ message: { usage: { input_tokens: 10, cache_read_input_tokens: 100, cache_creation_input_tokens: 5, output_tokens: 7 } } }),
    JSON.stringify({ type: "user", message: { content: "no usage here" } }),
    "{\"message\":{\"usage\":", // a live transcript's partial last line
  ].join("\n"));
  assert.equal(findTranscript(root, "u-123"), file);
  assert.equal(findTranscript(root, "u-404"), null);
  assert.deepEqual(countTokens(file), { input: 115, output: 7 });
  assert.deepEqual(countTokens(null), { input: 0, output: 0 });
});

test("a session whose herdr server does not answer is started once, and waited for", async () => {
  const root = tmpDir("ticket-session-");
  const settings = parseTicketSettings({ clones: { a: "/r/a" }, stateDir: root });
  let up = false;
  const started: string[] = [];
  const run = (args: string[]) => {
    if (!up) throw new Error("server_not_running");
    return JSON.stringify({ result: { workspaces: [] } });
  };
  let queue = emptyQueue(1);
  const pool = createPool({ get: () => queue, set: (q) => { queue = q; } }, {
    settings, source, hook: { node: "n", bin: "b" }, herdr: run, wait: async () => { up = true; }, startServer: (s) => started.push(s),
  });
  await pool.ensureSession();
  await pool.ensureSession();
  assert.deepEqual(started, ["tickets"], "started in ticket mode's own session, and only when it did not answer");
});

test("a ticket's herdr name is lower case, starts with a letter and fits herdr's 32 characters", () => {
  assert.equal(herdrName("NBF-1270"), "t-nbf-1270");
  assert.equal(herdrName("VE-9"), "t-ve-9");
  assert.ok(herdrName("ABCDEFGHIJKLMNOPQRSTUVWXYZ-123456789").length <= 32);
  assert.match(herdrName("X.Y 1"), /^[a-z][a-z0-9_-]*$/);
});

const TRUST = (path: string) => [
  " Accessing workspace:", "", ` ${path.slice(0, 40)}`, ` ${path.slice(40)}`, "",
  " Quick safety check: Is this a project you created or one you trust? (Like your own code, a",
  " ❯ No, exit", "   Yes, I trust this folder",
].join("\n");

test("the two start dialogs are recognised for the pool's own worktree, a wrapped path included, and nothing else is", () => {
  const worktree = "/Users/me/Documents/repos/work/.tickets/NBF-1";
  assert.equal(isStartDialog(TRUST(worktree), worktree), true);
  assert.equal(isStartDialog(TRUST("/somewhere/else/entirely/that/is/not/ours/at/all"), worktree), false, "a trust dialog for another folder is the person's");
  assert.equal(isStartDialog("  Allow external CLAUDE.md file imports?\n  /Users/me/Documents/repos/work/AGENTS.md", worktree), true);
  assert.equal(isStartDialog("Do you want to proceed?\n ❯ 1. Yes", worktree), false, "a permission prompt is not answered");
});

test("a run showing a start dialog for its worktree is answered with down-enter rather than marked waiting, a bounded number of times", async () => {
  const { pool, status, entry, settings, h, screen } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "blocked");
  screen.text = TRUST(ticketFolder(settings, "NBF-1"));
  await pool.tick();
  const answers = () => h.calls.filter((args) => args.includes("send-keys"));
  assert.deepEqual(answers()[0], ["--session", "tickets", "agent", "send-keys", "t-nbf-1", "down", "enter"]);
  assert.notEqual(entry("NBF-1").waiting, true, "an answered dialog is not a person's to clear");
  for (let i = 0; i < 6; i += 1) await pool.tick();
  assert.equal(answers().length, 4, "a dialog that keeps coming back is answered four times, then left");
  assert.equal(entry("NBF-1").waiting, true);
});

test("a retry's earlier outcome does not end it before it starts", async () => {
  const { pool, status, entry, settings, store } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "working");
  await pool.tick();
  status.set(herdrName("NBF-1"), "idle");
  await pool.tick();
  assert.deepEqual(entry("NBF-1").outcome, { kind: "no-outcome" });
  writeFileSync(join(ticketDir(settings, "NBF-1"), "outcome.json"), JSON.stringify({ kind: "needs-human", reason: "stale" }));
  store.set(retry(store.get(), "NBF-1", 200));
  status.set(herdrName("NBF-1"), "idle");
  await pool.tick();
  assert.equal(entry("NBF-1").phase, "running", "the stale outcome was cleared, so an idle agent that has not worked yet is not finished");
  assert.ok(!existsSync(join(ticketDir(settings, "NBF-1"), "outcome.json")));
});

test("a run stopped while it was starting stays stopped, and the workspace its start raced is closed", async () => {
  const root = tmpDir("ticket-race-");
  const settings = parseTicketSettings({ clones: { "nbl-ui-netbox": "/repos/nbl-ui-netbox" }, stateDir: root });
  let queue: Queue = setPaused(enqueue(emptyQueue(1), [ticket("NBF-1")], { model: "sonnet", effort: "high" }, 0), false);
  const store = { get: () => queue, set: (next: Queue) => { queue = next; } };
  const h = herdr(new Map());
  let pool: ReturnType<typeof createPool>;
  // The person presses Stop while Claude is starting.
  const herdrAsync = async (args: string[]) => { pool.stop("NBF-1"); return h.run(args); };
  pool = createPool(store, { settings, source, hook: { node: "n", bin: "b" }, herdr: h.run, herdrAsync, wait: async () => {}, load: () => ({ load: 0, cores: 1 }) });
  await pool.tick();
  assert.deepEqual(queue.entries[0].outcome, { kind: "stopped" });
  assert.ok(h.calls.some((args) => args.includes("close") && args.includes("w1")), "the raced workspace is closed");
});

test("a tick asked for during a tick runs once more after it, so a ticket queued meanwhile does not wait for the next interval", async () => {
  const { pool, entry, store } = setup(2, ["NBF-1"]);
  const first = pool.tick();
  store.set(enqueue(store.get(), [ticket("NBF-2")], { model: "sonnet", effort: "high" }, 1));
  await pool.tick();
  await first;
  assert.equal(entry("NBF-2").phase, "running");
});

test("a paused queue starts nothing, however much room there is", async () => {
  const { pool, store, entry, h } = setup(3, ["NBF-1"]);
  store.set(setPaused(store.get(), true));
  await pool.tick();
  assert.equal(entry("NBF-1").phase, "queued");
  assert.ok(!h.calls.some((args) => args.includes("create")), "no workspace was opened");
});
