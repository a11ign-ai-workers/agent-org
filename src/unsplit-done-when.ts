// @ts-check
// UNSPLIT DONE-WHEN (a11ign/a11ign#4640, class `row-not-finishable`; the chairman, 2026-10-09: READY MEANS FINISHABLE): a Done-when item that no engineer
// can finish from claim to merge is a different row. `row-file` refuses a body carrying one unless that part is its own row, and offers the split.
//
// THREE CLASSES OF ITEM THE ROW CANNOT FINISH THROUGH, each a fact a worker would sit holding the claim for (worker-3870 held #3870 idle while the gate
// deferred other ready rows for lack of an engineer; #4438 and #4441 were held claimed 10.5 h by a read-back an engineer could not make):
//   future-time   the item is true only LATER: `on day 3`, `after 2026-10-12`, `in three days`, a timestamp after the filing clock.
//   seat-act      a seat or the chairman is the actor of the verb: `ceo approves`, `confirmed by the chairman`, `product-manager's ruling`.
//   row-outcome   another row's outcome: `once #4438 merges`, `after #4441 closes`, `waits on #12`.
//
// NOT REFUSED, and each has a pinned control: a wait that is ALREADY DATA on the row (a `Not-before:` line, a `Waiting-for:` line, a `Waits-on-done-when:` line,
// a `--blocked-by` edge, an `answer:<session>` or `needs:chairman` label), because the gate, not the engineer, holds that wait; and a row, a seat or a date that
// is only CITED (`see #4437`, `routing: ceo's comments`, `before 2026-10-20`, a deadline being a bound on the work and no wait for it).
//
// A FOURTH KIND IS NOT A REFUSAL (a11ign/agent-org#719): `live-check`, an item that names a READING of the live system after the merge (a quoted record on a row, a switch read on,
// a log line after the merge, a published version). `row-file` does not refuse it and `unfinishableItems` does not return it; `liveCheckItems` is its own reader, which
// `verify-row.ts` files as the verify row. A seat's act stays `seat-act` and another row's outcome stays `row-outcome`: neither is a reading a verify row could take.
//
// A FOURTH REFUSAL, `post-merge-act` (a11ign/agent-org#751): an item that is an ACT needing the merged result to be true, with no time, seat or row named: a run or an
// `--apply` on the host against the live store, a comment or message to another row "that the fix is in force", "with the merge commit", an act "after the release" or
// "once installed". #475's item 2 and #560's item 2 read `[]` under the three above and each held a worker for hours after its pull request merged. The line against
// `live-check` is the VERB: a reading is something the system says (a record quoted on a row, a switch read on) and a verify row takes it; an act is something somebody
// does to the live system or tells another row, and the refusal names the split (`file the build row; the verify row follows it`). Both patterns can match one item:
// `unfinishableItems` returns it, so `row-file` refuses a NEW row carrying it, and `liveCheckItems` still returns it, so a row filed before this closes as it did.
//
// A LEAF: pure, no network and no `gh`. `row-file.ts` owns the call and the exit code; the clock and the label list arrive as arguments.
import { parseWaits, namedDoneWhens } from "./wait-condition.ts";
import { notBeforeDate } from "./waiting-condition.ts";
import { ANSWER_PREFIX, NEEDS_CHAIRMAN_LABEL } from "./project-vocabulary.ts";

export type UnfinishableClass = "future-time" | "seat-act" | "row-outcome" | "post-merge-act";
export type UnfinishableItem = { text: string; kind: UnfinishableClass; evidence: string; rows: number[]; };
/** A Done-when item that names a reading of the live system after the merge; `evidence` is the phrase that said so, `rows` is always empty (the shape of {@link UnfinishableItem}). */
export type LiveCheckItem = { text: string; kind: "live-check"; evidence: string; rows: number[]; };
/** What the row already carries as data. `blockedBy` and `labels` are the filing's own arguments, which the body cannot hold. */
export type RowDeclarations = { blockedBy?: readonly number[]; labels?: readonly string[]; };

const DONE_WHEN_HEADING = /^[ \t]*#{1,6}[ \t]*done[- ]when\b/i;
const ANY_HEADING = /^[ \t]*#{1,6}[ \t]/;
const ITEM_START = /^ {0,3}(?:\d+[.)]|[-*+])[ \t]+/;
const FENCE = /^[ \t]*(```|~~~)/;
const ISO_INSTANT = /(?<!\w)(\d{4}-\d{2}-\d{2})(T\d{2}:\d{2}(?::\d{2})?Z?)?(?!\w)/g;
const DEADLINE_BEFORE_DATE = /\b(?:before|by|within|no later than)\s+$/i;
const ROW_REFERENCE = "(?:(?:the\\s+)?(?:row|pr|pull request|issue)\\s+)?(?:[\\w.-]+/[\\w.-]+)?#(\\d+)";
const COUNT = "(?:a|an|one|two|three|four|five|six|seven|\\d+)";
const UNIT = "(?:minute|hour|day|week|month)s?";

const RELATIVE_TIME: readonly RegExp[] = [
  /\bon day \d+\b/i,
  /\b(?:tomorrow|overnight)\b/i,
  /\bnext (?:week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  new RegExp(`\\b(?:in|after|within)\\s+${COUNT}\\s+${UNIT}\\b`, "i"),
  new RegExp(`\\b${COUNT}\\s+${UNIT}\\s+(?:later|after|from now)\\b`, "i"),
];

const SEAT = "(?:the\\s+)?(?:product-manager|ceo|orchestrator|chairman)";
const MODAL = "(?:(?:also|then|must|will|has|have|can|may|should|first|explicitly)\\s+)*";
const ACT = "(?:approves?|approved|signs? off|signed off|rules?|ruled|confirms?|confirmed|accepts?|accepted|replies|replied|answers?|answered|posts?|posted|reads?|read|"
  + "reviews?|reviewed|decides?|decided|lifts?|lifted|releases?|released|reports?|reported|declares?|declared|greenlights?|says?|said|agrees?|agreed|verif(?:y|ies|ied)|"
  + "checks?|checked|disposes?|disposed|runs?|ran|merges?|merged|publishes?|published)";
const SEAT_NOUN = "(?:approval|ruling|sign-off|confirmation|answer|reply|verdict|decision|reading|go-ahead)";

const SEAT_ACT: readonly RegExp[] = [
  new RegExp(`\\b${SEAT}\\s+${MODAL}${ACT}\\b`, "i"),
  new RegExp(`\\b${ACT}\\s+by\\s+${SEAT}\\b`, "i"),
  new RegExp(`\\b${SEAT}(?:'s|\\u2019s)\\s+${SEAT_NOUN}\\b`, "i"),
  new RegExp(`\\b${SEAT_NOUN}\\s+(?:from|of|by)\\s+${SEAT}\\b`, "i"),
];

const ROW_OUTCOME_VERB = "(?:merges|merged|closes|closed|lands|landed|ships|shipped|finishes|finished|completes|completed|publishes|published|is done|is merged|is closed|is published|"
  + "has merged|has closed|has landed|is finished|is complete)";
const ROW_OUTCOME: readonly RegExp[] = [
  new RegExp(`\\b(?:once|after|when|until|following)\\s+${ROW_REFERENCE}\\s+${ROW_OUTCOME_VERB}\\b`, "i"),
  new RegExp(`\\b(?:waits?|waiting|blocked|depends?|dependent)\\s+(?:for|on|by|upon)\\s+${ROW_REFERENCE}\\b`, "i"),
  new RegExp(`(?<![\\w/])${ROW_REFERENCE}(?:'s|\\u2019s)\\s+(?:merge|close|landing|outcome|reading|verdict|completion)\\b`, "i"),
];

/** The Done-when ITEMS of a body: a numbered or bulleted line with its wrapped continuations, else one item per paragraph. Fenced blocks are not items. */
export function doneWhenItems(body: string | null | undefined): string[] {
  const items: string[] = [];
  let inSection = false;
  let fenced = false;
  let wrapping = false;
  for (const line of String(body ?? "").split(/\r\n|\r|\n/)) {
    if (FENCE.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    if (DONE_WHEN_HEADING.test(line)) { inSection = true; continue; }
    if (ANY_HEADING.test(line)) { inSection = false; continue; }
    if (!inSection) continue;
    if (line.trim() === "") { wrapping = false; continue; } // a blank line ends the item: a following paragraph is its own
    if (ITEM_START.test(line) || !wrapping) items.push(line.replace(ITEM_START, "").trim());
    else items[items.length - 1] += ` ${line.trim()}`;
    wrapping = true;
  }
  return items;
}

// A LIVE CHECK, each pattern a reading nobody can take before the merge. Deliberately NARROW: a false negative is caught by the reopen rule (a build closed without its
// live quote), a false positive files a row nobody can finish. So a bare `live` or `quoted` is not enough, and `live reading` alone is not a pattern: a build row that
// DESCRIBES its verify row ("the live reading is its own row") would file one for the sentence.
const WITHIN = "(?:[^.]|\\.(?=\\d))*?"; // up to the end of the sentence: a dot inside `1.4.2` is not one
const ROW_QUOTED_ON = "(?:on|in|to)\\s+(?:the\\s+)?(?:row\\s+|issue\\s+)?(?:[\\w.-]+/[\\w.-]+)?#(\\d+)";
const LIVE_CHECK: readonly RegExp[] = [
  new RegExp(`\\bquot(?:e|es|ed|ing)\\b${WITHIN}\\b${ROW_QUOTED_ON}`, "i"),
  new RegExp(`\\b(?:switch|flag|toggle|setting|gate)\\b${WITHIN}\\b(?:reads?|reported|shows?|showing|reading)\\s+(?:as\\s+)?(?:on|live|enabled)\\b`, "i"),
  /\b(?:is|are|goes|went|is now|are now)\s+live\b/i,
  /\b(?:after|following|post)[- ](?:the\s+|this\s+)?(?:merge|deploy|deployment|release|rollout)\b/i,
  /\bpublished\s+(?:version|release|package|build)\b/i,
  new RegExp(`\\b(?:version|release|package)\\b${WITHIN}\\b(?:is|are|was)\\s+(?:published|released|live)\\b`, "i"),
  /\bin production\b/i,
];
/** What an item QUOTES or names in code is a reference to a reading, not the ask: `a test whose Done-when reads "quoted on #4627"` is not itself a live check. */
const QUOTED_SPAN = /"[^"]*"|\u201c[^\u201d]*\u201d|`[^`]*`/g;

// A POST-MERGE ACT: an act verb and a place or moment that exists only once the change is merged, in ONE sentence (`WITHIN` stops at the full stop). Deliberately NARROW for the
// same reason as LIVE_CHECK: a false positive refuses a row someone can finish and a false negative is the status quo. So `merged` alone is no anchor ("the pull request is
// merged" is every row's first item), a bare `run` is no act (the acceptance command is run), and `after the run` is no anchor (a test says "the file is unchanged after the run").
const RAN = "(?:run|runs|ran|re-?runs?|execut(?:e|es|ed)|appl(?:y|ies|ied)|invok(?:e|es|ed))";
const TOLD = "(?:told|tell|tells|notif(?:y|ies|ied)|inform(?:s|ed)?|messag(?:e|es|ed)|ping(?:s|ed)?|comment(?:s|ed)?|post(?:s|ed)?|report(?:s|ed)?|say|says|said|writ(?:e|es|ten)|wrote|noted?)";
const LIVE_SYSTEM = "(?:host|box|machine|server|store|system|tracker|fleet|database)";
const LIVE_PLACE = `(?:on|against|in)\\s+(?:the\\s+(?:agents?|production|live|real)\\s+${LIVE_SYSTEM}|the\\s+host|production)`;
const SINCE_RELEASE = "(?:after|once|when|following)\\s+(?:the\\s+)?(?:release|(?:it\\s+is\\s+|it's\\s+|is\\s+)?(?:installed|released|deployed|published))";
const IN_FORCE = "(?:is|are|has been|have been)\\s+(?:now\\s+)?(?:in force|in effect|live|installed|released|deployed|shipped|landed)";
const POST_MERGE_VERB = `(?:${RAN}|${TOLD})`;
const POST_MERGE_ACT: readonly RegExp[] = [
  new RegExp(`\\b${RAN}\\b${WITHIN}\\b${LIVE_PLACE}\\b`, "i"), // `is run on the host`, `applied against the live store`
  new RegExp(`\\b${LIVE_PLACE}\\b${WITHIN}\\b${RAN}\\b`, "i"), // `on the host, the migration is run`
  /\blive\s+(?:run|apply)\b/i, // `a live run`, as against `--dry-run`
  new RegExp(`\\b${TOLD}\\b${WITHIN}\\bthat\\b${WITHIN}\\b${IN_FORCE}\\b`, "i"), // `is told ... that the fix is in force`
  /\bwith\s+the\s+merge\s+commit\b/i,
  new RegExp(`\\b${TOLD}\\b${WITHIN}\\b(?:naming|citing|quoting|giving)\\s+the\\s+merge\\s+commit\\b`, "i"), // a bare `names the merge commit` is a test's description of code
  new RegExp(`\\b${POST_MERGE_VERB}\\b${WITHIN}\\b${SINCE_RELEASE}\\b`, "i"), // `is run once installed`
  new RegExp(`\\b${SINCE_RELEASE}\\b${WITHIN}\\b${POST_MERGE_VERB}\\b`, "i"), // `after the release, ceo is told`
];

/** An item that SAYS the act is another row's (`they are their own VERIFY row`, `is NOT this row's item`) describes a split already made and asks nothing of this row (measured: #476). */
const DISOWNED = /\bverify row\b|\b(?:own|separate|follow-up|second)\s+row\b|\bnot\s+(?:this|the)\s+row's\b/i; // `on its row` / `to another row` is where the act IS done: not here
/** A verify row says what it follows (`Verifies: #N`, which `verify-row.ts` writes): the act in it IS the split, and its blocked-by edge is on the issue, not in the body. */
const VERIFIES_LINE = /^[ \t]*Verifies:[ \t]*(?:[\w.-]+\/[\w.-]+)?#\d+\b/m;

/** The phrase that makes an item an act on the merged result, or `null`. What an item QUOTES in code is a reference, never the ask (as for a live check). */
function postMergeActEvidence(item: string): string | null {
  const bare = item.replace(QUOTED_SPAN, " ");
  return DISOWNED.test(bare) ? null : firstMatch(POST_MERGE_ACT, bare)?.[0] ?? null;
}

/** The first instant in an item that is LATER than `now` and is not a deadline (`before`, `by`), as written; `null` when none. A date-only value is midnight UTC. */
function laterInstant(item: string, now: Date): string | null {
  for (const m of item.matchAll(ISO_INSTANT)) {
    if (DEADLINE_BEFORE_DATE.test(item.slice(0, m.index))) continue;
    const written = m[0];
    const time = (m[2] ?? "T00:00").replace(/Z$/, "");
    const at = Date.parse(`${m[1]}${time.length === "THH:MM".length ? `${time}:00` : time}Z`);
    if (Number.isFinite(at) && at > now.getTime()) return written;
  }
  return null;
}

function firstMatch(patterns: readonly RegExp[], item: string): RegExpExecArray | null {
  for (const pattern of patterns) {
    const found = pattern.exec(item);
    if (found) return found;
  }
  return null;
}

/** The three kinds a LIVE-CHECK reader leaves alone; `post-merge-act` is deliberately not here (see the header: a row filed before it closes as it did). */
function classify(item: string, now: Date): Omit<UnfinishableItem, "text"> | null {
  const instant = laterInstant(item, now);
  if (instant) return { kind: "future-time", evidence: instant, rows: [] };
  const relative = firstMatch(RELATIVE_TIME, item);
  if (relative) return { kind: "future-time", evidence: relative[0], rows: [] };
  const seat = firstMatch(SEAT_ACT, item);
  if (seat) return { kind: "seat-act", evidence: seat[0], rows: [] };
  const row = firstMatch(ROW_OUTCOME, item);
  if (row) return { kind: "row-outcome", evidence: row[0], rows: [Number(row[1])] };
  return null;
}

function liveCheckEvidence(item: string, self: number | undefined): string | null {
  const bare = item.replace(QUOTED_SPAN, " ");
  for (const pattern of LIVE_CHECK) {
    const found = pattern.exec(bare);
    if (!found) continue;
    if (self !== undefined && found[1] !== undefined && Number(found[1]) === self) continue; // a record quoted on the build's OWN row is the engineer's completion, not a live reading
    return found[0];
  }
  return null;
}

/**
 * The Done-when items that name a LIVE CHECK: a reading that exists only after the merge. An item that is `future-time`, `seat-act` or `row-outcome` is not returned
 * (the first is a reading already, the others are what a verify row cannot take). `self` is the build's own number.
 */
export function liveCheckItems(body: string, { now = new Date(), self }: { now?: Date; self?: number; } = {}): LiveCheckItem[] {
  return doneWhenItems(body).flatMap((text) => {
    if (classify(text, now) !== null) return [];
    const evidence = liveCheckEvidence(text, self);
    return evidence === null ? [] : [{ text, kind: "live-check" as const, evidence, rows: [] }];
  });
}

/** Is the wait this item names ALREADY DATA on the row, so the gate holds it and the engineer never does? */
function alreadyData(found: Omit<UnfinishableItem, "text">, { body, declared }: { body: string; declared: RowDeclarations; }): boolean {
  const readable = parseWaits(body).filter((wait) => wait.state !== "unreadable");
  if (found.kind === "future-time") return notBeforeDate(body) !== null || readable.length > 0;
  if (found.kind === "seat-act") {
    const labels = (declared.labels ?? []).map((label) => label.toLowerCase());
    return readable.length > 0 || labels.some((label) => label.startsWith(ANSWER_PREFIX) || label === NEEDS_CHAIRMAN_LABEL);
  }
  if (found.kind === "post-merge-act") return (declared.blockedBy ?? []).length > 0 || namedDoneWhens(body).length > 0 || readable.length > 0 || VERIFIES_LINE.test(body); // the act already FOLLOWS something: this IS the verify row
  const edges = new Set([...(declared.blockedBy ?? []), ...namedDoneWhens(body).map((named) => named.row)]);
  const waited = readable.flatMap((wait) => [...wait.text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])));
  return found.rows.every((row) => edges.has(row) || waited.includes(row));
}

/** Every Done-when item the row cannot finish through and does not already carry as data. `[]` is a row that is finishable as written. */
export function unfinishableItems(body: string, { now = new Date(), declared = {} }: { now?: Date; declared?: RowDeclarations; } = {}): UnfinishableItem[] {
  return doneWhenItems(body).flatMap((text) => {
    const act = postMergeActEvidence(text);
    const found = classify(text, now) ?? (act === null ? null : { kind: "post-merge-act" as const, evidence: act, rows: [] }); // an item already `future-time` keeps that kind: one item, one finding
    return found && !alreadyData(found, { body, declared }) ? [{ text, ...found }] : [];
  });
}

/** What the SECOND row would carry for this item: the data that makes the wait the gate's. */
function carriedData(item: UnfinishableItem): string {
  if (item.kind === "future-time") {
    const absolute = /^\d{4}-\d{2}-\d{2}/.test(item.evidence) ? item.evidence : "<YYYY-MM-DDTHH:MM:SSZ the wait ends>";
    const stamp = absolute.includes("T") || absolute.startsWith("<") ? absolute : `${absolute}T00:00:00Z`;
    return `a \`Not-before: ${stamp}\` line (seconds and the \`Z\` are required)`;
  }
  if (item.kind === "seat-act") {
    return `the owner label: \`${ANSWER_PREFIX}<session>\` for a seat's act (removing it IS the answer), or \`${NEEDS_CHAIRMAN_LABEL}\` with a \`BRIEF for the chairman\` for the chairman's`;
  }
  if (item.kind === "post-merge-act") {
    return "`--blocked-by <the build row>` (and `Waits-on-done-when: <build>.<k>` when it has several done-whens): file the build row, with the code and without this item; "
      + "the verify row follows it, so the act is taken after the merge by the row that was filed to take it";
  }
  const [row] = item.rows;
  return `\`--blocked-by ${row}\` (and \`Waits-on-done-when: ${row}.<k>\` when #${row} has several done-whens), or a \`Waiting-for: closed|merged #${row}\` line`;
}

/**
 * THE REFUSAL, with the split offered: for each item, the exact second row's Done-when and the data it carries. `null` means proceed.
 * @returns {string | null}
 */
export function unsplitDoneWhenRefusal(body: string, options: { now?: Date; declared?: RowDeclarations; } = {}): string | null {
  const items = unfinishableItems(body, options);
  if (items.length === 0) return null;
  const lines = items.map((item, i) => `  ${i + 1}. [${item.kind}: \`${item.evidence}\`] "${item.text}"\n`
    + `     SECOND ROW's Done-when: "${item.text}"\n     it carries: ${carriedData(item)}.`);
  return `row-file: REFUSING to file -- ${items.length} Done-when item(s) name something no engineer can finish from claim to merge (a future time, a seat's or the chairman's act, `
    + "another row's outcome, or an act that needs the merged result), so the row would be claimed and then held idle on it (READY MEANS FINISHABLE; worker-3870 sat on #3870, #4438 and #4441 were held 10.5 h):\n"
    + `${lines.join("\n")}\n`
    + "File each as its OWN row with that Done-when and the data above, and take the item out of THIS row's Done-when (or put the wait on THIS row as data: a `Not-before:`, a "
    + `\`Waiting-for:\`, a \`Waits-on-done-when:\`, a \`--blocked-by\` edge, an \`${ANSWER_PREFIX}<session>\` label). A row that only CITES a row, a seat or a date is not refused. Nothing was filed.`;
}
