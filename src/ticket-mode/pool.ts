// @ts-check
// module: the worker pool -- starts queued tickets while there is room, watches each worker in herdr, and records how each run ended
//
// ONE WORKER PER TICKET, IN ITS OWN HERDR SESSION. Each run opens a workspace labelled with the ticket's key in ticket mode's session (never the
// org's), starts Claude in the ticket's first worktree, and points it at its brief. The herdr calls are the org's own (`herdr-agents.ts`).
//
// A RUN HAS ENDED WHEN ITS OUTCOME FILE EXISTS AND ITS AGENT IS IDLE OR DONE. `idle` alone proves nothing: an agent reads `idle` before it has taken
// its first prompt, and a `done` agent turns `idle` once someone looks at its pane (`wake.ts` measured both). So:
//   - outcome file, and idle or done: finished, with the worker's outcome;
//   - no outcome file, and done, or idle after it was seen working: finished, `no-outcome`;
//   - its workspace missing from two complete listings in a row, or `unknown` twice: `crashed`;
//   - any other status (a dialog, a prompt waiting on a person) is shown on the board as waiting, and the run continues.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism, homedir, loadavg } from "node:os";
import { join } from "node:path";
import { agentStartArgs, closedNote, herdrReason, openPane, readAgents } from "../herdr-agents.ts";
import {
  finish, isLive, markRunning, markStarting, nextStarts, observe,
  type Entry, type Outcome, type Queue,
} from "./queue.ts";
import type { TicketSettings } from "./settings.ts";
import type { TicketSource } from "./source.ts";
import { addWorktree, excludeFromGit, worktreePath, type Git } from "./worktree.ts";
import { BRIEF_FILE, OUTCOME_FILE, briefText, firstPrompt, workerFlags, workerSettings, type HookCommand, type WorktreeRef } from "./worker-files.ts";

/** herdr waits on Claude's start; a slow one has been measured past 30 s (`wake.ts`'s start budget), so a start gets 90. */
const START_TIMEOUT_MS = 90_000;
const SETTINGS_FILE = ".claude/settings.local.json";
/** Listings in a row a live run may be missing from (or `unknown` in) before it is recorded as crashed. */
const MISSES_TO_CRASH = 2;

export type Herdr = (args: string[], timeoutMs?: number) => string;

const defaultHerdr: Herdr = (args, timeoutMs = 30_000) => execFileSync("herdr", args, { encoding: "utf8", timeout: timeoutMs });

/** Start a session's headless herdr server, detached, so it outlives this process as the org's does under its own unit. */
const defaultStartServer = (session: string): void => {
  spawn("herdr", ["--session", session, "server"], { detached: true, stdio: "ignore" }).unref();
};

export type PoolDeps = Readonly<{
  settings: TicketSettings;
  source: TicketSource;
  hook: HookCommand;
  herdr?: Herdr;
  git?: Git;
  now?: () => number;
  /** The 1-minute load average and the cores it is compared with. */
  load?: () => Readonly<{ load: number; cores: number }>;
  /** Where Claude Code keeps each project's transcripts. */
  transcriptsRoot?: string;
  /** Start the session's headless herdr server; called only when its listing does not answer. */
  startServer?: (session: string) => void;
  /** Wait between asking a just-started server whether it answers. */
  sleep?: (ms: number) => void;
}>;

/** The pool holds the queue through these two, so the server stays its one writer. */
export type QueueStore = Readonly<{ get: () => Queue; set: (queue: Queue) => void }>;

export const ticketDir = (settings: TicketSettings, key: string): string => join(settings.stateDir, "tickets", key);

/**
 * A ticket's name in herdr, for its workspace and its agent: herdr refuses an agent name that is not a lowercase letter followed by up to 31
 * lowercase letters, digits, `-` or `_` (measured 2026-10-13, `invalid_agent_name` for `SMOKE-1`), and a tracker's keys are upper case.
 */
export const herdrName = (key: string): string => `t-${key.toLowerCase().replace(/[^a-z0-9_-]/g, "-")}`.slice(0, 32);

/**
 * THE TWO DIALOGS CLAUDE CODE RAISES ON A FOLDER IT HAS NOT SEEN, and the only screens the pool answers. `--dangerously-skip-permissions` does not
 * skip them (measured 2026-10-13): a new git worktree asks whether its folder is trusted, and one under a directory whose `CLAUDE.md` imports a
 * file above it (`@AGENTS.md`) asks whether to allow that import. The pool made the worktree and the person declared where worktrees go, so it
 * answers yes to these two, for its own worktree only, a bounded number of times. Any other screen is left for the person, as waiting.
 */
const START_DIALOGS: readonly Readonly<{ heading: string; ownFolder: boolean }>[] = [
  { heading: "Is this a project you created or one you trust?", ownFolder: true },
  { heading: "Allow external CLAUDE.md file imports?", ownFolder: false },
];
const MAX_DIALOG_ANSWERS = 4;
const squash = (text: string): string => text.replace(/\s+/g, "");

/** Is the pane showing one of {@link START_DIALOGS} for `worktree`? A trust dialog must name the worktree, which a pane may wrap across lines. PURE. */
export function isStartDialog(screen: string, worktree: string): boolean {
  return START_DIALOGS.some(({ heading, ownFolder }) => screen.includes(heading) && (!ownFolder || squash(screen).includes(squash(worktree))));
}

/** Why herdr refused: it answers a refusal as JSON on stdout (`{"error":{"message":...}}`), which `herdrReason` (stderr) does not read. */
function herdrRefusal(err: unknown): string {
  try {
    const message = JSON.parse(String((err as { stdout?: unknown })?.stdout ?? "")).error?.message;
    if (typeof message === "string") return message;
  } catch {
    // not herdr's JSON
  }
  return herdrReason(err);
}

/** The outcome a worker wrote, or `needs-human` saying the file could not be read. PURE over the file's text. */
export function parseOutcome(text: string): Outcome {
  try {
    const value = JSON.parse(text) as Record<string, unknown>;
    if (value.kind === "draft-pr" && Array.isArray(value.prs)) {
      return { kind: "draft-pr", prs: value.prs.map((pr: Record<string, unknown>) => ({ repo: String(pr.repo ?? ""), url: String(pr.url ?? "") })) };
    }
    if (value.kind === "wrong-repo") return { kind: "wrong-repo", where: String(value.where ?? "") };
    if (value.kind === "needs-human") return { kind: "needs-human", reason: String(value.reason ?? "") };
  } catch {
    // falls through to the unreadable outcome below
  }
  return { kind: "needs-human", reason: `the worker's outcome file could not be read: ${text.slice(0, 200)}` };
}

/**
 * The transcript of one Claude session, wherever Claude Code filed it. A session is filed under the project Claude Code resolves for its folder,
 * which for a worktree under an already-known directory is that directory's project, not one named after the worktree (measured 2026-10-13: a
 * worker in `<work>/.tickets/SMOKE-1/smoke` wrote to `-Users-…-repos-work/<id>.jsonl`). So it is found by the session id herdr reports.
 */
export function findTranscript(root: string, sessionId: string): string | null {
  if (!existsSync(root)) return null;
  for (const project of readdirSync(root)) {
    const file = join(root, project, `${sessionId}.jsonl`);
    if (existsSync(file)) return file;
  }
  return null;
}

/** Input and output tokens in one transcript. Input counts cache reads and writes, which are what a run spends. */
export function countTokens(file: string | null): { input: number; output: number } {
  let input = 0;
  let output = 0;
  if (file === null || !existsSync(file)) return { input, output };
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("\"usage\"")) continue;
    try {
      const usage = (JSON.parse(line) as { message?: { usage?: Record<string, number> } }).message?.usage;
      if (!usage) continue;
      input += (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
      output += usage.output_tokens ?? 0;
    } catch {
      // a partial last line of a live transcript
    }
  }
  return { input, output };
}

export function createPool(store: QueueStore, deps: PoolDeps) {
  const { settings, source, hook } = deps;
  const herdr = deps.herdr ?? defaultHerdr;
  const now = deps.now ?? Date.now;
  const transcripts = deps.transcriptsRoot ?? join(homedir(), ".claude", "projects");
  const session = { session: settings.herdrSession };
  const misses = new Map<string, number>();
  const answered = new Map<string, number>();
  /** Each live run's Claude session id by its workspace, as herdr last reported it (it changes when herdr restarts a session). */
  const claudeSessions = new Map<string, string>();

  /**
   * Claude session ids by workspace id. Keyed by WORKSPACE, not by agent name as `readAgentSessions` is: herdr names an agent only when its
   * `agent start` completes, and a start that a dialog held up past its wait never does (measured 2026-10-13, `name: null` on a running worker).
   */
  function readSessionIds(): Map<string, string> {
    try {
      const agents = JSON.parse(herdr(["--session", settings.herdrSession, "agent", "list"]))?.result?.agents;
      if (!Array.isArray(agents)) return new Map();
      return new Map(agents.filter((a) => a?.workspace_id && a?.agent_session?.value).map((a) => [String(a.workspace_id), String(a.agent_session.value)]));
    } catch {
      return new Map();
    }
  }
  const update = (change: (queue: Queue) => Queue) => store.set(change(store.get()));

  /** The worktrees, the brief and the settings file for one run. Throws, with the reason, when any of it cannot be made. */
  async function prepare(entry: Entry): Promise<{ worktrees: WorktreeRef[]; dir: string }> {
    const { ticket } = entry;
    const dir = ticketDir(settings, ticket.key);
    mkdirSync(dir, { recursive: true });
    const worktrees = entry.repos.map((repo) => {
      const clone = settings.clones[repo];
      if (clone === undefined) throw new Error(`${repo} is not in the host file's clones`);
      return addWorktree({ repo, clone, path: worktreePath(settings.worktreeRoot, ticket.key, repo), branch: ticket.branch }, deps.git);
    });
    const attachments = await source.download(ticket, dir);
    writeFileSync(join(dir, BRIEF_FILE), briefText({ ticket, worktrees, ticketDir: dir, attachments }));
    const [first, ...others] = worktrees;
    mkdirSync(join(first.path, ".claude"), { recursive: true });
    writeFileSync(join(first.path, SETTINGS_FILE),
      `${JSON.stringify(workerSettings({ model: entry.model, ticketDir: dir, otherWorktrees: others.map((w) => w.path), hook }), null, 2)}\n`);
    excludeFromGit(first.path, SETTINGS_FILE, deps.git === undefined ? {} : { git: deps.git });
    return { worktrees, dir };
  }

  /** Open the workspace and start Claude in it. Returns the workspace, or throws with herdr's reason after closing anything it opened. */
  function start(entry: Entry, worktrees: WorktreeRef[], dir: string): string {
    const key = entry.ticket.key;
    const name = herdrName(key);
    const run = (args: string[]) => herdr(args);
    const opened = openPane(run, name, {}, worktrees[0].path, session);
    if ("refusal" in opened) throw new Error(opened.refusal);
    const tail = [firstPrompt(dir), ...workerFlags({ name: key, model: entry.model, effort: entry.effort, addDirs: [dir, ...worktrees.slice(1).map((w) => w.path)] })];
    try {
      herdr(agentStartArgs(name, "claude", opened.pane, tail, session), START_TIMEOUT_MS);
    } catch (err) {
      // A start can outlast its timeout and still succeed: ask the listing before calling it a failure.
      const listed = readAgents(run, session)?.find((agent) => agent.label === name);
      if (listed === undefined || listed.status === "unknown") {
        throw new Error(`herdr could not start Claude for ${key} (${herdrRefusal(err)})${closedNote(run, opened.workspace, session)}`);
      }
    }
    return opened.workspace;
  }

  /** Answer a start dialog on this run's pane, if one is showing and the run has answers left. True when it answered. */
  function answerStartDialog(entry: Entry): boolean {
    const name = herdrName(entry.ticket.key);
    const count = answered.get(name) ?? 0;
    if (count >= MAX_DIALOG_ANSWERS) return false;
    let screen: string;
    try {
      screen = herdr(["--session", settings.herdrSession, "agent", "read", name, "--source", "visible"]);
    } catch {
      return false;
    }
    if (!isStartDialog(screen, worktreePath(settings.worktreeRoot, entry.ticket.key, entry.repos[0]))) return false;
    herdr(["--session", settings.herdrSession, "agent", "send-keys", name, "down", "enter"]);
    answered.set(name, count + 1);
    return true;
  }

  /** Read each live run's status once and record any that has ended. */
  function watch(): void {
    const agents = readAgents((args) => herdr(args), session);
    if (agents === null) return;
    const status = new Map(agents.map((agent) => [agent.label, agent.status]));
    for (const [workspace, id] of readSessionIds()) claudeSessions.set(workspace, id);
    for (const entry of store.get().entries.filter((e) => e.phase === "running")) {
      const key = entry.ticket.key;
      const seen = status.get(herdrName(key));
      if (seen === undefined || seen === "unknown") {
        const count = (misses.get(key) ?? 0) + 1;
        misses.set(key, count);
        if (count >= MISSES_TO_CRASH) end(entry, { kind: "crashed", reason: seen === undefined ? "its herdr workspace is gone" : "herdr finds no agent in its workspace" });
        continue;
      }
      misses.delete(key);
      if (!["working", "idle", "done"].includes(seen) && answerStartDialog(entry)) continue;
      update((queue) => observe(queue, key, seen));
      const current = store.get().entries.find((e) => e.ticket.key === key) ?? entry;
      const outcomePath = join(ticketDir(settings, key), OUTCOME_FILE);
      if ((seen === "idle" || seen === "done") && existsSync(outcomePath)) end(current, parseOutcome(readFileSync(outcomePath, "utf8")));
      else if (seen === "done" || (seen === "idle" && current.seenWorking === true)) end(current, { kind: "no-outcome" });
    }
  }

  function end(entry: Entry, outcome: Outcome): void {
    if (entry.workspace) closedNote((args) => herdr(args), entry.workspace, session);
    const id = entry.workspace === undefined ? undefined : claudeSessions.get(entry.workspace);
    update((queue) => finish(queue, entry.ticket.key, outcome, now(), countTokens(id === undefined ? null : findTranscript(transcripts, id))));
    misses.delete(entry.ticket.key);
  }

  /** Just after a start, answer the start dialogs as they appear, rather than one per tick: a few short waits, then the tick takes over. */
  function settleStart(entry: Entry): void {
    const sleep = deps.sleep ?? ((ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
    for (let attempt = 0; attempt < 6; attempt += 1) {
      sleep(1500);
      const status = readAgents((args) => herdr(args), session)?.find((agent) => agent.label === herdrName(entry.ticket.key))?.status;
      if (status === "working" || status === "idle" || status === "done") return;
      answerStartDialog(entry);
    }
  }

  /** Start what there is room for. Each start is recorded before it begins, so a second tick cannot start it again. */
  async function fill(): Promise<void> {
    const { load, cores } = (deps.load ?? (() => ({ load: loadavg()[0], cores: availableParallelism() })))();
    for (const entry of nextStarts(store.get(), load, cores)) {
      update((queue) => markStarting(queue, entry.ticket.key, now()));
      try {
        const { worktrees, dir } = await prepare(entry);
        const workspace = start(entry, worktrees, dir);
        update((queue) => markRunning(queue, entry.ticket.key, workspace));
        settleStart(entry);
      } catch (err) {
        update((queue) => finish(queue, entry.ticket.key, { kind: "crashed", reason: String((err as Error)?.message ?? err).split("\n")[0] }, now()));
      }
    }
  }

  /** Stop a live run: close its workspace and keep its worktrees. */
  function stop(key: string): void {
    const entry = store.get().entries.find((e) => e.ticket.key === key && isLive(e));
    if (entry !== undefined) end(entry, { kind: "stopped" });
  }

  /**
   * After a restart: a run the file says is live but herdr does not list is recorded as crashed; one still listed carries on. A run caught
   * between `starting` and `running` has no workspace on record, so it is crashed too: its worktree is kept and it can be retried.
   */
  function reconcile(): void {
    const agents = readAgents((args) => herdr(args), session);
    if (agents === null) return;
    const listed = new Set(agents.map((agent) => agent.label));
    for (const entry of store.get().entries.filter(isLive)) {
      if (entry.phase === "starting" || !listed.has(herdrName(entry.ticket.key))) {
        update((queue) => finish(queue, entry.ticket.key, { kind: "crashed", reason: "the pool restarted while it was running" }, now()));
      }
    }
  }

  /**
   * The session's herdr server answers, starting it when it does not. Ticket mode's session is its own, so no unit keeps it running the way the
   * org's is kept: the first pool to need it starts it, and it outlives the pool, so workers survive a restart of the board.
   */
  function ensureSession(): void {
    const run = (args: string[]) => herdr(args);
    if (readAgents(run, session) !== null) return;
    (deps.startServer ?? defaultStartServer)(settings.herdrSession);
    const sleep = deps.sleep ?? ((ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms));
    for (let attempt = 0; attempt < 20; attempt += 1) {
      sleep(250);
      if (readAgents(run, session) !== null) return;
    }
    throw new Error(`herdr's ${settings.herdrSession} session did not start; start it with: herdr --session ${settings.herdrSession} server`);
  }

  let busy = false;
  /** One pass: watch the live runs, then fill free slots. Passes never overlap. */
  async function tick(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      watch();
      await fill();
    } finally {
      busy = false;
    }
  }

  return { tick, stop, reconcile, ensureSession };
}

export type Pool = ReturnType<typeof createPool>;
