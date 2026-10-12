import { waitingOn, todayIso } from "../../waiting-condition.ts";
import { subjectMention, subjectRef } from "../../review-attribution.ts";
import { NEEDS_CHAIRMAN_LABEL as CHAIRMAN_LABEL } from "../../project-vocabulary.ts";
import { MAX_ROW_ORDERS_PER_TICK, PARKED_LABEL, labelsOf } from "../vocabulary.ts";

/**
 * AN EPIC WITH NO CHILDREN IS NOT A CONTAINER -- IT IS WORK NOBODY HAS FILED.
 *
 * THE THIRD INSTANCE OF ONE DEFECT. `epic` is in `NOT_PICKABLE`, and rightly: an engineer cannot claim a
 * container. But a label that says "not the pool's work" was again read as "not work", and nothing asked
 * the one question that matters about an epic -- HAS ANYONE TURNED IT INTO ROWS?
 *
 *   `fleet-gated`  not the pool's | IS `orchestrator`'s        -- fixed, `ROUTED_TO`
 *   `blocked`      not startable  | a claim with no referent   -- fixed, `blockedBy`/`Not-before:`
 *   `epic`         not pickable   | NOBODY HAS FILED THIS YET  -- this
 *
 * MEASURED 2026-09-20, and it is why the chairman found six engineers idle on a healthy fleet: 40 open
 * rows, 0 ready, 0 open pull requests, ONE row an engineer could pick up -- and that one titled "Human:"
 * because it needs the chairman. Meanwhile SEVENTEEN open epics, SIXTEEN of them with zero sub-issues,
 * nine of those also `fleet-gated`. #34 is the plainest: "Sixteen built cases have never been captured."
 * That is capture work, ready to do, inside a container nobody had opened.
 *
 * THE ORG HAD NOT RUN OUT OF WORK. It had run out of FILED work, and no cause could tell the difference.
 *
 * `product-manager`, because filing is their lane: `agent-practices.md` names them first reader for
 * "filing and amendments, Region and done-when wording". Breaking an epic down IS filing.
 *
 * A JUDGMENT CAUSE, and the prompt says so: some epics genuinely should not be split yet -- one waiting
 * on a decision, or on a release, is correctly whole. "Split none and record why" is a valid answer, the
 * same contract `lane-backlog-unpromoted` already carries.
 *
 * A START CAUSE, so a drain withholds it: splitting an epic MANUFACTURES new work, which is exactly what
 * a drain window exists to stop.
 */
export function unfiledEpics(epics: {
        number?: number; title?: string; subIssuesSummary?: { total?: number; };
        body?: string; labels?: { name?: string; }[];
        blockedBy?: { nodes?: { number?: number; state?: string; }[]; };
    }[], today: string = todayIso()) {
  return (epics ?? [])
    .filter((e) => (e?.subIssuesSummary?.total ?? 0) === 0)
    // AN EPIC THAT IS WAITING IS NOT UNFILED, IT IS WAITING -- and #1780 already built the mechanism
    // for saying so. This cause shipped without asking, so a correctly-recorded blocker was ignored.
    //
    // MEASURED 2026-09-20: `product-manager` was asked to split #57, judged it "still correctly blocked
    // on the open release milestone", RECORDED THAT AS A REAL `blockedBy` EDGE -- doing exactly what the
    // rule asks -- and was asked again anyway, because `unfiledEpics` only ever looked at sub-issues.
    // From outside, a session correctly declining and a session ignoring its orders look identical.
    .filter((e) => waitingOn(e, today) === null)
    // `parked` AND `needs:chairman` ARE WAITS THAT `waitingOn` DOES NOT READ, AND THIS IS THE FIFTH READER OF THAT
    // GAP (#2583, #2604, #2653 and #2780 each taught one population; `epicOrders` was one none of them reached).
    // MEASURED 2026-10-02: #2628 (the documents axis, `parked` by `ceo` on 2026-09-26, the lift `ceo`'s when
    // `v2 — SaaS depth` closes) was ordered to `product-manager` THREE TIMES IN ONE DAY, and each answer was the
    // same comment ("left WHOLE", the reason already on the row). Dropped HERE, beside the `waitingOn` filter, and
    // not taught to `waitingOn`, which every reader of that function would then inherit. Removing the label puts
    // the epic back, so the lift clears itself.
    .filter((e) => !labelsOf(e).some((n: string) => n === PARKED_LABEL || n === CHAIRMAN_LABEL));
}

/**
 * One order per unfiled epic, oldest first, capped -- the orders an unfiled backlog deserves.
 *
 * ONE ORDER PER EPIC, NOT ONE ORDER NAMING EVERY EPIC, for the reason `rowOrders` already settled: a
 * causeKey built from the COUNT conflates two different questions -- did the epic I judged change, and
 * did an unrelated epic get filed by someone else. #1799 measured this against the live ledger: the same
 * three epics (#69, #57, #20) were re-litigated from scratch four times in under an hour, each time a
 * DIFFERENT epic elsewhere was filed and dropped the count by one, minting a causeKey `product-manager`
 * had never seen and so never protected by `JUDGMENT_TTL_MS` --
 *
 *   10:25:37Z  product-manager/epic-unfiled/epics/16
 *   10:41:54Z  product-manager/epic-unfiled/epics/9
 *   11:08:07Z  product-manager/epic-unfiled/epics/5
 *   11:20:30Z  product-manager/epic-unfiled/epics/3
 *
 * Every verdict was independently correct -- "reviewed, not split... blocked-by #5", three times over --
 * the defect was that the judgment had to be redone at all. Keying on the remaining SET instead of the
 * count has the same defect spelled differently: the population still changes on every delivery, because
 * a different epic drops out each time.
 *
 * PER-EPIC KEYING FIXES IT BECAUSE AN UNCHANGED EPIC IS AN UNCHANGED QUESTION. `causeKey` now names the
 * epic, not the shelf: filing #16 elsewhere removes #16's own order and leaves #69's, #57's and #20's
 * causeKeys byte-identical, so `JUDGMENT_TTL_MS` protects each one exactly as long as that epic's own
 * answer has not moved -- the same property `ready-row-unclaimed` already has over `ready-queue-empty`.
 */
export function epicOrders(epics: any[], readyRows: any[]): {
    session: string; cause: string; subject: string; discriminator: string;
    prompt: string; causeKey: string;
}[] {
  // ONLY WHEN THE SHELF IS EMPTY. An epic left whole while there is claimable work is a priority call,
  // not a defect; it becomes the org's most urgent question only when there is nothing else to pick up.
  if (readyRows.length > 0) return [];
  const unfiled = unfiledEpics(epics);
  return unfiled.slice(0, MAX_ROW_ORDERS_PER_TICK).map((e: any) => ({
    session: "product-manager",
    cause: "epic-unfiled",
    subject: `epic-${subjectRef(e.repoKey, e.number)}`,
    discriminator: subjectRef(e.repoKey, e.number),
    prompt: `NOTHING IS READY AND ${subjectMention(e)}${e.title ? ` (${e.title})` : ""} IS AN OPEN EPIC WITH NO `
      + "SUB-ISSUES. An epic with no children is not a container -- it is work nobody has filed, and it "
      + "is invisible to every other cause because `epic` means NOT PICKABLE.\n"
      + "Split it into rows an engineer can claim (a Region, an Acceptance, a done-when), using "
      + `\`gh issue edit <child> --parent ${e.number}\` so the link is DATA rather than prose. An epic `
      + "waiting on a decision or a release is correctly whole: say so on it and move on -- leaving it "
      + "whole and recording why is a valid answer, and READ ITS OWN RECENT COMMENTS FIRST -- a durable "
      + "reason recorded there stands until something about this epic itself changes, not just until the "
      + "next unrelated epic gets filed.\n"
      + "PREFER THE ONES THE FLEET CAN ALREADY SERVE. The fleet is the org's scarcest resource and it "
      + "sits idle when capture work is unfiled; a `fleet-gated` epic is where the idle capacity is.",
    causeKey: `product-manager/epic-unfiled/epic-${subjectRef(e.repoKey, e.number)}`,
  }));
}

/**
 * EPICS WHOSE EVERY CHILD IS CLOSED -- finished work still sitting in the backlog.
 *
 * `unfiledEpics` asks `total === 0`. NOTHING ASKED THE OPPOSITE QUESTION, and `subIssuesSummary` was
 * already on the read: the gate has been fetching `completed` since #1784 and discarding it.
 *
 * MEASURED 2026-09-21, when the chairman asked why nothing was running. 30 open rows, 0 Ready, and
 * exactly ONE row in the whole org an engineer could take. Of the 27 backlog rows, 13 were `epic` --
 * and NINE of those thirteen had every child closed:
 *
 *   #1317 10/10   #142 1/1   #65 1/1   #40 1/1   #37 1/1   #36 1/1   #35 2/2   #34 2/2   #31 1/1
 *
 * #1317 is "Adopt rstest as the test runner", ten children, all ten merged. It is not work. None of them
 * are. The backlog read as 27 rows deep when it held about four real ones, and THAT is why the org
 * running out of work went unnoticed -- every count that matters, `ready-queue-empty`'s own included, is
 * taken over a population padded with finished epics.
 *
 * THE ORDER ASKS, IT DOES NOT ASSERT. Every child closed does NOT prove the epic is done: it equally
 * means the next tranche has not been filed yet, which is the more valuable of the two answers and the
 * one a "close this" order would talk the reader out of. Both outcomes are recorded on the epic, so the
 * next reader inherits the judgment rather than re-deriving it.
 *
 * A WAITING EPIC IS WAITING, not finished -- the same filter `unfiledEpics` carries, for #1780's reason.
 */
export function finishedEpics(epics: any[], today: string = todayIso()) {
  return (epics ?? [])
    .filter((e) => {
      const total = e?.subIssuesSummary?.total ?? 0;
      return total > 0 && (e?.subIssuesSummary?.completed ?? 0) === total;
    })
    .filter((e) => waitingOn(e, today) === null);
}

/**
 * One order per finished epic, capped and keyed per epic -- #1799's ruling, for its reason: a causeKey
 * built from the COUNT is re-minted every time an unrelated epic closes, so a judgment already made gets
 * re-litigated on someone else's progress.
 *
 * WHATEVER IS READY (#4042). It was shelf-empty until 2026-10-08, on #1848's argument that a padded backlog only
 * MISLEADS ABOUT ANYTHING THAT MATTERS when the queue has run dry. That was wrong in the case that cost us: the
 * chairman reads the board when the queue is NOT dry, and a finished epic is a false row on it on every tick it sits
 * there -- #2899 at 13 of 13 for three days, and #69 (23 of 23) until he pushed. The cost bound the argument leaned on
 * is gone with the read (`epicRowsOf` filters the all-open list the tick already holds), so nothing is left to trade.
 * `epicOrders` keeps ITS shelf bound: an unfiled epic is a supply question and matters when nothing is claimable.
 *
 * THE ORDER NAMES WHAT IS LEFT: the epic's own `## Done-when` lines (the body is on the read) beside the children count,
 * so the answer is to each done-when and not only "are the children closed". Still an ASK. Keyed per epic, so a judgment
 * already made is not re-litigated on someone else's progress.
 *
 * INCIDENT BEHIND THE ORDER'S TEXT (moved out of it, #3444: the agent reading the order cannot use it):
 * measured 2026-09-21, nine of the org's thirteen open epics were finished and the backlog read three times deeper than it was.
 */
export function finishedEpicOrders(epics: any[]): {
    session: string; cause: string; subject: string; discriminator: string;
    prompt: string; causeKey: string;
}[] {
  return finishedEpics(epics).slice(0, MAX_ROW_ORDERS_PER_TICK).map((e: any) => ({
    session: "product-manager",
    cause: "epic-finished",
    subject: `epic-${subjectRef(e.repoKey, e.number)}`,
    discriminator: subjectRef(e.repoKey, e.number),
    prompt: `${subjectMention(e)}${e.title ? ` (${e.title})` : ""} IS AN OPEN EPIC WHOSE EVERY CHILD IS CLOSED `
      + `(${e?.subIssuesSummary?.completed ?? 0} of ${e?.subIssuesSummary?.total ?? 0}).\n`
      + doneWhenNote(e.body)
      + "TWO ANSWERS, AND THE ORDER DOES NOT PRESUME WHICH. Either the line of work is FINISHED -- close "
      + "the epic -- or the next tranche of children has simply never been filed, which is the more "
      + "valuable answer because it is unfiled WORK, invisible to every other cause since `epic` means "
      + "NOT PICKABLE. File those rows (a Region, an Acceptance, a done-when) with "
      + `\`gh issue edit <child> --parent ${e.number}\`.\n`
      + "WHY THIS IS NOT BOOKKEEPING: a finished epic left open is counted as backlog by everything that "
      + "counts backlog, so the backlog reads deeper than it is -- which is how the org runs out of "
      + "work without anyone noticing.\n"
      + "RECORD THE ANSWER ON THE EPIC either way, and READ ITS OWN RECENT COMMENTS FIRST: a durable "
      + "reason recorded there stands until something about THIS epic changes.",
    causeKey: `product-manager/epic-finished/epic-${subjectRef(e.repoKey, e.number)}`,
  }));
}

/** The label `epic` carries: a container, NOT PICKABLE (it is in `NOT_PICKABLE`). */
export const EPIC_LABEL = "epic";

/**
 * The open epics, out of the all-open list the tick already holds -- no call of its own (#4042; it was `readEpics`, paid
 * only on an empty shelf). `epic` means NOT PICKABLE, so an epic is never in the Ready list and this is the only place
 * the gate sees one.
 *
 * `subIssuesSummary` AND NOT `blocking`: GitHub has both, and they mean different things. `blocking` is a dependency edge;
 * sub-issues are PARENTHOOD, which is what "has this epic been broken down" asks. Using the wrong one would have read #68
 * -- which blocks nothing and parents nothing -- as filed.
 */
export function epicRowsOf(openRows: any[]) {
  return openRows.filter((r) => labelsOf(r).includes(EPIC_LABEL));
}

/** The longest a quoted `## Done-when` may run: the order quotes the epic's own words, and an epic's section can be a page. */
const DONE_WHEN_MAX_LINES = 12;

const DONE_WHEN_MAX_LINE_CHARS = 400;

/**
 * The lines of an epic body's `## Done-when` section, up to the next heading. Fenced-code delimiters and blank lines are dropped;
 * the rest is quoted as written, capped so one long epic cannot flood the order. `[]` when the body has no such section.
 */
export function doneWhenLines(body: string | null | undefined): string[] {
  const lines = String(body ?? "").split(/\r\n|\r|\n/);
  const start = lines.findIndex((l) => /^\s*#{1,6}\s+done[- ]when\b/i.test(l));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^\s*#{1,6}\s/.test(l));
  return (end === -1 ? rest : rest.slice(0, end))
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("```"))
    .slice(0, DONE_WHEN_MAX_LINES)
    .map((l) => (l.length > DONE_WHEN_MAX_LINE_CHARS ? `${l.slice(0, DONE_WHEN_MAX_LINE_CHARS)}...` : l));
}

/**
 * The part of a finished-epic order that says what is LEFT: the epic's done-when, to be answered line by line. An epic with
 * no such section says so, because "nothing to check against" is itself a finding for the reader.
 */
function doneWhenNote(body: string | null | undefined) {
  const lines = doneWhenLines(body);
  if (lines.length === 0) {
    return "THIS EPIC HAS NO `## Done-when` SECTION, so there is nothing recorded to check the closed children against.\n";
  }
  return "ITS OWN DONE-WHEN -- answer EACH line (met, or what is left), not only \"are the children closed\":\n"
    + `${lines.map((l) => `  > ${l}`).join("\n")}\n`;
}
