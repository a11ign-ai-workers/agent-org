import { fleetWaitingOn, todayIso, describeWaiting } from "../../waiting-condition.ts";
import { subjectMention, subjectRef } from "../../review-attribution.ts";
import { NEEDS_CHAIRMAN_LABEL as CHAIRMAN_LABEL } from "../../project-vocabulary.ts";
import { labelsOf } from "../vocabulary.ts";

/**
 * WHICH ROWS ARE THE FLEET BATCH -- ONE SPELLING, IMPORTED BY BOTH FEEDERS (#2443).
 *
 * The batch used to be scoped by the version-one-path MILESTONE, and `fleet-gated-nightly.ts` carried
 * its own copy of that constant. A `fleet-gated` label means "the acceptance needs a fleet run"; a
 * milestone means "on the version-one path". Those are different questions, so a `fleet-gated` row filed
 * off-path, or moved there by #2273's sort, was invisible to `orchestrator` and nothing said so (#2212 sat
 * on `Out of release` for hours on 2026-09-24 until `product-manager` moved it back by hand).
 *
 * THE LABEL, AND THE ROW'S OWN WAITING FIELDS, AND NOTHING ELSE. `listArgs` is the `gh issue list` half
 * for the feeder that queries; `matches` is the local half for the feeder that already holds every open
 * row. Two feeders reading one object cannot disagree about the population again.
 */
export const FLEET_GATED_SELECTOR = Object.freeze({
  label: "fleet-gated",
  listArgs: Object.freeze(["--label", "fleet-gated"]),
  matches: (row: any) => labelsOf(row).includes("fleet-gated"),
});

/**
 * The open `fleet-gated` rows, SPLIT BY WHETHER ANYTHING IS STOPPING THEM -- #2027.
 *
 * THE ORDER PROMISED AN EXIT THIS FILTER DID NOT HONOUR. `fleetBatchOrders`'s own prompt has said since
 * #1941 that a row which cannot move yet is an answer -- *"say so on it with a machine-readable condition
 * (`Fleet-hold-until:`, `--add-blocked-by`, or `Not-before:`) and it leaves this set until the condition
 * clears"* -- and the set was the `fleet-gated` label and the milestone AND NOTHING ELSE. Writing the
 * condition changed nothing. The only ways out were closing the row or removing its label, which are both
 * lies about a row that is merely waiting.
 *
 * MEASURED IN ONE `work:gate` RUN, 2026-09-22T21:57Z. The same invocation printed
 * `SHELVED row #1976: blocked by #1918` and dispatched #1976 in the fleet batch. Both readings came from
 * this file; one of them was wrong. EIGHT of that batch's NINE rows carried a standing, correct
 * condition -- #31, #43, #149, #1865, #1918, #1926 and #1976 by `blockedBy`, #1042 by `Not-before:` --
 * and exactly one (#1908) was genuinely runnable. Every batch therefore re-reported eight answered rows
 * to find the one that was not: the treadmill the order's own last sentence exists to prevent.
 *
 * `fleetWaitingOn` AND NOT `waitingOn`, because this is the one population where the fourth condition
 * applies: `Fleet-hold-until:` is scoped to an open `fleet-gated` row by its own definition (#1839), and
 * a sequence holding the fleet until a named second is precisely a row this batch must not dispatch.
 *
 * FREE, STILL. `readOpenRows` already asks for `number,title,labels,body,blockedBy,milestone` over the
 * same 500 open rows for `answer-owed` and `blocked-unexaminable`, and every field this needs is in that
 * list. This is a local filter over an array already in hand, not a new call.
 *
 * WAITING IS REPORTED, NEVER SILENT. `partitionUnclaimed` already rules that "a row that vanishes
 * silently is the failure `blocked` already is", so the shelved half is returned with its reason and
 * `main` prints it on the same `SHELVED row #N:` line the engineer pool's shelvings use.
 *
 * `needs:chairman` IS THE FIFTH READER OF THE SAME GAP `waitingOn` deliberately does not close (after
 * #2583/#2585, #2604 and #2653's `parked`): the label names a person and clears when removed, and
 * `waitingOn`/`fleetWaitingOn` do not read it on purpose, so teaching it here rather than there keeps
 * every OTHER reader of those functions unchanged. Without this, `fleet-batch-due` re-fired on #2728
 * three minutes after `orchestrator` had already answered it -- a credential row that should never have
 * carried `fleet-gated`, but whose re-firing this filter alone would have prevented: `needs:chairman` is
 * not one of the order's own three machine-readable exits (`Fleet-hold-until:`, `--add-blocked-by`,
 * `Not-before:`), so a row answered that way never left the set. The rule is the one #1899 applied to
 * `answer:<session>`: a hold is an answer.
 *
 *
 * @param [clock] injected so a test moves time without a global stub
 */
export function partitionFleetBatch(rows: any[], clock: { today?: string; nowMs?: number; } = {}): { batch: any[]; waiting: { number: number; reason: string; }[]; } {
  const { today = todayIso(), nowMs = Date.now() } = clock;
  const batch = [];
  const waiting = [];
  const gated = (rows ?? [])
    .filter(FLEET_GATED_SELECTOR.matches)
    .sort((a, b) => Number(a.number) - Number(b.number));
  for (const row of gated) {
    const held = labelsOf(row).includes(CHAIRMAN_LABEL)
      ? `waiting on the chairman (${CHAIRMAN_LABEL})`
      : fleetHeldPhrase(row, today, nowMs);
    if (held) {
      waiting.push({ number: Number(row.number),
        reason: `${held} -- declared on the row, and it clears itself` });
    } else batch.push(row);
  }
  return { batch, waiting };
}

function fleetHeldPhrase(row: any, today: string, nowMs: number): string | null {
  const held = fleetWaitingOn(row, today, nowMs);
  return held ? describeWaiting(held) : null;
}

/**
 * The `fleet-gated` rows that ARE dispatchable -- the batch #914 describes.
 */
export function fleetBatchRows(rows: any[], clock: { today?: string; nowMs?: number; } = {}) {
  return partitionFleetBatch(rows, clock).batch;
}

/**
 * THE FLEET BATCH IS A STATE QUESTION, AND IT SPENT ITS LIFE ON A CLOCK.
 *
 * #1830 built `a11ign-fleet-gated-nightly.timer` to fire at 01:00 UTC, and the cadence was inherited
 * rather than chosen: #914 recorded what a PERSON used to do late at night ("batches starting once the
 * day's last capture job has cleared"), and automating the remembering automated the hour with it.
 *
 * MEASURED 2026-09-22, when the chairman asked why everything waited for 1am: the firing costs
 * **2.2s of CPU and 5s of wall clock**. Two `gh` calls, one comment, one prompt. It performs no capture.
 * There was never a resource argument for daily -- only the habit.
 *
 * AND `agent-practices.md` ALREADY FORBIDS IT, in this repository's own words:
 *
 *   "do not create a cron to check for work. If you think you need one, the gate is missing a question
 *    rather than you needing a timer ... A cron is still right for something that must happen at a
 *    WALL-CLOCK time regardless of state; it is never right for 'has anything changed yet'."
 *
 * "Are there fleet-gated rows to dispatch?" is the second kind. So it moves here, and the timer goes.
 *
 * KEYED ON THE SET, NOT A COUNT AND NOT A CLOCK. The causeKey names every row in the batch, so it fires
 * the moment the set CHANGES -- a row gated, a row cleared -- and stays quiet while it does not. A count
 * would collide two different batches of the same size (#1799's finding, which cost four re-litigations
 * of the same three epics in an hour); a clock fires when nothing has changed and stays silent for
 * twenty-three hours when everything has.
 *
 * A BATCH OF NOTHING IS NOT A BATCH (#2027). Every row waiting on a declared condition is gone before
 * this counts, so a set in which everything is answered emits NO ORDER rather than an order naming rows
 * whose answers are already recorded in a field.
 *
 * @param rows every open row
 */
export function fleetBatchOrders(rows: any[], clock: { today?: string; nowMs?: number; } = {}): {
    session: string; cause: string; subject: string; discriminator: string;
    prompt: string; causeKey: string;
}[] {
  const batch = fleetBatchRows(rows, clock);
  if (batch.length === 0) return [];
  const numbers = batch.map((r) => subjectMention(r)).join(", ");
  const key = batch.map((r) => subjectRef(r.repoKey, r.number)).join(".");
  return [{
    session: "orchestrator",
    cause: "fleet-batch-due",
    subject: "fleet-batch",
    discriminator: key,
    prompt: `${batch.length} row(s) carry \`fleet-gated\` and are open: ${numbers}.\n`
      + "Run the by-row batch per #914's own bar: each row gets a comment naming the capture, the "
      + "reading, and whether it is now workable without the fleet -- or is named not covered and why.\n"
      + "THIS ARRIVES WHEN THE SET CHANGES, NOT ON A CLOCK. It replaced a 01:00 timer that cost 5 "
      + "seconds to run and made the fleet wait up to twenty-three hours for a question worth asking the "
      + "moment a row became gated. So a row that entered this set a minute ago is as real as one that "
      + "has been in it all week -- do not wait for tonight.\n"
      + "A ROW THAT CANNOT MOVE YET IS AN ANSWER: say so on it with a machine-readable condition "
      + "(`Fleet-hold-until:`, `--add-blocked-by`, or `Not-before:`) and it leaves this set until the "
      + "condition clears. A row you merely skip stays in the set and this order returns unchanged.",
    causeKey: `orchestrator/fleet-batch-due/${key}`,
  }];
}
