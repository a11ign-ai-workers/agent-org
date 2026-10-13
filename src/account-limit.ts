/**
 * (agent-org#1307) WHEN THE CLAUDE ALLOWANCE IS SPENT, CLAUDE WORK PAUSES ACCOUNT-WIDE, AND RESUMES BY ITSELF AT THE RESET.
 *
 * ONE LIMITED SESSION IS THE ACCOUNT LIMITED: a Claude seat whose last reply is the allowance message holds every Claude seat back, because they share
 * one allowance. While the pause holds, the gate claims no row for a Claude spawn, starts no Claude worker or manager, starts no `claude -p` decision
 * run, sends no prompt to a Claude seat, and does not release a claimed row. Codex reviewers, review orders, arming, the merge queue, CI reruns and the
 * release and close-row sweeps go on, as they do in every tick.
 *
 * THE RECORD is `{ limitedUntil, seenOn, text }` per account, in `account-limit.json` beside the canary state. An absent account is `DEFAULT_ACCOUNT`:
 * one account is the whole org. The pause ends by itself at `limitedUntil`; a session refused again after that re-enters with the new reset time.
 *
 * ONE FLAG, DEFAULT OFF: `gate.accountLimitPause`, switched by `machinery:flag`. Off, nothing is read beyond the flag, nothing is written and nothing is
 * paused, which is the current behaviour. Switching it off is the revert.
 *
 * ENTERING AND LEAVING are each said ONCE, as one line and one record in `account-limit.ndjson`. Nothing is said per tick. The pure transition
 * ({@link nextLimit}) decides which, and the tick writes them. THE TIME IS AN ARGUMENT everywhere, so the rules are pinned without waiting for one.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { machineryFlagOn, type CanaryState } from "./org-health.ts";
import { readReenqueueState } from "./work-gate/causes/pr-ejected.ts";
import { REVIEWER_STATE_DIR } from "./work-gate/vocabulary.ts";

export const ACCOUNT_LIMIT_FLAG = "gate.accountLimitPause";
/** The record of each account's pause, keyed by account. */
export const ACCOUNT_LIMIT_FILE = "account-limit.json";
/** One line per entering or leaving: the record the chairman's line is written from. */
export const ACCOUNT_LIMIT_LOG = "account-limit.ndjson";
/** The account a limit belongs to when none is named: one account is the whole org. */
export const DEFAULT_ACCOUNT = "default";

export type AccountLimit = { limitedUntil: number; seenOn: string; text: string; };
export type AccountLimits = Record<string, AccountLimit>;
export type LimitEvent = { kind: "enter" | "leave"; account: string; at: number; limitedUntil: number; seenOn: string; text: string; line: string; };

/** Whether the flag is on, read from the canary state. An unreadable state is OFF, which is the current behaviour. */
export function accountLimitOn(state: CanaryState = readReenqueueState()): boolean {
  try {
    return machineryFlagOn(state, ACCOUNT_LIMIT_FLAG);
  } catch {
    return false;
  }
}

/** The records held, keyed by account. Absent, unreadable or malformed is no record: a malformed file is not a pause nobody can see. */
export function readAccountLimits(path: string): AccountLimits {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, limit]) => typeof (limit as AccountLimit)?.limitedUntil === "number")) as AccountLimits;
  } catch {
    return {};
  }
}

/** Written whole, to a sibling file renamed into place, so a reader never sees half a record. */
export function writeAccountLimits(path: string, limits: AccountLimits): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(limits, null, 2)}\n`);
  renameSync(tmp, path);
}

/** The pause that holds at `now` for an account, or `null`: a record whose reset has passed holds nothing. */
export function pausedAt(limits: AccountLimits, now: number, account: string = DEFAULT_ACCOUNT): AccountLimit | null {
  const limit = limits[account];
  return limit !== undefined && limit.limitedUntil > now ? limit : null;
}

/**
 * The gate's pause for the tick that asks: `null` with the flag off, and otherwise whatever {@link pausedAt} holds in the state directory's record.
 * `dir` is the state directory the canary is read from, so a test points it at a fixture.
 */
export function pausedNow(now: number, dir: string = REVIEWER_STATE_DIR, state: CanaryState = readReenqueueState(dir)): AccountLimit | null {
  if (!accountLimitOn(state)) return null;
  return pausedAt(readAccountLimits(join(dir, ACCOUNT_LIMIT_FILE)), now);
}

/** The state directory's log of entering and leaving, appended to by the tick. */
export function accountLimitLogPath(dir: string = REVIEWER_STATE_DIR): string {
  return join(dir, ACCOUNT_LIMIT_LOG);
}

/**
 * The tick's part: the record is moved to what {@link nextLimit} holds, and each entering or leaving is said (`say`) and appended to the log, once.
 * Returns the pause that holds after this tick, or `null`. The record is written only when it changed, so an unchanged tick writes nothing.
 */
export function tickAccountLimit(seen: AccountLimit | null, now: number, say: (line: string) => void, dir: string = REVIEWER_STATE_DIR): AccountLimit | null {
  const path = join(dir, ACCOUNT_LIMIT_FILE);
  const limits = readAccountLimits(path);
  const held = limits[DEFAULT_ACCOUNT];
  const { next, events } = nextLimit(held, seen, now);
  if (JSON.stringify(next) !== JSON.stringify(held)) {
    if (next === undefined) delete limits[DEFAULT_ACCOUNT];
    else limits[DEFAULT_ACCOUNT] = next;
    writeAccountLimits(path, limits);
  }
  for (const event of events) {
    appendFileSync(accountLimitLogPath(dir), `${JSON.stringify({ ...event, at: new Date(event.at).toISOString() })}\n`);
    say(event.line);
  }
  return next ?? null;
}

/** The line a refused order is given, naming the session that spent the allowance and when the pause ends. */
export function pauseRefusal(limit: AccountLimit): string {
  return `the account's Claude allowance is spent on "${limit.seenOn}" until ${new Date(limit.limitedUntil).toISOString()} `
    + `(${ACCOUNT_LIMIT_FLAG}): no Claude seat is started or prompted, and no row is claimed, until then`;
}

function enterEvent(limit: AccountLimit, account: string, at: number): LimitEvent {
  const line = `Claude allowance spent on "${limit.seenOn}" until ${new Date(limit.limitedUntil).toISOString()}: Claude work is paused `
    + "account-wide; Codex reviews and merges go on, and Claude work resumes by itself at that reset.";
  return { kind: "enter", account, at, limitedUntil: limit.limitedUntil, seenOn: limit.seenOn, text: limit.text, line };
}

function leaveEvent(limit: AccountLimit, account: string, at: number): LimitEvent {
  const line = `Claude allowance is back (the pause that began on "${limit.seenOn}" ended at ${new Date(limit.limitedUntil).toISOString()}): Claude work resumes.`;
  return { kind: "leave", account, at, limitedUntil: limit.limitedUntil, seenOn: limit.seenOn, text: limit.text, line };
}

/**
 * THE TRANSITION, pure. `prev` is the record held, `seen` is the limit a Claude session shows NOW (or `null`), and the result is the record to hold and
 * what is said about it:
 *  - a pause already holding is EXTENDED silently by a newer reset, and a session still showing the old message says nothing (no per-tick line);
 *  - a limit seen with no pause holding is ENTERED, and a record whose reset has passed is LEFT first when a new limit replaces it (refused again);
 *  - no limit seen and a pause still holding keeps it, silently, until its reset (the session that spent it may have gone);
 *  - a record whose reset has passed, with no limit seen, is LEFT once and the record is dropped.
 */
export function nextLimit(prev: AccountLimit | undefined, seen: AccountLimit | null, now: number, account: string = DEFAULT_ACCOUNT):
  { next: AccountLimit | undefined; events: LimitEvent[]; } {
  const holding = prev !== undefined && prev.limitedUntil > now;
  // A limit whose reset has passed is no limit: a session still showing the old message is not a new pause.
  const live = seen !== null && seen.limitedUntil > now ? seen : null;
  if (live !== null) {
    if (holding) return { next: prev.limitedUntil >= live.limitedUntil ? prev : live, events: [] };
    return { next: live, events: [...(prev === undefined ? [] : [leaveEvent(prev, account, now)]), enterEvent(live, account, now)] };
  }
  if (prev === undefined) return { next: undefined, events: [] };
  if (holding) return { next: prev, events: [] };
  return { next: undefined, events: [leaveEvent(prev, account, now)] };
}
