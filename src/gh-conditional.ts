/**
 * a11ign/a11ign#5128: the gate's hot polling reads, moved to REST with `If-None-Match` where a validator can answer them, read only where
 * something changed, and held to a per-tick budget of GraphQL points.
 *
 * WHY IT IS GRAPHQL THAT IS BUDGETED. `gh pr list`, `gh pr view` and `gh issue list` spend the GraphQL pool (5,000 points an hour per
 * account); `gh api` spends REST core. GitHub's documentation says a 304 is not charged to the primary limit; that is not measured here, and
 * the live measurement is what would confirm it. The per-tick cap is therefore a limit on what the tick may still ask GraphQL, not on REST.
 *
 * THE FLAG IS A MARKER FILE, as `draining` is (`work-gate/reads.ts`): `touch` turns the REST path on for the next tick, `rm` turns it off,
 * and nothing needs a unit-file edit. With the marker absent the reads are the ones the gate has always made.
 *
 * THE CAP IS A GUARD, NOT A MEASUREMENT. The points a caller charges to each cause are its own estimates; the live one-hour measurement (the
 * row's Acceptance) reads the `gate-budget` lines the tick writes, and that is where the estimates are checked.
 */
import { existsSync } from "node:fs";
import { stateEntryPath } from "./host-config.ts";
import { conditionalReader, type Ask, type Validated } from "./trace/publish.ts";

export const REST_CONDITIONAL_MARKER = "gate-rest-conditional";
/** Where the kept ETags live between ticks: a directory of its own, so the trace publisher's store is never read as the gate's. */
export const GATE_VALIDATORS_DIR = "gate-conditional";

/** A tick may spend this many GraphQL points before the rest of its reads are refused (the row's "a tick stops at its cap"). */
export const TICK_POINTS_CAP = 60;

/**
 * Is the REST path on? The marker is read at the start of each tick, so a change takes effect on the next one and never mid-tick.
 */
export function restConditionalOn(path: string = stateEntryPath(REST_CONDITIONAL_MARKER), exists: (p: string) => boolean = existsSync) {
  return exists(path);
}

/**
 * GETs that send the ETag they were last given and answer a 304 from the value kept with it, for ONE tick. `held` is the store the
 * caller loads with `readValidators` and saves with `saveValidators`; this does not write it.
 */
export function conditionalGate({ held, ask, now }: { held: Record<string, Validated>; ask: Ask; now: number; }) {
  return conditionalReader({ held, ask, now });
}

/** What a tick has seen of each open pull request: the head it was read at and the `updatedAt` it carried. */
export type Seen = Map<number, { headRefOid: string; updatedAt: string; }>;

export const seenOf = (prs: readonly { number: number; headRefOid: string; updatedAt: string; }[]): Seen =>
  new Map(prs.map((pr) => [pr.number, { headRefOid: pr.headRefOid, updatedAt: pr.updatedAt }]));

/**
 * The pull requests whose detail must be read again. One whose head AND `updatedAt` both match the last tick's is unchanged, and its
 * kept detail is still true. A pull request not seen before is read.
 */
export function partitionUnchanged<T extends { number: number; headRefOid: string; updatedAt: string; }>(prs: readonly T[], seen: Seen) {
  const reread: T[] = [];
  const unchanged: T[] = [];
  for (const pr of prs) {
    const last = seen.get(pr.number);
    const same = last !== undefined && last.headRefOid === pr.headRefOid && last.updatedAt === pr.updatedAt;
    (same ? unchanged : reread).push(pr);
  }
  return { reread, unchanged };
}

export type BudgetSummary = { total: number; cap: number; byCause: Record<string, number>; };

/**
 * The tick's GraphQL points. `spend` charges a read to its cause and returns true, or refuses it and charges nothing when it would pass the
 * cap; a caller that gets `false` stops the reads it has not yet made.
 */
export function budgetOf({ cap = TICK_POINTS_CAP }: { cap?: number; } = {}) {
  const byCause = new Map<string, number>();
  let total = 0;
  return {
    spend(cause: string, points: number): boolean {
      if (total + points > cap) return false;
      total += points;
      byCause.set(cause, (byCause.get(cause) ?? 0) + points);
      return true;
    },
    exhausted: (): boolean => total >= cap,
    summary: (): BudgetSummary => ({ total, cap, byCause: Object.fromEntries(byCause) }),
  };
}

/** The line the tick log carries for one tick, so the spend by cause is read from the log and not inferred. */
export function budgetLine({ total, cap, byCause }: BudgetSummary): string {
  const causes = Object.entries(byCause).map(([cause, points]) => `${cause} ${points}`).join(", ");
  return `gate-budget: ${total}/${cap} points (${causes})`;
}
