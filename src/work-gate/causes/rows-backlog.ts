import { READY_LABEL, CLAIM_LABEL } from "../../claim-labels.ts";
import { ANSWER_PREFIX } from "../../waiting-condition.ts";
import { subjectMention, subjectRef } from "../../review-attribution.ts";
import { NEEDS_CHAIRMAN_LABEL as CHAIRMAN_LABEL } from "../../project-vocabulary.ts";
import { HOUR_MS, MAX_ROW_ORDERS_PER_TICK, PARKED_LABEL, PROMOTION_ASK_WINDOW_MS, labelsOf, laneOwnerOf, ownerOf, standingText } from "../vocabulary.ts";

/** How long a promotable `backlog` row may sit with no promotion decision before `product-manager` is asked (#2848). */
export const AGED_BACKLOG_MS = 24 * 60 * 60 * 1000;

/**
 * BACKLOG ROWS OLDER THAN 24 HOURS WITH NO PROMOTION DECISION, to `product-manager` (#2848, the second question beside the
 * repeating-line one: both are a thing that stays true and that nobody reads).
 *
 * "NO DECISION" IS READ OFF THE ROW, NEVER GUESSED: `promotableRows` already dropped every row that carries a decision in a
 * FIELD -- a `blockedBy` edge, `Not-before:`, `answer:<session>`, `parked`, `needs:chairman`, and every `NOT_STARTABLE` label
 * (blocked, epic, decision, meta, ...) -- so what is left is a row somebody could promote and nobody has, and its age is
 * the time that has been true. The row's age is its `createdAt`: GitHub gives no date for when `backlog` was applied without a
 * timeline call per row, and a row demoted again by a declined claim (`was-ready`) reads old, which errs toward asking.
 *
 * ONE ORDER PER ROW AND THE SET IN EVERY PROMPT, `laneBacklogOrders`' discipline (#1799): the key follows the row, so one row's
 * answer is not re-litigated when another is filed, and a session is delivered one order per tick, so the prompt carries the
 * rest. Oldest first, capped at `MAX_ROW_ORDERS_PER_TICK`.
 */
export function agedBacklogOrders(promotableRows: any[], now: number = Date.now()): { session: string; cause: string; subject: string; discriminator: string; prompt: string; causeKey: string; }[] {
  const aged = promotableRows
    .map((row) => ({ row, ageMs: now - Date.parse(row?.createdAt) }))
    .filter(({ ageMs }) => Number.isFinite(ageMs) && ageMs > AGED_BACKLOG_MS)
    .sort((a, b) => b.ageMs - a.ageMs);
  const named = aged.map(({ row, ageMs }) => `${subjectMention(row)} (${standingText(ageMs)}${row.title ? `, ${row.title}` : ""})`);
  return aged.slice(0, MAX_ROW_ORDERS_PER_TICK).map(({ row, ageMs }, i) => ({
    session: "product-manager",
    cause: "backlog-aged-unpromoted",
    subject: `row-${subjectRef(row.repoKey, row.number)}`,
    discriminator: "aged",
    prompt: `${subjectMention(row)}${row.title ? ` (${row.title})` : ""} HAS BEEN IN BACKLOG ${standingText(ageMs)} WITH NO PROMOTION DECISION. `
      + `It carries no wait -- no \`blockedBy\` edge, \`Not-before:\`, \`${ANSWER_PREFIX}<session>\`, \`${PARKED_LABEL}\` or \`${CHAIRMAN_LABEL}\` -- and no unpickable `
      + `label, so nothing says why it is not \`${READY_LABEL}\` and nothing else will ask: \`lane-backlog-unpromoted\` fires only when a lane `
      + "owner has nothing Ready, and `ready-queue-empty` only on an empty shelf.\n"
      + `PROMOTE IT, OR RECORD WHY NOT AS DATA: a \`${READY_LABEL}\` label is the promotion; a wait goes in a FIELD (\`--add-blocked-by <n>\`, `
      + `\`Not-before: YYYY-MM-DDTHH:MM:SSZ\`, \`${ANSWER_PREFIX}<session>\`), which clears itself and stops this being asked.`
      + (named.length > 1 ? `\nALSO AGED (${named.length - 1}): ${named.filter((_, j) => j !== i).slice(0, MAX_ROW_ORDERS_PER_TICK).join("; ")}.` : ""),
    causeKey: `product-manager/backlog-aged-unpromoted/row-${subjectRef(row.repoKey, row.number)}`,
  }));
}

/**
 * One order per lane whose owner has backlog and nothing Ready.
 *
 * SPLIT OUT OF `decide` because adding it took that function past
 * `local/max-physical-lines-per-function` 90 and the pre-push gate refused it. The seam is the real
 * one: `decide` asks what the whole queue needs, this asks what each LANE OWNER is sitting on.
 */
export function laneBacklogOrders(promotableRows: any[], readyRows: any[]) {
  const orders = [];
  // OWNERS, NOT LANES. A row reaches its owner by a `lane:` label OR by a routing label, and iterating
  // lanes could only ever find the first -- which is why `orchestrator`, whose work is routed by
  // `fleet-gated` rather than laned, was never told about any of it.
  // THE OWNERS ARE DERIVED FROM THE ROWS, NOT FROM A STATIC LIST. A static
  // `[...LANE_OWNER, ...ROUTED_TO]` was correct until `ownerOf` gained a third source -- an unlaned
  // `decision` routes to `product-manager`, which appears in neither map, so two rows (#1798, #1734)
  // resolved to an owner and then produced no order at all. A list that must be updated whenever
  // `ownerOf` gains a case is a list that will not be.
  const owners: Set<string | readonly string[]> = new Set(promotableRows.map((r: any) => ownerOf(r))
    .filter((o: string | readonly string[] | null) => o !== null));
  for (const owner of owners) {
    // REFERENCE EQUALITY, DELIBERATELY, for a pool owner: `ROUTED_TO`'s value is one frozen array
    // shared by every row it routes, never rebuilt per row, so grouping and re-filtering by `===` finds
    // every row in the pool exactly as it did when every owner was a string.
    const mine = promotableRows.filter((r) => ownerOf(r) === owner);
    const readyHere = readyRows.filter((r) => ownerOf(r) === owner
      && !labelsOf(r).includes(CLAIM_LABEL));
    if (mine.length === 0 || readyHere.length > 0) continue;
    orders.push(...backlogOrders(owner, mine));
  }
  return orders;
}

/**
 * THE REST OF THIS OWNER'S QUEUE, NAMED IN EVERY ORDER -- because a session gets ONE ORDER PER TICK.
 *
 * `wake.ts`'s `deliver` marks a session `working` the moment it is prompted, so a second order in the
 * same tick is refused -- "you cannot type two prompts into a live terminal" is correct and is not going
 * to change. Before 2026-09-20 that cost nothing, because this cause emitted ONE order per owner naming
 * up to eight rows: a session got its whole queue in one prompt and could work several in one turn.
 *
 * #1799's fix re-keyed the cause PER ROW so a standing judgment stopped being re-litigated whenever an
 * unrelated row moved. That was right. THE IMPLEMENTATION SERIALISED THE OWNER'S QUEUE: one order per
 * row, one delivered per tick, and each of the others then deduped for the two-hour judgment TTL.
 *
 * MEASURED 2026-09-21, and the chairman is the one who noticed: `orchestrator` spent the day reasoning
 * correctly about #1768's capture window -- a row that cannot move for TWELVE HOURS -- while #1663,
 * #1042, #914 and #1830 sat with nothing stopping them and ten workers idle. Its answers were sound
 * every time; it was never told the others existed in the same breath.
 *
 * SO THE KEY STAYS PER ROW AND THE PROMPT CARRIES THE SET. Both properties, neither traded: the ledger
 * still dedupes one row's judgment without touching another's, and one turn can still clear several.
 */
function alsoOwned(mine: any[], current: any) {
  const others = mine.filter((r: any) => r.number !== current.number);
  if (others.length === 0) return "";
  const named = others.slice(0, MAX_ROW_ORDERS_PER_TICK)
    .map((r: any) => subjectMention(r)).join(", ");
  return `YOU ALSO OWN ${others.length} OTHER ACTIONABLE ROW(S): ${named}`
    + `${others.length > MAX_ROW_ORDERS_PER_TICK ? ", ..." : ""}.\n`
    + `IF #${current.number} CANNOT MOVE RIGHT NOW -- it waits on a clock, a capture window, or a `
    + "decision you do not own -- DO NOT END YOUR TURN THERE. Record why on it, then take the next row "
    + "on that list and work that instead. YOU GET ONE ORDER PER TICK, so the others are not coming in a "
    + "minute: each is deduped for two hours once offered, and the fleet or the queue sits idle "
    + "meanwhile. Working several of them in one turn is the intended use, not an overreach.";
}

/**
 * The orders a lane owner's backlog deserves -- ONE PER ROW, keyed on the row.
 *
 * KEYED PER ROW BECAUSE A STANDING JUDGMENT IS ABOUT A ROW, NOT ABOUT A COUNT. This used to emit one
 * order keyed `.../<count>`, and #1799 showed why that is wrong for `epic-unfiled`: the count conflates
 * *did the population I still need to judge change* with *did something unrelated get filed*. Every time
 * ANY row entered or left the lane the count moved, the causeKey changed, and `JUDGMENT_TTL_MS` could no
 * longer protect the rows whose answer had not changed. #1806 fixed `epic-unfiled` that way; this is the
 * same fix, applied to the cause the SAME LEDGER shows the SAME defect in.
 *
 * MEASURED 2026-09-20 on the live ledger -- twelve deliveries to `orchestrator` over 10.4 hours:
 *
 *   /3 /3 /2 /2 /3 /4 /7 /6 /5 /3 /3 /3
 *
 * SEVEN OF THE TWELVE fired INSIDE the two-hour TTL, at gaps of 4, 18, 4, 22, 27, 10 and 57 minutes --
 * each one a `sonnet`/`high` turn re-asking about rows already judged. The five that behaved are the
 * ones where the count happened not to move.
 *
 * THE PROMPT IMPROVES BY THE SAME CHANGE. "You own 7 rows, promote what is ready" is a survey; "#1663 is
 * in your lane and nothing is Ready" is a question with an answer, which is what this file's own header
 * asks of every prompt.
 *
 * A POOL OWNER GETS ONE ORDER PER NAME, NOT ONE ORDER FOR THE PAIR -- #1828. `wake.ts` routes one order
 * to one session, so a single order naming both `orchestrator` and `worker-capture` would reach neither
 * reliably; the row must recruit whichever of the two is free, exactly as an unlaned Ready row already
 * does for the engineer pool.
 */
function backlogOrders(owner: string | readonly string[], mine: any[]) {
  const names = Array.isArray(owner) ? owner : [(owner as string)];
  return names.flatMap((name) => mine.slice(0, MAX_ROW_ORDERS_PER_TICK).map((r: any) => ({
    session: name,
    cause: "lane-backlog-unpromoted",
    subject: `row-${subjectRef(r.repoKey, r.number)}`,
    discriminator: subjectRef(r.repoKey, r.number),
    prompt: `${subjectMention(r)} is an open backlog row you own and there is NOTHING Ready among your rows.`
      + (laneOwnerOf(r) === name
        ? " It carries your lane: nobody else may promote it."
        : " It carries `fleet-gated`, which ROUTES rather than blocks -- the acceptance needs the fleet"
          + " or the lab, which you run. Check the fleet is up (`pnpm run fleet:status`) first; this row"
          + " is not waiting on hardware being broken.")
      + "\nPromote it if it is genuinely ready (a Region, an Acceptance, a done-when), answer it if it "
      + "waits on a decision, or say on the row why it should stay put -- leaving it and recording why "
      + "is a valid answer.\n"
      + "READ ITS OWN RECENT COMMENTS FIRST: a durable reason recorded there stands until something "
      + "about THIS row changes, not until an unrelated row moves (#1799).\n"
      + "RECORD THE ANSWER ON THE ROW, whatever it is. A decision that exists only in your terminal is "
      + "one the org cannot see: the next reader finds an untouched row and re-derives it from scratch.\n"
      + alsoOwned(mine, r),
    causeKey: `${name}/lane-backlog-unpromoted/row-${subjectRef(r.repoKey, r.number)}`,
  })));
}

/** The chairman reminder's grid: one window opens at each multiple of this since the epoch (the UTC day). */
export const CHAIRMAN_REMINDER_PERIOD_MS = 24 * HOUR_MS;

/**
 * PURE. The UTC day the chairman reminder is open in at `nowMs`, or `null` outside its window -- #2989.
 *
 * WHY THE KEY IS THE CALENDAR DAY AND NOT AN AGE READ OFF THE ROWS. The order used to key on
 * `daysSince(oldest updatedAt)`, and `ceo` answers it by COMMENTING on the rows, which writes `updatedAt`: the
 * age read 0 for ever, the key never moved, `wake` re-delivered it every `JUDGMENT_TTL_MS` until
 * `MAX_DELIVERIES`, and then the tick printed `STUCK ceo/chairman-blocked/0` on every run (31 ticks in an hour;
 * 89 by the time an engineer picked the row up). A discriminator derived from a field the ANSWER writes cannot
 * advance, so the cap was reached by the answerer's own diligence. The label's own time would fix that but costs
 * a timeline read per row; the grid costs nothing and is not written by anybody.
 *
 * A DAILY KEY ALONE WOULD NOT HAVE BEEN ENOUGH: `wake` re-delivers an unchanged key every two hours, so one day's
 * key reaches the cap of six in ten hours and is `STUCK` for the other fourteen. So the order is emitted only
 * inside a window exactly `PROMOTION_ASK_WINDOW_MS` (= `JUDGMENT_TTL_MS`) long at the start of each day --
 * `promotionAskWindow`'s mechanism (#2286): one delivery per window with no state kept, and the cause going
 * unemitted between windows is what lets the ledger write its `RESET`. A window whose order was never
 * delivered is retried every tick until it closes, then not until tomorrow: the stated cost.
 *
 *  @returns `day` is whole days since the epoch
 */
export function chairmanReminderWindow(nowMs: number): { day: number; } | null {
  const day = Math.floor(Math.max(0, nowMs) / CHAIRMAN_REMINDER_PERIOD_MS);
  const opened = day * CHAIRMAN_REMINDER_PERIOD_MS;
  return nowMs - opened >= PROMOTION_ASK_WINDOW_MS ? null : { day };
}

/**
 * The one order for work only the chairman can do, or none.
 *
 * SPLIT OUT OF `decide` because it took that function past 90 physical lines and the pre-push gate
 * refused it -- the fourth such split, and the seam is the same each time: `decide` asks what the
 * queue needs, each helper asks one narrower question.
 *
 * @param chairmanBlocked rows waiting on the chairman, oldest first
 * @param [nowMs] injectable so a test is not wall-clock dependent
 */
export function chairmanOrders(chairmanBlocked: any[], nowMs: number = Date.now()) {
  // THE ORG CANNOT WAKE A HUMAN, so this wakes the session whose brief says it briefs one. `ceo` is the
  // only onward route the escalation path has, and until now that route was a sentence rather than a
  // mechanism -- #63 sat four days blocking eight publish-gated rows because nothing carried it.
  //
  // A STANDING DAILY REMINDER, keyed on the UTC day and emitted only in that day's window
  // (`chairmanReminderWindow`). Keyed on the row set it would fire once and fall silent for ever -- the
  // permanent-ledger bug again; keyed on the rows' `updatedAt` it never advanced (#2989).
  const open = chairmanBlocked.length === 0 ? null : chairmanReminderWindow(nowMs);
  if (!open) return [];
  const rows = chairmanBlocked.slice(0, 6).map((r: any) => subjectMention(r)).join(", ");
  const date = new Date(open.day * CHAIRMAN_REMINDER_PERIOD_MS).toISOString().slice(0, 10);
  return [{
    session: "ceo",
    cause: "chairman-blocked",
    subject: "chairman",
    discriminator: `day-${open.day}`,
    prompt: `${chairmanBlocked.length} row(s) are labelled \`${CHAIRMAN_LABEL}\` and can only move by the `
      + `chairman's own hands: ${rows}${chairmanBlocked.length > 6 ? ", ..." : ""}.\n`
      + `This is the STANDING DAILY REMINDER for ${date} (UTC), sent once a day for as long as the label `
      + "stands: it does not say anything new happened, and it is NOT keyed on the rows' activity -- your own "
      + "comments on them do not silence or repeat it. Read each row for when the chairman was last "
      + "actually asked.\n"
      + "Brief the chairman: what is waiting, what it blocks downstream, and the single next action in "
      + "their hands. If a row no longer needs them, take the label off -- a stale one here makes the "
      + "count meaningless, which is how the last escalation went four days unread.",
    causeKey: `ceo/chairman-blocked/day-${open.day}`,
  }];
}

/**
 * The order asking `product-manager` to stock an empty POOL shelf, or `null` when it is not empty.
 *
 * SPLIT OUT OF `decide` when B4 shelving landed. The prompt now has to say WHICH of two things emptied
 * the shelf, and `decide` was already at `local/max-physical-lines-per-function` 90.
 *
 * IT NAMES THE BLOCKED ROWS RATHER THAN HIDING THEM, and that is not decoration. Shelving a B4-blocked
 * row means nobody is woken for it -- which is how a queue starves in silence, the same shape this order
 * already exists to catch one level up. And a blocked row is NOT one to promote past: it is waiting on a
 * pull request, so promoting another row over the same files just moves the refusal. The counts are
 * reported; which rows are genuinely promotable stays a judgment, for the reason below.
 *
 * THE SHELF ITSELF IS WORK, and nothing asked about it until 2026-09-17. Measured that day: 92 open
 * issues, 87 of them `backlog`, ZERO `ready`, and five engineers idle. The gate's engineer question is
 * "a `ready` row without `in-progress`", which was honestly no -- so it reported a quiet org while every
 * engineer waited behind an empty queue. `dispatcher` is retired and its brief's line survives it:
 * "the Ready column. It pulls; THIS ROLE STOCKS." The stocker had no trigger.
 *
 * FACTS, NOT A TARGET, and that distinction is the whole design. `product-manager`'s brief says Ready
 * holds at least three product rows; this does not ask for three. `ready:audit` exists because
 * `dispatcher` once labelled two rows `ready` TO HIT THAT FLOOR -- one disputed, one with no Region or
 * Acceptance -- and recorded the rule this obeys: *"a floor met by a label I control is not a
 * measurement."* A number here would buy relabelling. The order reports what is on the shelf and what
 * is behind it; which rows are genuinely promotable is a judgment and stays with the reader.
 *
 * ONLY WHEN THE SHELF IS EMPTY. A queue with anything in it is a queue the engineers can pull from, and
 * re-prompting on a short-but-non-empty Ready would be the floor by another name.
 * THE POOL'S SHELF, NOT THE WHOLE SHELF, and that distinction had three engineers idle. This counted
 * every unclaimed Ready row, so 14 rows Ready read as a well-stocked queue -- while 11 of them were
 * `lane:ceo` and 3 `lane:orchestrator` and NOT ONE was takeable by an engineer. Measured 2026-09-18,
 * minutes after lane routing shipped: ceo and orchestrator woke, promoted their own lanes, and went to
 * work, and the pool stayed starved because the shelf now looked full.
 *
 * It is the original empty-shelf defect one level down: a queue full of work nobody in that pool may
 * take is an EMPTY QUEUE TO THEM. `laneOwnerOf` already says who a row belongs to; a row with an owner
 * is somebody's, and the lane orders above are what ask them about it.
 *
 * AND B4-BLOCKED IS THE THIRD READING OF THAT SAME SHAPE (2026-09-18). A row an engineer may take but
 * cannot CLAIM is as empty to them as one that belongs to somebody else -- measured the same day the
 * lane reading above was, on the same three rows. The lane was never the whole answer there: #1452,
 * #1397 and #1320 all declare `.github/workflows/release.yml` and all sat behind draft #1695, so
 * re-laning them to `lane:any` would have handed an engineer the identical refusal.
 *
 * INCIDENT BEHIND THE ORDER'S TEXT (moved out of it, #3444: the agent reading the order cannot use it):
 * measured 2026-09-21: this cause's own audit examined #1731, concluded correctly that it had no Region, no Acceptance and no done-when, and
 * declined to promote it -- while the defect it describes had been fixed 17 HOURS EARLIER by #1764, with 30 sweep runs since and zero
 * failures. It was the only row between the queue and empty, and it was already done.
 *
 * @param state `key` is the tracker's key, so two trackers' counts are two ledger keys
 */
export function emptyShelfOrder({ offerable, blocked, promotable, key }: {
        offerable: any[]; blocked: { number: number; owner: string | null; reason: string; }[];
        promotable: number; key?: string;
    }) {
  const pool = offerable.filter((r) => laneOwnerOf(r) === null);
  if (pool.length > 0 || promotable === 0) return null;
  const poolBlocked = blocked.filter((b) => b.owner === null);
  const laned = offerable.length - pool.length;
  const why = [
    laned > 0 ? `${laned} unclaimed row(s) belong to a lane` : "",
    poolBlocked.length > 0
      ? `${poolBlocked.length} unlaned row(s) blocked (`
        + poolBlocked.map((b) => `${subjectMention(b)}: ${b.reason}`).join("; ")
        + ")"
      : "",
  ].filter(Boolean).join(", and ");
  return {
    session: "product-manager",
    cause: "ready-queue-empty",
    subject: "ready-queue",
    // THE COUNT IS THE DISCRIMINATOR, so the order stops repeating the moment a row is promoted and
    // re-fires if the shelf empties again at a different depth. Keyed on anything constant it would
    // nag every two minutes until someone acted, which is how a wake becomes noise to route around.
    discriminator: subjectRef(key, promotable),
    prompt: `The Ready queue has NOTHING an engineer may take${why ? ` -- ${why}` : ""} -- and `
      + `${promotable} unlaned backlog row(s) carry no label that means unpickable (not blocked, `
      + "fleet-gated, epic, disputed, decision, awaiting-merge, review-only or already claimed). Every "
      + "engineer is waiting on this queue rather than on work.\n"
      + (poolBlocked.length > 0
        // EACH ROW NAMES ITS OWN REASON ABOVE -- a B4 pull-request overlap and a declared `blockedBy`/
        // `Not-before:` wait clear by entirely different mechanisms (#1885), so this can promise only
        // what is true of every blocked row: promoting past it does not remove what is actually stopping it.
        ? "The blocked rows above are NOT rows to promote past: each names its own reason, and the work "
          + "that frees it belongs to whatever that reason names -- a pull request, a blocking issue, a "
          + "date, a missing template section -- not necessarily a pull request. Promoting a row whose Region overlaps another open "
          + "PR only moves that particular refusal.\n"
        : "")
      + "ASK OF EACH ROW: IS IT STILL TRUE? -- before asking whether it is promotable. A row can fail "
      + "every promotion test and still be FINISHED, and nothing else in this org checks.\n"
      + "Promote what is genuinely ready -- a row with a Region, an Acceptance and a done-when -- and "
      + "leave the rest. This is deliberately NOT a request to reach a count: #ready:audit records "
      + "`dispatcher` labelling two rows ready to hit a floor, one disputed and one with neither field, "
      + "and a floor met by a label you control is not a measurement. Promoting nothing and saying why "
      + "is a valid answer.\n"
      + "RECORD WHAT YOU FOUND, ON THE ROWS YOU EXAMINED. An audit whose conclusion exists only in your "
      + "terminal is one the next audit must derive again from scratch -- and this one did: the 07:19Z "
      + "sweep reached a complete, well-argued verdict on #1731 and left no trace on it, so the same "
      + "reasoning was due to be repeated every two hours indefinitely.",
    causeKey: `product-manager/ready-queue-empty/${subjectRef(key, promotable)}`,
  };
}
