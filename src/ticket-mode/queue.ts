// @ts-check
// module: ticket mode's queue -- what you queued, what is running, and how each run ended; pure transitions plus one file
//
// THE PERSON CHOOSES EVERY ENTRY. Nothing is added by a filter or a label: an entry exists because someone selected the ticket on the board (or
// named it to `ticket:serve`'s API) with the repositories, model and effort it runs with. The queue runs in the order entries were added.
//
// EVERY TRANSITION IS A PURE FUNCTION of the queue and returns a new one, so the board, the pool and the tests share one set of rules. The server is
// the only writer of the file, which it replaces whole by rename, so a reader never sees half of one.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Ticket } from "./source.ts";

/** How a finished run ended. A worker writes the first three; the pool decides the rest. */
export type Outcome =
  | Readonly<{ kind: "draft-pr"; prs: readonly Readonly<{ repo: string; url: string }>[] }>
  | Readonly<{ kind: "wrong-repo"; where: string }>
  | Readonly<{ kind: "needs-human"; reason: string }>
  | Readonly<{ kind: "no-outcome" }>
  | Readonly<{ kind: "crashed"; reason: string }>
  | Readonly<{ kind: "stopped" }>;

export type Phase = "queued" | "starting" | "running" | "finished";

export type Entry = Readonly<{
  ticket: Ticket;
  repos: readonly string[];
  model: string;
  effort: string;
  phase: Phase;
  queuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** The herdr workspace the run's agent is in, while it has one. */
  workspace?: string;
  /** Seen `working` at least once, so a later `idle` means a finished turn and not a prompt not yet taken. */
  seenWorking?: boolean;
  /** The agent is in a state that needs a person (a dialog, a prompt), as herdr reported it. */
  waiting?: boolean;
  outcome?: Outcome;
  tokens?: Readonly<{ input: number; output: number }>;
}>;

export type Queue = Readonly<{ entries: readonly Entry[]; max: number }>;

export type RunChoice = Readonly<{ repos: readonly string[]; model: string; effort: string }>;

const LIVE: ReadonlySet<Phase> = new Set(["starting", "running"]);

export const isLive = (entry: Entry): boolean => LIVE.has(entry.phase);

function replace(queue: Queue, key: string, change: (entry: Entry) => Entry): Queue {
  return { ...queue, entries: queue.entries.map((entry) => (entry.ticket.key === key ? change(entry) : entry)) };
}

const find = (queue: Queue, key: string): Entry | undefined => queue.entries.find((entry) => entry.ticket.key === key);

/** Add each ticket not already on the queue, after the last entry. A ticket already there is left as it is. A choice with no repository is refused. */
export function enqueue(queue: Queue, tickets: readonly Ticket[], choice: RunChoice, now: number): Queue {
  if (choice.repos.length === 0) throw new Error("choose at least one repository to queue a ticket to");
  const fresh = tickets.filter((ticket) => find(queue, ticket.key) === undefined);
  return { ...queue, entries: [...queue.entries, ...fresh.map((ticket): Entry => ({ ticket, ...choice, phase: "queued", queuedAt: now }))] };
}

/** Change a queued entry's repositories, model or effort. An entry that has started keeps what it started with. */
export function amend(queue: Queue, key: string, choice: Partial<RunChoice>): Queue {
  if (choice.repos !== undefined && choice.repos.length === 0) throw new Error("an entry needs at least one repository");
  return replace(queue, key, (entry) => (entry.phase === "queued" ? { ...entry, ...choice } : entry));
}

/** Take a queued entry off. A live or finished one stays: stop the first, and the second is a record. */
export function remove(queue: Queue, key: string): Queue {
  return { ...queue, entries: queue.entries.filter((entry) => entry.ticket.key !== key || entry.phase !== "queued") };
}

/** Put a finished entry back at the end of the queue. A draft pull request is not retried: it is the result. */
export function retry(queue: Queue, key: string, now: number): Queue {
  const entry = find(queue, key);
  if (entry === undefined || entry.phase !== "finished" || entry.outcome?.kind === "draft-pr") return queue;
  const { ticket, repos, model, effort } = entry;
  return { ...queue, entries: [...queue.entries.filter((e) => e.ticket.key !== key), { ticket, repos, model, effort, phase: "queued", queuedAt: now }] };
}

export function setMax(queue: Queue, max: number): Queue {
  if (!Number.isInteger(max) || max < 1) throw new Error(`max must be a whole number of 1 or more, not ${max}`);
  return { ...queue, max };
}

export function markStarting(queue: Queue, key: string, now: number): Queue {
  return replace(queue, key, (entry) => ({ ...entry, phase: "starting", startedAt: now }));
}

export function markRunning(queue: Queue, key: string, workspace: string): Queue {
  return replace(queue, key, (entry) => ({ ...entry, phase: "running", workspace }));
}

/** What herdr says the agent is doing: `working` marks it seen, and any status but the four ordinary ones means it is waiting on a person. */
export function observe(queue: Queue, key: string, status: string): Queue {
  return replace(queue, key, (entry) => ({
    ...entry,
    seenWorking: entry.seenWorking === true || status === "working",
    waiting: !["working", "idle", "done", "unknown"].includes(status),
  }));
}

export function finish(queue: Queue, key: string, outcome: Outcome, now: number, tokens?: Entry["tokens"]): Queue {
  return replace(queue, key, (entry) => ({ ...entry, phase: "finished", outcome, finishedAt: now, workspace: undefined, waiting: false, ...(tokens ? { tokens } : {}) }));
}

/**
 * The queued entries to start now, in queue order: none while the host is loaded past its cores (`wake.ts`'s `hostLoadRefusal` rule, where
 * exactly equal does not refuse), and otherwise as many as the free slots allow.
 */
export function nextStarts(queue: Queue, load: number, cores: number): Entry[] {
  if (load > cores) return [];
  const free = queue.max - queue.entries.filter(isLive).length;
  return queue.entries.filter((entry) => entry.phase === "queued").slice(0, Math.max(0, free));
}

export function emptyQueue(max: number): Queue {
  return { entries: [], max };
}

/** The queue on disk, or an empty one with `max` when there is no file yet. */
export function loadQueue(path: string, max: number): Queue {
  if (!existsSync(path)) return emptyQueue(max);
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Queue;
  return { entries: parsed.entries ?? [], max: parsed.max ?? max };
}

/** Replace the file whole: write beside it, then rename over it. */
export function saveQueue(path: string, queue: Queue): void {
  mkdirSync(dirname(path), { recursive: true });
  const next = `${path}.next`;
  writeFileSync(next, `${JSON.stringify(queue, null, 2)}\n`);
  renameSync(next, path);
}
