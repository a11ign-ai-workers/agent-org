import { CLAIM_LABEL, CLAIM_RECORD_MARKER } from "../../claim-labels.ts";
import { ANSWER_PREFIX } from "../../waiting-condition.ts";
import { subjectMention, subjectRef } from "../../review-attribution.ts";
import { MAX_ROW_ORDERS_PER_TICK, digestOf, labelsOf, sessionOf } from "../vocabulary.ts";

/**
 * THE MARKERS A ROW USES TO SAY "THIS CHANGED UNDER YOU" -- #2110.
 *
 * DECLARED AND PARSED, NEVER INFERRED FROM PROSE, and that is the whole design rather than a nicety. A
 * cause that fired on ANY comment on a claimed row would wake the holder for their own claim record,
 * their own build report and every clarifying reply -- comment-noise arriving one door along from the
 * gap it was meant to close. So this reads the same shape the `Acceptance:`/`Closes:`/`Not-before:`
 * family already established: a literal a writer has to choose on purpose.
 *
 * TWO SPELLINGS BECAUSE THE TWO WRITERS ARE DIFFERENT. A ruling lands as a COMMENT (`## CONSTRAINT` is
 * the heading `product-manager` used on #2099 at 10:22:34Z, before this cause existed to read it); a
 * constraint the row is filed or amended with lands in the BODY, where `row-file`'s own sections live and
 * where a comment would be the wrong place. Both are append-only from a reader's point of view.
 */
export const CONSTRAINT_COMMENT_MARKER = "## CONSTRAINT";

export const CONSTRAINT_BODY_PREFIX = "Constraint:";

/**
 * Pure: the `## CONSTRAINT` comments a row gained AFTER its newest claim record, oldest first.
 *
 * THE CLAIM RECORD IS THE CLOCK, AND IT COSTS NOTHING. `row-claim` appends `CLAIM_RECORD_MARKER` to the
 * thread on every claim, and `gh issue list --json comments` returns comments OLDEST-FIRST -- so
 * "after the claim" is a position in a list this gate already has in hand, with no timestamp arithmetic
 * and no second read. A row claimed, released and claimed again anchors on the NEWEST record, which is
 * `claimRecordFrom`'s own rule for the same reason: the current holder is the one being told.
 *
 * A ROW WITH NO CLAIM RECORD ANCHORS AT THE START OF THE THREAD. Pre-#987 claims wrote labels and no
 * comment, and the rows carrying them are real; refusing to look would make this cause silently blind to
 * the oldest claims in the tracker, which is a worse failure than announcing a constraint that has been
 * sitting there. It is still one order, because the key names the marker.
 *
 * @param comments oldest first, as `gh issue list --json comments` returns
 */
export function constraintsAfterClaim(comments: { body?: string; id?: string; }[]): { body?: string; id?: string; }[] {
  const list = comments ?? [];
  let claimedAt = -1;
  for (let i = 0; i < list.length; i += 1) {
    if ((list[i]?.body ?? "").includes(CLAIM_RECORD_MARKER)) claimedAt = i;
  }
  return list.slice(claimedAt + 1).filter((c) => hasConstraintHeading(c?.body ?? ""));
}

/**
 * Pure: does this comment body carry the `## CONSTRAINT` heading as a HEADING?
 *
 * ANCHORED TO A LINE START, so a comment that QUOTES the marker in a sentence -- or that quotes this very
 * rule while explaining it -- is not itself a constraint. That is the mention-versus-use trap
 * `acceptance-commands.ts` names, and it is the one a plain `includes` would walk straight into: the
 * comment announcing this cause on the row would have fired it.
 */
function hasConstraintHeading(body: string) {
  return new RegExp(`^${CONSTRAINT_COMMENT_MARKER}\\s*$`, "m").test(body);
}

/**
 * Pure: the amendments a CLAIMED row is currently carrying, in a form a causeKey can name.
 *
 * THREE MARKERS, AND EACH ONE ANSWERS "AFTER THE CLAIM" DIFFERENTLY. This is stated here rather than
 * discovered by the next reader, because one of the three cannot answer it at all:
 *
 *   `comment`    ANSWERED EXACTLY -- its position after the newest claim record, see above.
 *   `blocked-by` ANSWERED BY A RULE ELSEWHERE. `blocked-by-edge-rule.ts` (#1886, closed 2026-09-22)
 *                REFUSES a claim on a row carrying an open `blockedBy`, so an open edge on a row that IS
 *                claimed can only have arrived after the claim. That is exactly #1918: claimed while
 *                clean, blocked by #2100 afterwards, where no claim-time rule can ever reach it.
 *   `body`       NOT ANSWERED, AND SAYING SO IS THE POINT. Nothing in `gh issue list --json` dates a body
 *                line, and dating one would cost a timeline call PER ROW -- the one thing this read may
 *                not become. So a row FILED with a `Constraint:` line and then claimed emits this cause
 *                once, on the first tick after the claim. That is one order telling a holder to read a
 *                constraint on a row they hold, which is not the failure this cause is about; it is
 *                keyed like the others, so it is once and never again.
 *
 *
 * @param comments this row's comments, oldest first
 */
export function amendmentsOn(row: any, comments: { body?: string; id?: string; }[]): { kind: string; id: string; says: string; }[] {
  const markers = [];
  const newest = constraintsAfterClaim(comments).at(-1);
  if (newest) markers.push({ kind: "comment", id: String(newest.id ?? "unidentified"),
    says: `a \`${CONSTRAINT_COMMENT_MARKER}\` comment` });
  for (const line of constraintLines(row?.body ?? "")) {
    markers.push({ kind: "body", id: digestOf(line), says: `the row body's \`${line}\`` });
  }
  const open = openBlockers(row);
  if (open.length > 0) {
    markers.push({ kind: "blocked-by", id: `blocked.${open.join(".")}`,
      says: `an open \`blockedBy\` edge on ${open.map((n) => `#${n}`).join(", ")}` });
  }
  return markers;
}

/**
 * Pure: the row body's `Constraint:` lines, whole, in the order they appear.
 *
 * THE WHOLE LINE IS THE MARKER because the whole line is what changes. Keying on the mere PRESENCE of a
 * `Constraint:` line would make a row whose constraint was REPLACED look unchanged, and the replacement
 * is precisely the amendment a holder must be told about.
 */
function constraintLines(body: string): string[] {
  return [...(body ?? "").matchAll(new RegExp(`^${CONSTRAINT_BODY_PREFIX}\\s*(?:.*\\S)`, "gm"))]
    .map((m) => m[0].trim());
}

/**
 * Pure: the row's STILL-OPEN `blockedBy` numbers, sorted, or `[]`.
 *
 * SORTED for `declaredBlockers`'s reason one function up: GitHub returns the nodes in its own order and an
 * unsorted key would mint a different question for the same set of blockers.
 */
export function openBlockers(row: any): number[] {
  return (row?.blockedBy?.nodes ?? [])
    .filter((n: any) => String(n?.state ?? "").toUpperCase() === "OPEN")
    .map((n: any) => Number(n.number))
    .sort((a: number, b: number) => a - b);
}

/**
 * A ROW MOVED UNDER THE SESSION HOLDING IT, AND NOTHING IN THIS ORG SAID SO -- #2110.
 *
 * MEASURED TWICE IN ONE MORNING, 2026-09-23. #2099 was claimed by `worker-capture` at 09:54:06Z and built
 * by 10:16:50Z; at 10:22:34Z `product-manager` recorded `ceo`'s ruling on it -- *"this row may NOT be
 * implemented by granting a token"* -- 28 minutes after the claim and 6 minutes after the work was
 * finished. It happened to be complied with, and nothing in this org CAUSED that: the gate emitted no
 * cause for `worker-capture` at all, because a claimed row is outside every population it walks.
 * `ready-row-unclaimed` had stopped matching at 09:54 and `blocker-cleared` is the only cause whose
 * subject is a row somebody already holds. The same hour, `orchestrator` was holding #1918 while it
 * acquired an open `blockedBy` on #2100 -- the same defect wearing the other marker.
 *
 * NOT A MESSAGING ROW, AND THAT WAS RULED RATHER THAN ASSUMED. The tempting fix is to make `SendMessage`
 * addresses discoverable; `ceo` steered away from it on 2026-09-23 because the ruling landed precisely
 * BECAUSE it was put on the row. This repo's own rule names the remedy in so many words: if you think you
 * need a cron, the gate is missing a question. This is that question, and it needs no address book at all
 * -- the row's own `session:` label names who owes the answer.
 *
 * ONE ORDER PER ROW, KEYED ON WHAT IS CURRENTLY THERE. The key names EVERY marker the row carries rather
 * than a count or a clock, which is `fleetBatchOrders`'s and `blocker-cleared`'s shape and buys the two
 * properties done-when 3 asks for: a second constraint changes the set, so it is a second question that
 * reaches the holder; an unchanged row mints the identical key on every subsequent tick and the ledger
 * drops it. It is deliberately not "the newest marker" -- the three kinds share no clock (a body line has
 * no timestamp at all), so "newest" would have to be invented, and a constraint REPLACED by a different
 * one would key the same under it and never be told.
 *
 * THE POSITIVE CONTROL LIVES IN `work-gate.test.ts`: an ordinary comment on a claimed row -- a claim
 * record, a build report -- must emit NOTHING. Without it this is a comment-noise generator and the tests
 * that assert silence would all pass against a function that returns `[]`.
 *
 * @param rows every open row (`readOpenRows`)
 *
 *        `readClaimedRowComments`'s answer. `[]` is "not asked or refused", which evaluates the body and
 *        edge markers and not the comment one -- a degradation that can go quiet, never one that invents.
 */
export function claimedRowAmendedOrders(rows: any[], claimedComments: { number?: number; comments?: { body?: string; id?: string; }[]; }[] = []): {
    session: string; cause: string; subject: string; discriminator: string;
    prompt: string; causeKey: string;
}[] {
  const byRow = new Map((claimedComments ?? []).map((r) => [Number(r?.number), r?.comments ?? []]));
  const orders = [];
  for (const row of rows ?? []) {
    const session = sessionOf(row);
    if (!session || !labelsOf(row).includes(CLAIM_LABEL)) continue;
    const markers = amendmentsOn(row, byRow.get(Number(row.number)) ?? []);
    if (markers.length === 0) continue;
    orders.push(amendedOrder({ row, session, markers }));
    if (orders.length >= MAX_ROW_ORDERS_PER_TICK) break;
  }
  return orders;
}

/**
 * The order itself, split out so `claimedRowAmendedOrders` stays a walk over rows (the Stepdown Rule, and
 * `max-lines-per-function`).
 *
 * INCIDENT BEHIND THE ORDER'S TEXT (moved out of it, #3444: the agent reading the order cannot use it):
 * on 2026-09-23 a ruling reached #2099 six minutes AFTER the build was finished and 28 minutes after the claim; it was honoured only because
 * a human read the thread, and this gate said nothing to the session that held the row.
 */
function amendedOrder({ row, session, markers }: { row: any; session: string; markers: { kind: string; id: string; says: string; }[]; }) {
  const key = markers.map((m) => m.id).join("+");
  return {
    session,
    cause: "claimed-row-amended",
    subject: `row-${subjectRef(row.repoKey, row.number)}`,
    discriminator: key,
    prompt: `${subjectMention(row)} IS YOURS AND IT HAS CHANGED UNDER YOU. It now carries `
      + `${markers.map((m) => m.says).join(" and ")}.\n`
      + "GO AND READ IT BEFORE YOU WRITE ANOTHER LINE, and if you have already built, check the diff "
      + "against it rather than your memory of the brief: a ruling can arrive after the build is "
      + "finished, and nothing else tells the session that holds the row.\n"
      + "THEN SAY WHAT YOU DID ABOUT IT, on the row. If the constraint makes the row unbuildable as "
      + `written, that is an answer and it goes in a FIELD: \`${ANSWER_PREFIX}<session>\` for a ruling, `
      + `\`gh issue edit ${row.number} --add-blocked-by <n>\` for a row you must wait on, a `
      + "`Not-before: YYYY-MM-DD` line for a date. Each clears itself.\n"
      + "IF IT IS AN OPEN `blockedBy` EDGE: you were not refused at claim time because the edge did not "
      + "exist then (`blocked-by-edge-rule.ts` would have refused you) -- it arrived while you held the "
      + "row, which is exactly what happened to #1918 on #2100.",
    causeKey: `${session}/claimed-row-amended/row-${subjectRef(row.repoKey, row.number)}/${key}`,
  };
}
