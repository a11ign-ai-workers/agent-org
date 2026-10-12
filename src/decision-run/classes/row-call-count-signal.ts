// no-token: none -- pure functions of the order and the item the port reads; nothing here spawns a process or writes anything.
// agent-org#908 (Move 3 of a11ign/a11ign#4505): THE `row-call-count-signal` CLASS -- SPLIT-OR-NOT OF ONE LONG-RUNNING CLAIM, DECIDED BY A ONE-SHOT RUN.
//
// A claim past the call threshold is one signal and one question: split the row, or say it is one unit. The default is `one-unit`, because the
// transcript sample #4505 cites found both sampled cases were "don't split": a run that cannot decide returns it and the seat is not woken twice.
//
// WHAT EACH ANSWER DOES. `one-unit` posts the reason, in the shape `formatRowCallCountAssessment` writes and `rowCallCountAssessedCalls` reads back, so
// the row stays exempt until its calls double, and changes nothing else. `split` and `escalate` post the reason and hand the order back to the standing
// seat with `answer-owed:<seat>`: a split is a Region and Acceptance rewrite, and a run never files rows.
//
// NOTHING IS SWITCHED ON. This file is a class; `seatModeOf("row-call-count-signal")` is `seat` until a project's `seats.json` says `run`, and that
// one-line entry is also its revert.
//
// THREE LIMITS OF THE CLASS SHAPE, each met rather than worked round:
//   * `actionsFor(answer, order)` is handed no item, so "the claim is still there" is checked where an item can be read, in `buildQuestion`, which
//     runs before any run is started. A gap that has gone THROWS {@link GapGoneError}; `serveByRun` turns a throw into a fallback to the seat, which
//     reads the row, finds nothing owed and posts nothing. After the brief, `applyDecision`'s own re-read refuses a row that changed (`stale`).
//   * the shape hands a class no repository either, so the row's tracker and scope are {@link ROW_TRACKER} and {@link ROW_SCOPE}, the first tracker's.
//     A project whose rows live elsewhere gets `no-action` from `applicable` (the ref does not match the order's own) and its seat.
//   * an order names a SET of rows (`rowCallCountOrders`'s key is `1,2,3`), and `itemOfKey` reads a set as no item: only an order naming ONE row is
//     served by a run, and the others go to the seat as today.
import { CLAIM_LABEL } from "../../claim-labels.ts";
import { formatRowCallCountAssessment } from "../../work-gate/row-call-count-orders.ts";
import type { ItemRef, TicketFlag, TicketItem, TicketPort } from "../../ticket-port/port.ts";
import type { BriefQuestion } from "../brief.ts";
import type { DecisionAction, DecisionClass, DecisionOrder } from "../registry.ts";

export const CAUSE = "row-call-count-signal";
export const ROW_TRACKER = "github";
export const ROW_SCOPE = "a11ign/agent-org";

/** The answers, and the one given when the run has nothing to add: the seat's own default. */
export const ONE_UNIT = "one-unit";
export const SPLIT = "split";
export const ESCALATE = "escalate";
export const ALLOWED = [ONE_UNIT, SPLIT, ESCALATE] as const;
export const DEFAULT_ANSWER = ONE_UNIT;

/** The state a claimed row is in (the port names it as the claim label does): the order's gap is a claim, and a row that left it has nothing to decide. */
export const CLAIMED_STATE: string = CLAIM_LABEL;

/** The tiers, and the one a run starts at when the tier question is not asked or not answered. A run is never a standing seat, so nothing is above Sonnet. */
export const TIER_DEFAULT = "haiku";
export const TIER_LARGER = "sonnet";
/** From this many calls the tier question says a wrong `one-unit` leaves a very long claim alone, so a low-confidence pick is worth the larger model. */
export const CALLS_FOR_LARGER_TIER = 300;
/** The most of a run's reason that is posted, in characters: a verdict is a sentence or two, and the row is read by a person. */
export const REASON_CAP_CHARS = 1200;

/** What this class adds to the shared prefix, from the product-manager brief's "sized to finish" section, and the most it may be in bytes. */
export const ROLE_EXCERPT_CAP_BYTES = 1024;
export const ROLE_EXCERPT = [
  "## row-call-count-signal: split the row, or say it is one unit",
  "A claimed row past about 100 calls is a split CANDIDATE, never an automatic split. Answer `one-unit` when the work is genuinely one thing (its Region is",
  "one module and its Acceptance one command); answer `split` only when the row names two deliverables that could merge apart; answer `escalate` when",
  "you cannot tell from the row. Scope added mid-claim is a new row, never a reason to split the old one. A split is a Region and Acceptance rewrite",
  "that the seat does: you never file rows. Give the reason in one or two sentences.",
].join("\n");

/** The gap is gone: the row is no longer a claim, so there is nothing to decide. */
export class GapGoneError extends Error {
  constructor(item: ItemRef, why: string) {
    super(`row-call-count-signal: ${item.scope}#${item.id} ${why}`);
    this.name = "GapGoneError";
  }
}

const rowOf = (order: Pick<DecisionOrder, "causeKey">): ItemRef | null => {
  const found = /\/(\d+)$/.exec(order.causeKey);
  return found === null ? null : { tracker: ROW_TRACKER, scope: ROW_SCOPE, id: Number(found[1]) };
};

/** The count the order's prompt names for its one row (`#908 (worker-x, 143 calls)`), or `null`: a count that cannot be read is never guessed. */
export function callsNamedIn(order: Pick<DecisionOrder, "prompt">): number | null {
  const found = /\((?:[^,()]+), (\d+) calls\)/.exec(order.prompt ?? "");
  return found === null ? null : Number(found[1]);
}

function claimedRow(order: DecisionOrder, port: Pick<TicketPort, "readItem">): TicketItem {
  const ref = rowOf(order);
  if (ref === null) throw new GapGoneError({ tracker: ROW_TRACKER, scope: ROW_SCOPE, id: 0 }, "is not named by the order's key");
  const item = port.readItem(ref);
  if (item === null) throw new GapGoneError(ref, "could not be read, so nothing is decided on a guess");
  if (item.state !== CLAIMED_STATE) throw new GapGoneError(ref, `is ${item.state ?? "in no state"}, not ${CLAIMED_STATE}: the claim the signal named is gone`);
  return item;
}

function buildQuestion(order: DecisionOrder, port: Pick<TicketPort, "readItem">): BriefQuestion {
  const item = claimedRow(order, port);
  const calls = callsNamedIn(order);
  return {
    text: `${item.ref.scope}#${item.ref.id} is claimed and its session has made ${calls ?? "more than the threshold of"} calls. Is it ONE UNIT that cannot reasonably be split smaller, `
      + "or should it be SPLIT? Read the row's Region and Acceptance in the body above. Answer `one-unit`, `split` or `escalate` and give the reason in one or two sentences.",
    default: DEFAULT_ANSWER,
    allowed: ALLOWED,
  };
}

/** The tier question: Haiku unless the provider picks Sonnet or answers under its floor (`serve-by-run`'s `tierFor`). */
function tierQuestion(order: DecisionOrder, port: Pick<TicketPort, "readItem">): BriefQuestion {
  const calls = callsNamedIn(order);
  const long = calls !== null && calls >= CALLS_FOR_LARGER_TIER;
  return {
    text: `Does deciding split-or-not for this row need the larger model? A wrong \`one-unit\` leaves a long claim alone${long ? `, and this one is at ${calls} calls (${CALLS_FOR_LARGER_TIER} or more)` : ""}. `
      + `Answer ${TIER_LARGER} only when the row's body is long or its Region unclear; otherwise ${TIER_DEFAULT}.`,
    default: TIER_DEFAULT,
    allowed: [TIER_DEFAULT, TIER_LARGER],
  };
}

const reasonOf = (answer: Record<string, unknown>): string => {
  const raw = typeof answer.text === "string" ? answer.text : typeof answer.reason === "string" ? answer.reason : "";
  return raw.trim().slice(0, REASON_CAP_CHARS);
};

function actionsFor(answer: unknown, order: DecisionOrder): readonly DecisionAction[] {
  if (typeof answer !== "object" || answer === null || Array.isArray(answer)) return [];
  const record = answer as Record<string, unknown>;
  const chosen = record.answer;
  if (typeof chosen !== "string" || !(ALLOWED as readonly string[]).includes(chosen)) return [];
  const item = rowOf(order);
  const reason = reasonOf(record);
  if (item === null || reason === "") return [];
  if (chosen === ONE_UNIT) {
    // The marker and `calls=N` are what the doubling guard compares; a prompt that names no count posts the reason alone, and the row signals again.
    const calls = callsNamedIn(order);
    const text = calls === null ? reason : formatRowCallCountAssessment({ calls, split: false, note: reason });
    return [{ type: "post", item, kind: "decision", text }];
  }
  // `split` and `escalate`: the reason is posted and the seat is owed the order. No marker: a split is not yet made.
  const owed: TicketFlag = `answer-owed:${typeof order.session === "string" && order.session !== "" ? order.session : "product-manager"}`;
  return [
    { type: "post", item, kind: "decision", text: `${chosen}: ${reason}` },
    { type: "change", item, change: { addFlags: [owed] } },
  ];
}

const rowCallCountSignal: DecisionClass = {
  cause: CAUSE,
  schema: {
    type: "object",
    required: ["answer", "text"],
    properties: { answer: { type: "string", enum: [...ALLOWED] }, text: { type: "string" } },
  },
  allowed: ALLOWED,
  buildQuestion,
  tierQuestion,
  actionsFor,
};

export default rowCallCountSignal;
