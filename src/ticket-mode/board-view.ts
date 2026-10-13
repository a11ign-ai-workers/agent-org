// @ts-check
// module: the ticket board page's logic -- which tickets show, how they group, what can be selected, what status a run has -- as pure functions
//
// WRITTEN HERE, IN TYPESCRIPT, SO ITS TESTS RUN IT, AND SENT TO THE BROWSER WITH THE TYPES STRIPPED (`server.ts` serves it as `/board-view.js`
// through Node's own `stripTypeScriptTypes`). The page (`ui.html`) only draws what these functions return and wires the clicks. So it imports
// nothing and uses no Node API: it must run as it is in a browser.
//
// A RULE THE PAGE AND THE POOL BOTH APPLY IS DEFINED HERE ONCE. Which outcomes hand a ticket back (`HANDED_BACK`) and what a parked run is
// (`isParked`) decide what the board shows and what the pool does, so `queue.ts` and `pool.ts` import them from here rather than restating them.

/** The fields of a ticket the board shows. */
export type ViewTicket = Readonly<{ key: string; title: string; status: string; statusOrder: number; priority: number; project: string | null }>;

/** The fields of a queue entry the board reads. */
export type ViewEntry = Readonly<{
  ticket: Readonly<{ key: string }>; phase: string; outcome?: Readonly<{ kind: string }>; waiting?: boolean; trackerState?: string;
  queuedAt?: number; startedAt?: number; finishedAt?: number; workspace?: string; pane?: string;
}>;

/** Where a browser keeps the view's settings between visits; `localStorage` in the page. */
export type Storage = Readonly<{ getItem(name: string): string | null; setItem(name: string, value: string): void }>;

/** The project chip a ticket with no project falls under. */
export const NO_PROJECT = "(no project)";

export const projectOf = (ticket: ViewTicket): string => ticket.project ?? NO_PROJECT;

/** The tickets to show: in one of the chosen projects (any, when none is chosen) and matching every search word. */
export function visibleTickets(tickets: readonly ViewTicket[], projects: ReadonlySet<string>, search: string): ViewTicket[] {
  const words = search.trim().toLowerCase();
  return tickets.filter((t) => (projects.size === 0 || projects.has(projectOf(t)))
    && (words === "" || `${t.key} ${t.title} ${t.project ?? ""}`.toLowerCase().includes(words)));
}

/** Each project and how many tickets it holds, most first, then by name. */
export function projectCounts(tickets: readonly ViewTicket[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const t of tickets) counts.set(projectOf(t), (counts.get(projectOf(t)) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** The tickets grouped by status, in the workflow's order, each group by priority (urgent first, none last). */
export function groupByStatus(tickets: readonly ViewTicket[]): [string, ViewTicket[]][] {
  const rank = (p: number) => (p === 0 ? 5 : p);
  const groups = new Map<string, ViewTicket[]>();
  for (const t of [...tickets].sort((a, b) => a.statusOrder - b.statusOrder || rank(a.priority) - rank(b.priority))) {
    groups.set(t.status, [...(groups.get(t.status) ?? []), t]);
  }
  return [...groups];
}

/** A ticket can be selected when it is not on the queue already. */
export const selectable = (ticket: ViewTicket, entries: readonly ViewEntry[]): boolean => !entries.some((e) => e.ticket.key === ticket.key);

/** `values` with `value` added, or taken out when it was there. A new set: the old one is left as it was. */
export function toggled<T>(values: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(values);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** A remembered set, or an empty one when there is none or the browser refuses storage. */
export function recall(storage: Storage | null, name: string): Set<string> {
  try {
    const saved = JSON.parse(storage?.getItem(name) ?? "[]");
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch {
    return new Set();
  }
}

/** Remember a set; a browser that refuses storage just forgets it. */
export function remember(storage: Storage | null, name: string, values: ReadonlySet<string>): void {
  try {
    storage?.setItem(name, JSON.stringify([...values]));
  } catch {
    // storage refused: the view works without it
  }
}

/** A run's status on the board, after GitHub's Actions runs: each has its own icon and filter. */
export type RunStatus = "needs-you" | "working" | "queued" | "awaiting-review" | "completed" | "failed" | "cancelled";

/** Every status, in the order the filters list them: what needs a person first, what is settled last. */
export const RUN_STATUSES: readonly Readonly<{ status: RunStatus; label: string }>[] = [
  { status: "needs-you", label: "Needs you" },
  { status: "working", label: "In progress" },
  { status: "queued", label: "Queued" },
  { status: "awaiting-review", label: "Awaiting review" },
  { status: "completed", label: "Completed" },
  { status: "failed", label: "Failed" },
  { status: "cancelled", label: "Cancelled" },
];

/**
 * Outcomes that hand the ticket back to a person: the worker could not decide, the work belongs elsewhere, or it stopped without saying. The
 * board shows such a run as Needs you, and the pool parks it rather than closing its workspace, so the person can answer the agent there.
 */
export const HANDED_BACK: ReadonlySet<string> = new Set(["needs-human", "wrong-repo", "no-outcome"]);

/**
 * A run's status. The tracker's word wins once the run has finished: a ticket it completed is done (Linear completes it when its pull request
 * merges) and one it canceled is cancelled, whatever the run ended in. Before that, the outcome decides.
 */
export function runStatus(entry: ViewEntry): RunStatus {
  if (entry.phase === "queued") return "queued";
  if (entry.phase !== "finished") return entry.waiting ? "needs-you" : "working";
  if (entry.trackerState === "completed") return "completed";
  if (entry.trackerState === "canceled" || entry.trackerState === "duplicate") return "cancelled";
  const kind = entry.outcome?.kind ?? "";
  if (kind === "draft-pr") return "awaiting-review";
  if (HANDED_BACK.has(kind)) return "needs-you";
  return kind === "stopped" ? "cancelled" : "failed";
}

/** How many runs have each status. */
export function statusCounts(entries: readonly ViewEntry[]): Map<RunStatus, number> {
  const counts = new Map<RunStatus, number>(RUN_STATUSES.map(({ status }) => [status, 0]));
  for (const status of entries.map(runStatus)) counts.set(status, (counts.get(status) ?? 0) + 1);
  return counts;
}

/** The runs a filter shows (every run for `null`), the most recently active first, as GitHub lists its runs. */
export function runsShown<T extends ViewEntry>(entries: readonly T[], filter: RunStatus | null): T[] {
  const latest = (entry: ViewEntry) => entry.finishedAt ?? entry.startedAt ?? entry.queuedAt ?? 0;
  return entries.filter((entry) => filter === null || runStatus(entry) === filter).sort((a, b) => latest(b) - latest(a));
}

/** A parked run: a finished one that kept its herdr workspace, so a person can still answer its agent there. It holds no slot. */
export const isParked = (entry: ViewEntry): boolean => entry.phase === "finished" && entry.workspace !== undefined;

/** What a person can do to a run from the board. */
export type RunAction = "remove" | "stop" | "retry" | "close";

/**
 * The actions a run offers. A queued run can be removed and a live one stopped. A finished run that kept its workspace (parked) can be closed,
 * and only once it is closed can it be retried. A draft pull request and a completed ticket are results, so they are not retried.
 */
export function runActions(entry: ViewEntry): RunAction[] {
  if (entry.phase === "queued") return ["remove"];
  if (entry.phase !== "finished") return ["stop"];
  if (isParked(entry)) return ["close"];
  return entry.outcome === undefined || entry.outcome.kind === "draft-pr" || runStatus(entry) === "completed" ? [] : ["retry"];
}

/**
 * The web address of a run's live terminal: `template` (the host file's `tickets.terminal`) with the run's `{workspace}`, `{pane}` and `{key}`
 * filled in, each encoded for a URL. Null when the machine serves no terminal or the run holds no pane.
 */
export function terminalLink(template: string | null, entry: ViewEntry): string | null {
  if (template === null || entry.workspace === undefined || entry.pane === undefined) return null;
  const values: Readonly<Record<string, string>> = { workspace: entry.workspace, pane: entry.pane, key: entry.ticket.key };
  return template.replace(/\{(workspace|pane|key)\}/g, (_, name: string) => encodeURIComponent(values[name]));
}

/** The Queue button's words for `count` selected tickets. */
export const queueLabel = (count: number): string => (count === 0 ? "Select tickets to queue" : `Queue ${count} ticket${count === 1 ? "" : "s"}`);
