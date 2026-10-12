// @ts-check
// agent-org#982, a11ign/a11ign#5043 design item 5: A REPOSITORY THAT CHANGED WITH NO EVENT BEHIND IT IS REPORTED, ONCE.
//
// In `webhook` mode a lost delivery is silent: the reconcile re-reads the repository, the generation moves, and nobody learns the receiver is dropping events. At the reconcile
// `refreshTickSnapshot` runs the repository's probe pair ONCE (the poll path's own `probeOnce`); this file decides whether what they said is DRIFT and files it.
//
// THE WINDOW. A repository's `bumpedAt` moves on every event that names it and on every reconcile, so a repository that is DUE has had no event since its window opened, and the one place
// an event can still be "behind" a moved probe is the tick being run (`named`). That is why no event time is kept here: the window is the interval since `bumpedAt`.
//
// THE CONTENT, NOT THE TAG (agent-org#1207, a11ign/a11ign#928). A probe's tag moving is NOT drift on its own. Measured 2026-10-12: the same issues list read anonymously and
// authenticated carries the same items and a DIFFERENT tag, and a tag held from one read context answers 200 (not 304) when it is sent in the other. So a probe is drift only when
// the content it read moved too: the newest `updated_at` of its items or the number of them (`contentMoved`). A tag that moved over the same content is counted (`countSuppressed`),
// not filed, so the health signal stays visible without a row per repository per window.
//
// TWO FALSE-DRIFT SOURCES, named because they cannot be guessed away and the incident text says them to the person who reads it:
//   - A CHANGE GITHUB SENDS NO EVENT FOR IN THE SUBSCRIBED SET: a Project board edit moves no `issues` event and may still move a probe. The incident is the cue to look, not a verdict.
//   - AN EVENT THAT ARRIVED AFTER THE PROBE WITHIN THE SAME TICK: the queue is read before the probes, so a delivery landing between the two is in the NEXT tick's queue.
// A probe with no tag held (the first reading of a repository, or a path that did not exist) has nothing to compare against: it is a baseline, never drift. So is a probe whose tag
// is held without the content it was read with (a file written before this check), and a probe whose body could not be read: nothing confirms a move there.
//
// ONE INCIDENT PER PASS (agent-org#1207): a reconcile pass that finds several repositories drifted files ONE incident naming every one of them, not one per repository.
//
// REVERT: `"source": "poll"` in host.json. Without `events` (poll) or with an unhealthy receiver nothing here runs.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { recordIncident, type Run, type SharedGroup } from "./ci-failure-class.ts";

const MS = 1000;
const KEEP_DAYS = 14;

/** What a probe's body said besides its tag: the newest `updated_at` of the items it read (`null` when there were none) and how many there were. */
export type Facts = { newest: string | null, count: number };

/**
 * A probe that moved, as `refreshTickSnapshot` read it. `held` is the tag it was compared with (`undefined`: none held, so a baseline); `heldFacts` is the content held with that tag
 * (`undefined`: none, so a baseline); `facts` is the content this read saw (`undefined`: the body was not readable).
 */
export type MovedProbe = { path: string; changed: boolean; held: string | undefined; heldFacts?: Facts; facts?: Facts };

/** A repository that drifted in a pass: the probe that moved and the window it moved in. */
export type Drift = { repo: string; probe: string; windowStartS: number; nowS: number };

/** The name the incident gives a probe path: the two endpoints `probePaths` asks. */
export const probeName = (path: string): string => (path.includes("/actions/runs") ? "actions/runs" : "issues list");

/** Did the content a probe read move since the tag was held? Only readable content on both sides that differs is a move. */
export const contentMoved = (p: MovedProbe): boolean =>
  p.heldFacts !== undefined && p.facts !== undefined && (p.facts.newest !== p.heldFacts.newest || p.facts.count !== p.heldFacts.count);

/** The tag moved and the content, read on both sides, did not: the change the tag alone used to file, now counted and not filed. */
export const noContentChange = (p: MovedProbe): boolean => p.changed && p.held !== undefined && p.heldFacts !== undefined && p.facts !== undefined && !contentMoved(p);

/**
 * DRIFT, or `null`. A probe whose tag moved AND whose content moved, against a tag and content that were held, for a repository no event named this tick, is a delivery the receiver did not get.
 * An event naming the repository (`named`) explains the move; a probe whose content did not move says nothing moved.
 */
export function driftOf({ repo, probes, named, windowStartS, nowS }: { repo: string; probes: readonly MovedProbe[]; named: boolean; windowStartS: number; nowS: number }): Drift | null {
  if (named) return null;
  const moved = probes.find((p) => p.changed && p.held !== undefined && contentMoved(p));
  return moved === undefined ? null : { repo, probe: probeName(moved.path), windowStartS, nowS };
}

const iso = (seconds: number): string => new Date(seconds * MS).toISOString().replace(/\.\d+Z$/, "Z");

/** The group `recordIncident` files for one pass. Its key is every drifted repository and its window start, so a retry of the same pass joins its row and the next window is a row of its own. */
export function groupOf(drifts: readonly Drift[]): SharedGroup {
  const windowStartS = Math.min(...drifts.map((d) => d.windowStartS));
  const nowS = Math.max(...drifts.map((d) => d.nowS));
  const window = `${iso(windowStartS)} to ${iso(nowS)}`;
  const moved = drifts.map((d) => `${d.repo}: ${d.probe}`).join("; ");
  return {
    key: `event-drift:${drifts.map((d) => `${d.repo}@${d.windowStartS}`).sort().join(",")}`,
    signature: {
      check: `missed delivery: ${moved} moved`,
      step: `reconcile window ${window}`,
      line: `The probes that moved in ${window} with no event queued for their repositories were: ${moved}. `
        + "Each moved the probe's tag AND the content it read (the newest updated_at or the item count). The event is INFERRED from the probe, not seen. "
        + "Not drift when the change is one GitHub sends no event for in the subscribed set (a Project board edit), or an event that arrived after this probe within the same tick. "
        + "Filed by the webhook reconcile (agent-org#982, content check agent-org#1207); `\"source\": \"poll\"` in host.json is the revert.",
      file: null,
    },
    prs: [],
    noted: [],
  };
}

/** One pass's drifts, filed as one incident. `true` when a row exists, `false` when the filing was refused. */
export type FileDrift = (drifts: readonly Drift[]) => boolean;

/**
 * File one incident for the pass's `drifts` through `recordIncident` (its label, dedupe and refusal handling are reused, not copied). `run` is handed in: this file spawns nothing (`gh-call-ratchet.test.ts`), the caller's one `gh` spawn serves. Returns `true` when a row exists, `false` when `gh` refused:
 * the caller then leaves the windows open, so each probe says CHANGED again next tick and the filing is retried instead of lost.
 */
export function fileDrift(drifts: readonly Drift[], { run, log = (line: string) => process.stderr.write(line), record = recordIncident }: { run: Run; log?: (line: string) => void; record?: typeof recordIncident }): boolean {
  return record(groupOf(drifts), { run, log }) !== null;
}

/** Where the per-day count of reconciles whose tag moved over the same content is kept, under the read cache (`read-cache/`). */
export const suppressedPath = (root: string): string => join(root, "event-drift-suppressed.json");

/** The count per UTC day, newest first in the file. A file that cannot be read counts as empty: the count is a signal, never a gate. */
export function readSuppressed(path: string): Record<string, number> {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

/** Add `n` to today's count and keep the last `KEEP_DAYS` days. Written through a rename, as the generations are. */
export function countSuppressed(path: string, nowMs: number, n: number): void {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const tally = readSuppressed(path);
  tally[day] = (tally[day] ?? 0) + n;
  const kept = Object.fromEntries(Object.entries(tally).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, KEEP_DAYS));
  const tmp = `${path}.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(kept));
  renameSync(tmp, path);
}
