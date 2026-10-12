// @ts-check
// A LEAF, like `claim-stall.ts`: `node:*` only, so `work-tick.ts` takes it without a cycle and a test imports it without a gate.
//
// A TICK THAT IS SLOW IS RECORDED, A TICK THAT IS KILLED TELLS `ceo` (a11ign/a11ign#3567; agent-org#1208 split the two). On 2026-10-04 a tick ran 10 min
// 13 s and was killed by `TimeoutStartSec`, and the only trace was a journal line nobody reads. The signal has two halves, because a tick that is killed
// cannot report itself from inside:
//
//   SLOW    the tick that finishes over {@link TICK_SLOW_SECONDS} reads its own `tick-cost` line and EDITS ONE STANDING COMMENT with the last 24 h of
//           ticks (their p50/p95 wall and the slow ones in a table). It wakes nobody: six wakes in 45 minutes was spend on something `ceo` cannot act
//           on turn by turn (chairman, a11ign#928), and `ceo` reads the trend daily. A write that is refused is retried by the next tick and said by
//           `org-health`; it never becomes a wake per overrun.
//   KILLED  every tick leaves a START MARKER and clears it when its process ends by itself. A marker still there when the next tick starts was
//           left by a process that was signalled (the timeout, a restart), so the NEXT tick reads it and wakes `ceo`. It left no cost line and so no
//           trend, which is why it is the half that still wakes.
//
// WHY A MARKER AND NOT `OnFailure=` (the row allows either, if the choice is said). `OnFailure=` reports without waiting for a tick, which is the
// one thing it has over a marker, and it costs a second unit in `host/` on every host, a unit that has to reach `ceo` by itself with no ledger and
// no `wake`. The marker reuses the delivery that already exists (`wake` and its ledger, keyed on `causeKey`) and needs nothing installed. THE GAP,
// stated: a kill during `ExecStartPre` (`pnpm run primary:update`) happens before this process exists, so no marker was written and the next tick
// cannot see it; the unit's own failure is read by `incident:gate-crash`.
//
// ONE REPORT PER KILLED TICK, BY CONSTRUCTION. The order is keyed on the tick's start time, which `wake`'s ledger already refuses to deliver twice, and
// the marker is replaced by the tick that reads it, so a second reader finds a marker it did not write only if another tick was killed.
import { mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";

/** Over this many seconds from the unit starting to the tick ending, the tick is slow. The row names it; 180 is three timer intervals' worth of nobody looking. */
export const TICK_SLOW_SECONDS = 180;

/**
 * The cause the killed-tick order carries. The order spells it as a LITERAL (`cause: "tick-overran"`) because `worker-profile.test.ts` finds the causes a file
 * emits by that text, and a constant it cannot read. A slow tick carries no order (agent-org#1208), so `TICK_KILLED` is the cause's one subject that wakes.
 */
export const TICK_OVERRAN = "tick-overran";
export const TICK_KILLED = "tick-killed";

/** The marker beside the ledger and the cost file, so one directory holds the tick's runtime state. */
export const TICK_MARKER_FILE = "tick-running.json";
/** The record's own state, beside the same ledger: the standing comment's id, and whether the last write was refused. */
export const TICK_RECORD_FILE = "tick-record.json";
/** The first line of the one standing comment, so the tick finds it again after its cached id is lost. A line of its own that nothing else writes. */
export const TICK_RECORD_MARKER = "<!-- tick-record: agent-org#1208 -->";
/** The project declaration's key under `units` (beside `traceWeeklyIssue`): the issue number of the standing row, in the FIRST declared tracker's repository. */
export const TICK_RECORD_ISSUE_KEY = "tickRecordIssue";
/** The window the record's p50/p95 and table cover: the chairman's two health signals are daily. */
export const TICK_RECORD_WINDOW_MS = 24 * 60 * 60 * 1000;
/** Slow ticks the table shows, newest first; the count of the rest is said, so a bad day cannot grow the comment past GitHub's body limit. */
export const TICK_RECORD_TABLE_ROWS = 30;

const MS_PER_SECOND = 1000;
const WALL_DECIMALS = 1;

/** @param {string} ledgerPath @returns {string} */
export function tickMarkerPath(ledgerPath: string): string {
  return join(dirname(ledgerPath), TICK_MARKER_FILE);
}

/** @param {string} ledgerPath @returns {string} */
export function tickRecordPath(ledgerPath: string): string {
  return join(dirname(ledgerPath), TICK_RECORD_FILE);
}

/**
 * The threshold in force: the constant, unless `A11Y_TICK_SLOW_SECONDS` names another positive number. The override is the TEST'S seam -- a test cannot
 * wait three minutes -- and nothing in `host/` sets it.
 * @param {NodeJS.ProcessEnv} [env] @returns {number}
 */
export function slowThresholdSeconds(env: NodeJS.ProcessEnv = process.env): number {
  const named = Number(env.A11Y_TICK_SLOW_SECONDS);
  return Number.isFinite(named) && named > 0 ? named : TICK_SLOW_SECONDS;
}

export type TickOrder = { session: string, cause: string, subject: string, discriminator: string, prompt: string, causeKey: string };
export type Marker = { at: number, pid: number | null, unreadable: boolean };

// ---- THE START MARKER ------------------------------------------------------------------------------------------------------------------------

/** @param {string} path @param {{ at: number, pid: number }} marker */
export function writeStartMarker(path: string, marker: { at: number; pid: number; }) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(marker)}\n`);
}

/**
 * Clears the marker only if THIS process wrote it: a tick run by hand beside the timer's must not clear the timer's, and a marker replaced by a later
 * tick is that tick's. Idempotent, and a marker that is gone or unreadable is left to the reader of it.
 * @param {string} path @param {number} pid
 */
export function clearOwnMarker(path: string, pid: number) {
  if (readMarker(path)?.pid === pid) rmSync(path, { force: true });
}

/**
 * The marker, or `null` when there is none. A file that is THERE and cannot be parsed is a marker too, with `unreadable` set and the file's own
 * modification time as its `at`: absence of a reading is not absence of a killed tick, and a tick killed mid-write is exactly the one that leaves one.
 * Any other failure to read (a permission, a directory in its place) throws, and the caller says so.
 * @param {string} path @returns {Marker | null}
 */
export function readMarker(path: string): Marker | null {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  try {
    const { at, pid } = JSON.parse(text);
    if (Number.isFinite(at) && Number.isInteger(pid)) return { at, pid, unreadable: false };
  } catch {
    // Falls through to the same answer a parseable file with the wrong fields gets: a marker whose author is unknown.
  }
  return { at: statSync(path).mtimeMs, pid: null, unreadable: true };
}

/** @param {number} pid @returns {boolean} */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * The marker a DEAD tick left, or `null`. A marker whose process is still alive is a tick running beside this one (one started by hand), not a killed
 * one, and is not reported. The cost of the liveness test, stated: a pid reused by an unrelated process within the interval hides one killed tick.
 * @param {string} path @param {{ alive?: (pid: number) => boolean }} [sources] @returns {Marker | null}
 */
export function readKilledTick(path: string, { alive = processAlive }: { alive?: (pid: number) => boolean; } = {}): Marker | null {
  const marker = readMarker(path);
  if (marker === null) return null;
  return marker.pid !== null && alive(marker.pid) ? null : marker;
}

// ---- THE TWO ORDERS --------------------------------------------------------------------------------------------------------------------------

const seconds = (ms: number) => (ms / MS_PER_SECOND).toFixed(WALL_DECIMALS);

/** @param {number} ms */
const clock = (ms: number) => new Date(ms).toISOString();

// ---- THE RECORD (agent-org#1208) -------------------------------------------------------------------------------------------------------------

/** The part of a `tick-cost` line the record reads. */
export type CostLine = { at: number; wallMs: number; prestartMs?: number | null; cpuMs: { self: number; children: number }; phases: Record<string, { wallMs: number; cpuMs?: number }> };

/** One slow tick as the table shows it: `startedAt` is when the unit's process began, `wallMs` includes `ExecStartPre`. */
export type SlowTick = { startedAt: number; wallMs: number; cpuMs: number; phase: string; phaseWallMs: number; phaseCpuMs: number | null };
export type TickRecord = { ticks: number; p50Ms: number | null; p95Ms: number | null; slow: SlowTick[] };

/** The wall the limit is judged on: the UNIT's, from systemd starting it to this process ending (`prestartMs` is `ExecStartPre`, which `TimeoutStartSec` counts). */
const wallOf = (line: CostLine) => line.wallMs + (line.prestartMs ?? 0);

/** Over the limit, not at it. @param {CostLine} line @param {number} thresholdSeconds */
export function isSlowTick(line: CostLine, thresholdSeconds: number = TICK_SLOW_SECONDS): boolean {
  return wallOf(line) > thresholdSeconds * MS_PER_SECOND;
}

/**
 * Nearest-rank percentile of an ASCENDING list: the smallest value with at least `p` percent of the list at or below it. `null` for an empty list, never 0.
 * @param {number[]} ascending @param {number} p 0..100
 */
export function percentile(ascending: number[], p: number): number | null {
  if (ascending.length === 0) return null;
  return ascending[Math.max(0, Math.ceil((p / 100) * ascending.length) - 1)];
}

/**
 * The cost file's lines that are cost lines. A line that does not parse or lacks the fields is skipped: the file is cut to its newest half past a size, so its
 * first line may be a fragment, and a record that threw on it would be unwritten for as long as the fragment stayed.
 * @param {string} text @returns {CostLine[]}
 */
export function parseCostLines(text: string): CostLine[] {
  const lines: CostLine[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") continue;
    try {
      const line = JSON.parse(raw);
      if (Number.isFinite(line?.at) && Number.isFinite(line?.wallMs) && line.cpuMs && typeof line.phases === "object") lines.push(line);
    } catch {
      // not a cost line
    }
  }
  return lines;
}

/**
 * THE RECORD OF THE WINDOW ENDING AT `now`: every tick of the cost file inside it for the p50/p95 wall (all ticks, so a slow one is read against the ones that were
 * not), and the ones over the limit for the table. `current` is this tick's own line, which the file may not hold if appending it failed, and is not counted twice.
 * @param {CostLine[]} lines @param {{ now: number, thresholdSeconds?: number, current?: CostLine | null }} at @returns {TickRecord}
 */
export function tickRecordOf(lines: CostLine[], { now, thresholdSeconds = TICK_SLOW_SECONDS, current = null }: { now: number; thresholdSeconds?: number; current?: CostLine | null; }): TickRecord {
  const seen = new Set<number>();
  const inWindow = [...lines, ...(current === null ? [] : [current])]
    .filter((line) => now - line.at <= TICK_RECORD_WINDOW_MS && !seen.has(line.at) && seen.add(line.at))
    .sort((a, b) => b.at - a.at);
  const walls = inWindow.map(wallOf).sort((a, b) => a - b);
  const slow = inWindow.filter((line) => isSlowTick(line, thresholdSeconds)).map((line): SlowTick => {
    const [phase, took] = Object.entries(line.phases).reduce((longest, entry) => (entry[1].wallMs > longest[1].wallMs ? entry : longest), ["(none)", { wallMs: 0 } as { wallMs: number; cpuMs?: number }]);
    return { startedAt: Math.round(line.at - line.wallMs), wallMs: wallOf(line), cpuMs: line.cpuMs.self + line.cpuMs.children, phase, phaseWallMs: took.wallMs, phaseCpuMs: took.cpuMs ?? null };
  });
  return { ticks: inWindow.length, p50Ms: percentile(walls, 50), p95Ms: percentile(walls, 95), slow };
}

/**
 * The standing comment's whole body. It is replaced, never appended to, so the row holds one comment however many ticks overran; the p50/p95 are over every tick
 * of the window and say so, and a `null` is "no tick", not a zero.
 * @param {TickRecord} record @param {{ now: number, thresholdSeconds?: number, costPath: string }} where @returns {string}
 */
export function renderTickRecord(record: TickRecord, { now, thresholdSeconds = TICK_SLOW_SECONDS, costPath }: { now: number; thresholdSeconds?: number; costPath: string; }): string {
  const shown = record.slow.slice(0, TICK_RECORD_TABLE_ROWS);
  const secs = (ms: number | null) => (ms === null ? "n/a" : seconds(ms));
  return [
    TICK_RECORD_MARKER,
    `**Tick record** (agent-org#1208), updated ${clock(now)}. One comment, edited in place by the tick; a slow tick wakes no session, and a KILLED tick still does (\`tick-overran\`).`,
    "",
    `Last 24 h, read from \`${costPath}\`: **${record.ticks}** ticks, wall **p50 ${secs(record.p50Ms)} s, p95 ${secs(record.p95Ms)} s** (every tick, nearest rank, \`ExecStartPre\` included); `
      + `**${record.slow.length}** over the ${thresholdSeconds} s limit.`,
    "",
    ...(shown.length === 0 ? ["No tick in the window was over the limit."] : [
      "| started (UTC) | wall s | CPU s | longest phase | phase wall s | phase CPU s |",
      "| --- | ---: | ---: | --- | ---: | ---: |",
      ...shown.map((tick) => `| ${clock(tick.startedAt)} | ${seconds(tick.wallMs)} | ${seconds(tick.cpuMs)} | \`${tick.phase}\` | ${seconds(tick.phaseWallMs)} | ${secs(tick.phaseCpuMs)} |`),
      ...(record.slow.length > shown.length ? ["", `…and ${record.slow.length - shown.length} older slow ticks in the window.`] : []),
    ]),
    "",
  ].join("\n");
}

// ---- THE RECORD'S STATE, AND ITS WRITE -------------------------------------------------------------------------------------------------------

/** `commentId` is the standing comment once known; `unwritten` is set from the first refused write until one lands, with the reason. */
export type TickRecordState = { commentId: number | null; unwritten: { since: number; why: string } | null };

/**
 * The state, or the empty one when there is no file. A file that is there and cannot be read is `unwritten` with that as the reason: absence of a reading is not a
 * written record, and the next tick rewrites the file whole.
 * @param {string} path @param {number} [now] @returns {TickRecordState}
 */
export function readTickRecordState(path: string, now: number = Date.now()): TickRecordState {
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { commentId: null, unwritten: null };
    return { commentId: null, unwritten: { since: now, why: `the record state at ${path} could not be read (${String((error as Error).message).split("\n")[0]})` } };
  }
  try {
    const { commentId, unwritten } = JSON.parse(text);
    return {
      commentId: Number.isInteger(commentId) ? commentId : null,
      unwritten: unwritten && Number.isFinite(unwritten.since) && typeof unwritten.why === "string" ? { since: unwritten.since, why: unwritten.why } : null,
    };
  } catch {
    return { commentId: null, unwritten: { since: now, why: `the record state at ${path} is not valid JSON` } };
  }
}

/** Written whole through a rename, so a tick killed mid-write leaves the old state and never half of one. @param {string} path @param {TickRecordState} state */
export function writeTickRecordState(path: string, state: TickRecordState) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state)}\n`);
  renameSync(temporary, path);
}

/**
 * THE ONE LINE `org-health` carries while the record is unwritten, or `null` when it is written (or has never been due). `since` is the first refused write.
 * @param {TickRecordState} state @param {number} now @returns {string | null}
 */
export function tickRecordUnwrittenLine(state: TickRecordState, now: number): string | null {
  if (state.unwritten === null) return null;
  const minutes = Math.max(0, Math.round((now - state.unwritten.since) / (60 * MS_PER_SECOND)));
  return `the tick record is unwritten since ${clock(state.unwritten.since)} (${minutes} min): ${state.unwritten.why}. Slow ticks are not being recorded and wake nobody.`;
}

/**
 * The standing row, from the project declaration's text: `units.tickRecordIssue` in the FIRST declared tracker's repository (the heartbeat's own rule: one object,
 * one repository). Never searched for by title. A reason, and never a default, when it is absent or malformed.
 * @param {string} text @returns {{ repo: string, issue: number } | { refusal: string }}
 */
export function tickRecordTargetFrom(text: string): { repo: string; issue: number } | { refusal: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { refusal: "the project declaration is not valid JSON" };
  }
  const repo = Array.isArray(parsed?.tracker) ? parsed.tracker[0]?.repo : undefined;
  if (typeof repo !== "string" || repo === "") return { refusal: "the project declaration names no tracker repository" };
  const issue = parsed?.units?.[TICK_RECORD_ISSUE_KEY];
  if (!Number.isInteger(issue) || issue <= 0) return { refusal: `the project declaration does not declare units.${TICK_RECORD_ISSUE_KEY} (the standing row, a positive integer)` };
  return { repo, issue };
}

/** The standing comment, as the tick reaches it: injected, because this file names no `gh` (`gh-call-ratchet.test.ts`). `find` and `post` answer the comment's id, or `null` when unread. */
export type RecordIo = { find: () => number | null; post: (body: string) => number | null; edit: (id: number, body: string) => void };

export type RecordOutcome = "not-due" | "written" | "unwritten";

/**
 * THE SLOW TICK'S RECORD, AND THE RETRY OF ONE THAT FAILED. Due when this tick is slow, or when an earlier write is still unwritten (so a refused write is retried by
 * the very next tick, slow or not). A fast tick with nothing owed writes nothing, so the row is touched only when there is something to say.
 *
 * A REFUSED WRITE IS A STATE AND NEVER A WAKE: it sets `unwritten` in the state file, `org-health` reads it (`tickRecordUnwrittenLine`), and the next tick tries again. The
 * fallback this replaced, an order to `ceo` per overrun, is what the row removed. NEVER THROWS: a tick that did its work must not become a failure because its record
 * could not be written. `io` is `{ refusal }` when the standing row is not declared, which is a refused write like any other.
 *
 * @param {{ line: CostLine | null, costText: string, now: number, thresholdSeconds?: number, costPath: string, statePath: string, io: RecordIo | { refusal: string }, say?: (text: string) => void }} tick
 * @returns {RecordOutcome}
 */
export function recordSlowTick({ line, costText, now, thresholdSeconds = TICK_SLOW_SECONDS, costPath, statePath, io, say = (text) => process.stderr.write(text) }:
  { line: CostLine | null; costText: string; now: number; thresholdSeconds?: number; costPath: string; statePath: string; io: RecordIo | { refusal: string }; say?: (text: string) => void }): RecordOutcome {
  const state = readTickRecordState(statePath, now);
  const slow = line !== null && isSlowTick(line, thresholdSeconds);
  if (!slow && state.unwritten === null) return "not-due";
  const refuse = (why: string, forgetId = false): RecordOutcome => {
    const next: TickRecordState = { commentId: forgetId ? null : state.commentId, unwritten: { since: state.unwritten?.since ?? now, why } };
    try {
      writeTickRecordState(statePath, next);
    } catch (error) {
      say(`TICK RECORD STATE NOT WRITTEN at ${statePath}: ${String((error as Error).message).split("\n")[0]}.\n`);
    }
    say(`TICK RECORD NOT WRITTEN (${why}); the next tick retries it and org-health says so. No session is woken for a slow tick.\n`);
    return "unwritten";
  };
  if ("refusal" in io) return refuse(io.refusal);
  try {
    const body = renderTickRecord(tickRecordOf(parseCostLines(costText), { now, thresholdSeconds, current: line }), { now, thresholdSeconds, costPath });
    let id = state.commentId ?? io.find();
    if (id === null) id = io.post(body);
    else io.edit(id, body);
    try {
      writeTickRecordState(statePath, { commentId: id, unwritten: null });
    } catch (error) {
      say(`TICK RECORD STATE NOT WRITTEN at ${statePath}: ${String((error as Error).message).split("\n")[0]}. The record itself is written.\n`);
    }
    return "written";
  } catch (error) {
    // A cached id that no longer takes an edit (the comment was deleted) is forgotten, so the retry finds or posts the comment again.
    return refuse(String((error as any)?.stderr ?? "").trim().split("\n")[0] || String((error as Error)?.message ?? error).split("\n")[0], true);
  }
}

/**
 * The order for a tick that never finished, or none. `foundAt` is when the tick that read the marker began, so the time the dead tick ran is an UPPER
 * bound (it ended no later than this); the unit's `TimeoutStartSec` is the usual ender, and a killed tick writes no cost line, which is why the order
 * points at the lines before it.
 *
 * @param {Marker | null} marker @param {{ foundAt: number, costPath: string }} where @returns {TickOrder[]}
 */
export function killedTickOrders(marker: Marker | null, { foundAt, costPath }: { foundAt: number; costPath: string; }): TickOrder[] {
  if (marker === null) return [];
  const startedAt = Math.round(marker.at);
  return [{
    session: "ceo", cause: "tick-overran", subject: TICK_KILLED, discriminator: String(startedAt),
    prompt: `A TICK WAS KILLED. The one that started at ${clock(startedAt)} never finished: its start marker was still there when the tick that started at `
      + `${clock(foundAt)} began, and a tick that ends by itself clears it. It ran at most ${seconds(foundAt - startedAt)} s (it ended before this one began); `
      + `\`TimeoutStartSec\` is the usual ender, then a restart${marker.unreadable ? ". THE MARKER WAS UNREADABLE, so that start time is the file's modification time" : ""}.\n`
      + `A killed tick writes no cost line, so look at the ones before it: \`tail -n 5 ${costPath}\` (phases, then the slowest and hottest command lines), `
      + "and at the unit's own journal for what it said last.",
    causeKey: `ceo/${TICK_OVERRAN}/${TICK_KILLED}-${startedAt}`,
  }];
}

// ---- DELIVERY --------------------------------------------------------------------------------------------------------------------------------

/**
 * Hands the orders to `wake` on its stdin, the way the gate does, so the delivery, the ledger and the once-only rule are `wake`'s and not a second copy.
 * NEVER THROWS and never changes the tick's exit: a report that cannot be delivered is said on stderr, and a tick that did its work must not become a
 * failure because the report on it could not go. Returns whether `wake` took the orders.
 *
 * @param {TickOrder[]} orders
 * @param {{ node: string, args: string[], spawn?: typeof spawnSync, say?: (text: string) => void }} wake
 * @returns {boolean}
 */
export function deliverTickOrders(orders: TickOrder[], { node, args, spawn = spawnSync, say = (text) => process.stderr.write(text) }: { node: string; args: string[]; spawn?: typeof spawnSync; say?: (text: string) => void; }): boolean {
  if (orders.length === 0) return false;
  const kinds = orders.map((order) => order.subject).join(", ");
  const ran = spawn(node, args, { encoding: "utf8", input: orders.map((order) => `${JSON.stringify(order)}\n`).join("") });
  if (ran.stdout) process.stdout.write(ran.stdout);
  if (ran.stderr) say(ran.stderr);
  const failed = ran.error?.message ?? (ran.status === 0 ? null : `it exited ${ran.status}: the order had nowhere to go`);
  if (failed !== null) say(`TICK HEALTH NOT DELIVERED (${kinds}): wake could not take it (${failed}).\n`);
  return failed === null;
}
