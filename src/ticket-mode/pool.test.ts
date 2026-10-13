// no-token: gh -- herdr, git, Linear and the clock are all injected; nothing is spawned
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { countTokens, createPool, findTranscript, herdrName, isStartDialog, parseOutcome, ticketDir } from "./pool.ts";
import { emptyQueue, enqueue, type Queue } from "./queue.ts";
import { parseTicketSettings } from "./settings.ts";
import type { Ticket, TicketSource } from "./source.ts";
import type { Git } from "./worktree.ts";

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

/** A git whose remote's default is `develop`, where no branch exists yet and `worktree add` makes the directory. */
const git: Git = (_cwd, args) => {
  if (args[0] === "ls-remote") return "ref: refs/heads/develop\tHEAD\n";
  if (args[0] === "rev-parse" && args.includes("--verify")) throw new Error("no such branch");
  if (args[0] === "worktree") mkdirSync(args[args.length - 2], { recursive: true });
  if (args[0] === "check-ignore") return "";
  return "";
};

function setup(max = 2, keys = ["NBF-1", "NBF-2", "NBF-3"]) {
  const root = tmpDir("ticket-pool-");
  const settings = parseTicketSettings({ clones: { "nbl-ui-netbox": "/repos/nbl-ui-netbox", "nbl-ui-platform-libs": "/repos/libs" }, stateDir: join(root, "state") });
  let queue: Queue = enqueue(emptyQueue(max), keys.map(ticket), { repos: ["nbl-ui-netbox"], model: "sonnet", effort: "high" }, 0);
  const store = { get: () => queue, set: (next: Queue) => { queue = next; } };
  const status = new Map<string, string>();
  const screen = { text: "" };
  const h = herdr(status, screen);
  const pool = createPool(store, { settings, source, hook: { node: "/node", bin: "/tool/src/bin.ts" }, herdr: h.run, git, now: () => 100, load: () => ({ load: 1, cores: 14 }), transcriptsRoot: join(root, "transcripts"), sleep: () => {} });
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
  const worktree = join(settings.worktreeRoot, "NBF-1", "nbl-ui-netbox");
  const written = JSON.parse(readFileSync(join(worktree, ".claude", "settings.local.json"), "utf8"));
  assert.equal(written.permissions.defaultMode, "bypassPermissions");
  assert.ok(existsSync(join(ticketDir(settings, "NBF-1"), "brief.md")));
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

test("an agent waiting on a person is shown as waiting and keeps running", async () => {
  const { pool, status, entry } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "blocked");
  await pool.tick();
  assert.deepEqual([entry("NBF-1").phase, entry("NBF-1").waiting], ["running", true]);
});

test("stop closes a live run's workspace and records it; a preparation that fails is `crashed` with the reason", async () => {
  const { pool, entry, h } = setup(1, ["NBF-1"]);
  await pool.tick();
  pool.stop("NBF-1");
  assert.deepEqual(entry("NBF-1").outcome, { kind: "stopped" });
  assert.ok(h.calls.some((args) => args.includes("close")));

  const other = setup(1, ["NBF-9"]);
  other.store.set({ ...other.store.get(), entries: other.store.get().entries.map((e) => ({ ...e, repos: ["not-a-clone"] })) });
  await other.pool.tick();
  assert.deepEqual(other.entry("NBF-9").outcome, { kind: "crashed", reason: "not-a-clone is not in the host file's clones" });
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

test("a session whose herdr server does not answer is started once, and waited for", () => {
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
    settings, source, hook: { node: "n", bin: "b" }, herdr: run, git, sleep: () => { up = true; }, startServer: (s) => started.push(s),
  });
  pool.ensureSession();
  pool.ensureSession();
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
  const worktree = "/Users/me/Documents/repos/work/.tickets/NBF-1/nbl-ui-netbox";
  assert.equal(isStartDialog(TRUST(worktree), worktree), true);
  assert.equal(isStartDialog(TRUST("/somewhere/else/entirely/that/is/not/ours/at/all"), worktree), false, "a trust dialog for another folder is the person's");
  assert.equal(isStartDialog("  Allow external CLAUDE.md file imports?\n  /Users/me/Documents/repos/work/AGENTS.md", worktree), true);
  assert.equal(isStartDialog("Do you want to proceed?\n ❯ 1. Yes", worktree), false, "a permission prompt is not answered");
});

test("a run showing a start dialog for its worktree is answered with down-enter rather than marked waiting, a bounded number of times", async () => {
  const { pool, status, entry, settings, h, screen } = setup(1, ["NBF-1"]);
  await pool.tick();
  status.set(herdrName("NBF-1"), "blocked");
  screen.text = TRUST(join(settings.worktreeRoot, "NBF-1", "nbl-ui-netbox"));
  await pool.tick();
  const answers = () => h.calls.filter((args) => args.includes("send-keys"));
  assert.deepEqual(answers()[0], ["--session", "tickets", "agent", "send-keys", "t-nbf-1", "down", "enter"]);
  assert.notEqual(entry("NBF-1").waiting, true, "an answered dialog is not a person's to clear");
  for (let i = 0; i < 6; i += 1) await pool.tick();
  assert.equal(answers().length, 4, "a dialog that keeps coming back is answered four times, then left");
  assert.equal(entry("NBF-1").waiting, true);
});
