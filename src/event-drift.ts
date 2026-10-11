// @ts-check
// agent-org#982, a11ign/a11ign#5043 design item 5: A REPOSITORY THAT CHANGED WITH NO EVENT BEHIND IT IS REPORTED, ONCE.
//
// In `webhook` mode a lost delivery is silent: the reconcile re-reads the repository, the generation moves, and nobody learns the receiver is dropping events. At the reconcile
// `refreshTickSnapshot` runs the repository's probe pair ONCE (the poll path's own `probeOnce`); this file decides whether what they said is DRIFT and files it.
//
// THE WINDOW. A repository's `bumpedAt` moves on every event that names it and on every reconcile, so a repository that is DUE has had no event since its window opened, and the one place
// an event can still be "behind" a moved probe is the tick being run (`named`). That is why no event time is kept here: the window is the interval since `bumpedAt`.
//
// TWO FALSE-DRIFT SOURCES, named because they cannot be guessed away and the incident text says them to the person who reads it:
//   - A CHANGE GITHUB SENDS NO EVENT FOR IN THE SUBSCRIBED SET: a Project board edit moves no `issues` event and may still move a probe. The incident is the cue to look, not a verdict.
//   - AN EVENT THAT ARRIVED AFTER THE PROBE WITHIN THE SAME TICK: the queue is read before the probes, so a delivery landing between the two is in the NEXT tick's queue.
// A probe with no tag held (the first reading of a repository, or a path that did not exist) has nothing to compare against: it is a baseline, never drift.
//
// REVERT: `"source": "poll"` in host.json. Without `events` (poll) or with an unhealthy receiver nothing here runs.
import { recordIncident, type Run, type SharedGroup } from "./ci-failure-class.ts";

const MS = 1000;

/** A probe that moved, as `refreshTickSnapshot` read it. `held` is the tag it was compared with (`undefined`: none held, so a baseline). */
export type MovedProbe = { path: string; changed: boolean; held: string | undefined };

export type Drift = { repo: string; probe: string; windowStartS: number; nowS: number };

/** The name the incident gives a probe path: the two endpoints `probePaths` asks. */
export const probeName = (path: string): string => (path.includes("/actions/runs") ? "actions/runs" : "issues list");

/**
 * DRIFT, or `null`. A probe that changed against a tag that was held, for a repository no event named this tick, is a delivery the receiver did not get.
 * An event naming the repository (`named`) explains the move; an unchanged probe says nothing moved.
 */
export function driftOf({ repo, probes, named, windowStartS, nowS }: { repo: string; probes: readonly MovedProbe[]; named: boolean; windowStartS: number; nowS: number }): Drift | null {
  if (named) return null;
  const moved = probes.find((p) => p.changed && p.held !== undefined);
  return moved === undefined ? null : { repo, probe: probeName(moved.path), windowStartS, nowS };
}

const iso = (seconds: number): string => new Date(seconds * MS).toISOString().replace(/\.\d+Z$/, "Z");

/** The group `recordIncident` files. Its key is the repository and the window start, so a retry of the same window joins its row and the next window is a row of its own. */
export function groupOf(drift: Drift): SharedGroup {
  const window = `${iso(drift.windowStartS)} to ${iso(drift.nowS)}`;
  return {
    key: `event-drift:${drift.repo}:${drift.windowStartS}`,
    signature: {
      check: `missed delivery: ${drift.repo}: ${drift.probe} moved`,
      step: `reconcile window ${window}`,
      line: `The ${drift.probe} probe of ${drift.repo} moved in ${window} and no event for it was queued: the event is INFERRED from the probe, not seen. `
        + "Not drift when the change is one GitHub sends no event for in the subscribed set (a Project board edit), or an event that arrived after this probe within the same tick. "
        + "Filed by the webhook reconcile (agent-org#982); `\"source\": \"poll\"` in host.json is the revert.",
      file: null,
    },
    prs: [],
    noted: [],
  };
}

export type FileDrift = (drift: Drift) => boolean;

/**
 * File one incident for `drift` through `recordIncident` (its label, dedupe and refusal handling are reused, not copied). `run` is handed in: this file spawns nothing (`gh-call-ratchet.test.ts`), the caller's one `gh` spawn serves. Returns `true` when a row exists, `false` when `gh` refused:
 * the caller then leaves the window open, so the probe says CHANGED again next tick and the filing is retried instead of lost.
 */
export function fileDrift(drift: Drift, { run, log = (line: string) => process.stderr.write(line), record = recordIncident }: { run: Run; log?: (line: string) => void; record?: typeof recordIncident }): boolean {
  return record(groupOf(drift), { run, log }) !== null;
}
