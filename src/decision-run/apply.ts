// no-token: none -- the tracker is reached only through the port it is given; the one file this module touches is a per-item lease under a state directory it is handed. Nothing here spawns a process.
// agent-org#901 (Move 2/3 of a11ign/a11ign#4505): A DECISION IS APPLIED ONLY TO AN ITEM THAT HAS NOT CHANGED SINCE ITS BRIEF, ONE RUN PER ITEM AT A TIME.
//
// A decision run reads an item at one moment (its brief) and writes at another. Two things hold the moments together here:
//   1. `leaseItem`: ONE LIVE LEASE PER ITEM. A lease is a run id and a time in a file; another run's live lease answers `held` and names the holder, and
//      one older than {@link LEASE_MS} is stale and is taken. The file is created exclusively, so two runs taking a free item cannot both succeed.
//   2. `applyDecision`: RE-READ, THEN WRITE. The item is read again through the port; `null` is "could not ask" and nothing is written. An event newer than
//      `sinceAt` is `stale` and nothing is written. An answer outside `allowed` is `refused`. Only then is the decision posted (with the role and run id
//      the port writes into its header) and the declared `actions` changed.
//
// THIS MODULE DOES NOT DECIDE WHAT AN ANSWER MEANS: the caller (a class) supplies `actions`, and nothing here names a cause. An event whose time cannot
// be read is treated as newer than the brief, because absence of a time is "could not determine" and must not be written through.
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ItemRef, StateChange, TicketPort } from "../ticket-port/port.ts";

/** How long a lease holds an item before another run may take it, in milliseconds. */
export const LEASE_MS = 10 * 60 * 1000;

/** The directory under the state directory that holds one lease file per item. */
export const LEASE_DIR = "decision-leases";

export type LeaseResult = Readonly<{ held: false; leaseId: string }> | Readonly<{ held: true; by: string }>;

type LeaseRecord = { runId: string; at: number };

/** One file name per item: the tracker, scope and number, with anything but a letter, digit, dot or dash replaced so a scope's `/` cannot leave the directory. */
export function leasePath(stateDir: string, ref: ItemRef): string {
  const safe = (s: string): string => s.replace(/[^A-Za-z0-9.-]/g, "_");
  return join(stateDir, LEASE_DIR, `${safe(ref.tracker)}~${safe(ref.scope)}~${ref.id}.json`);
}

function readLease(path: string): LeaseRecord | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<LeaseRecord>;
    if (typeof parsed.runId === "string" && typeof parsed.at === "number" && Number.isFinite(parsed.at)) return { runId: parsed.runId, at: parsed.at };
  } catch {
    // missing or unreadable: handled by the caller as "no live lease" only when the file is absent; see leaseItem.
  }
  return null;
}

/**
 * Takes the item's lease for `runId`. `{ held: true, by }` when another run's lease is live. The same run asking again renews its own lease.
 * An unreadable lease file is treated as stale (a half-written file must not hold an item for ever), and a lease dated in the future is live
 * until `LEASE_MS` after that date, never longer, so a skewed clock cannot park an item indefinitely.
 */
export function leaseItem(stateDir: string, ref: ItemRef, runId: string, nowMs: number): LeaseResult {
  const path = leasePath(stateDir, ref);
  mkdirSync(join(stateDir, LEASE_DIR), { recursive: true });
  const body = JSON.stringify({ runId, at: nowMs } satisfies LeaseRecord);
  try {
    writeFileSync(path, body, { flag: "wx" });
    return { held: false, leaseId: runId };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  const existing = readLease(path);
  if (existing && existing.runId !== runId && Math.abs(nowMs - existing.at) < LEASE_MS) return { held: true, by: existing.runId };
  // Stale, unreadable or our own: replace it. The rename is atomic, so a reader never sees half a lease.
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, body);
  renameSync(tmp, path);
  return { held: false, leaseId: runId };
}

/** Removes the lease only when `runId` holds it. Returns whether a lease was removed. */
export function releaseItem(stateDir: string, ref: ItemRef, runId: string): boolean {
  const path = leasePath(stateDir, ref);
  const existing = readLease(path);
  if (!existing || existing.runId !== runId) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}

export type ApplyInput = Readonly<{
  ref: ItemRef;
  /** The instant the brief was read, ISO: an item with an event after it has changed since. */
  sinceAt: string;
  /** The answers the question allowed. */
  allowed: readonly string[];
  decision: Readonly<{ answer: string; text: string; kind: string }>;
  role: string;
  runId: string;
  /** What the caller's class says this answer means; this module applies it and does not choose it. */
  actions: StateChange;
}>;

export type ApplyResult =
  | Readonly<{ outcome: "applied"; commentId: string; changed: boolean; actions: StateChange }>
  | Readonly<{ outcome: "unreadable" }>
  | Readonly<{ outcome: "stale"; newestAt: string }>
  | Readonly<{ outcome: "refused"; answer: string; allowed: readonly string[] }>;

/** Applies a decision, writing nothing unless the item is readable, unchanged since `sinceAt` and the answer is allowed. */
export function applyDecision(port: TicketPort, input: ApplyInput): ApplyResult {
  const item = port.readItem(input.ref);
  if (item === null) return { outcome: "unreadable" };

  const since = Date.parse(input.sinceAt);
  for (const event of item.events) {
    const at = Date.parse(event.at);
    if (Number.isNaN(since) || Number.isNaN(at) || at > since) return { outcome: "stale", newestAt: event.at };
  }

  if (!input.allowed.includes(input.decision.answer)) return { outcome: "refused", answer: input.decision.answer, allowed: input.allowed };

  const commentId = port.postDecision(input.ref, { role: input.role, runId: input.runId, kind: input.decision.kind, text: input.decision.text });
  const { state, addFlags, removeFlags } = input.actions;
  const empty = state === undefined && !(addFlags?.length) && !(removeFlags?.length);
  const changed = empty ? false : port.changeState(input.ref, input.actions);
  return { outcome: "applied", commentId, changed, actions: input.actions };
}
