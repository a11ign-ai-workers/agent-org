// no-token: none -- reads an item through the port it is handed and returns actions for the caller to apply; nothing here writes, spawns or reaches a tracker.
// agent-org#911 (Move 3 of a11ign/a11ign#4505): THE `row-off-board` CLASS, THE UNLABELLED REMAINDER THE GATE CANNOT PLACE DECIDED BY A ONE-SHOT RUN.
//
// `settleOffBoardRows` (#490) boards a row whose label names a Status, so what still reaches `product-manager` is a row with no such label, a `parked` one, a row with two
// state labels or an epic. The decision is one item: which state the row's body supports, or that a person must look. This file is that decision as a class; nothing
// switches it on (`seatModeOf("row-off-board")` is `seat` until a project says `run`), and deleting the file or setting the cause to `seat` is the revert.
//
// THE DEFAULT IS `backlog`, the answer the seat gives when it has nothing to add, and `escalate` returns the order to the seat unchanged. EVERY DOUBT IS A WAKE, the
// gate's own rule (#490): a `ready` the facts do not support, a `parked` with no declared condition, an answer outside `allowed`, and an item whose gap is gone yield NO
// action, which `serve-by-run` reads as "no-action" and hands to the seat.
//
// HOW `actionsFor` KNOWS THE ITEM: it is called with the answer and the order only, and the rules for `ready` and `parked` are rules about the item. `buildQuestion` reads
// the item for the brief, so it keeps what it read, keyed on the order OBJECT (a WeakMap: nothing outlives the order). `actionsFor` on an order whose question was never
// built has nothing to judge by and yields none, which is "could not determine", not "nothing to do".
//
// WHICH REPOSITORY THE ITEM IS IN: the order's key names it as `<n>` or `<key>#<n>` (`itemOfKey`'s grammar, repeated here because that module reaches the wake path), and the
// project's declaration turns the key into a repository. A class file cannot take that as a parameter, so the default export is {@link rowOffBoardClass} over the declaration
// read ONCE at load, and a declaration that cannot be read is no repository for any key (`null`: cannot tell), so the order stays the seat's.
import type { ItemRef, StateChange, TicketFlag, TicketItem, TicketPort, TicketState } from "../../ticket-port/port.ts";
import type { BriefQuestion } from "../brief.ts";
import type { DecisionAction, DecisionClass, DecisionOrder } from "../registry.ts";

/** The wake cause this class serves, as `seats.json` and the gate name it. */
export const CAUSE = "row-off-board";

/** The answers the class permits, in the order the question lists them. */
export const ALLOWED = Object.freeze(["backlog", "ready", "parked", "epic", "escalate"] as const);
export type RowOffBoardAnswer = (typeof ALLOWED)[number];

/** The answer a run that cannot decide returns, and the seat's own when it has nothing to add. */
export const DEFAULT_ANSWER: RowOffBoardAnswer = "backlog";

/** The `kind` the decision is posted under: the one `settleOffBoardRows` writes, so the row's history reads the same whoever placed it. */
export const DECISION_KIND = "row-off-board";

/** The most of the run's one-line reason that is posted, in characters. */
export const REASON_CAP_CHARS = 600;

/** The tiers the tier question chooses between. */
export const TIER_DEFAULT = "haiku";
export const TIER_ESCALATED = "sonnet";
/** The confidence under which the tier question's pick is `sonnet`; it is written into the question, and the provider's own floor decides the rest (`serve-by-run`'s `tierFor`). */
export const SONNET_BELOW_CONFIDENCE = 0.8;

/**
 * The rules of this cause, from the role brief, that the class adds to the shared prefix. A test pins {@link ROLE_EXCERPT_CAP_BYTES}.
 */
export const ROLE_EXCERPT = [
  "Cause: row-off-board. The row has no item on Project 1 and no state label the gate could place it by. Give it the one state its body supports:",
  "- backlog: the default; a row that is real and not startable yet, or that you cannot place.",
  "- ready: only a row that is a plain backlog row with no blocker, no Waiting-for, no future Not-before and no answer owed.",
  "- parked: only when the row declares its condition: an open blocker, a Waiting-for line, a Not-before date or an answer owed. A parked row with none is a defect.",
  "- epic: an epic is boarded at Backlog in lane any; it is never ready.",
  "- escalate: anything else, and every doubt. The standing seat decides it.",
].join("\n");
export const ROLE_EXCERPT_CAP_BYTES = 900;

/** The JSON schema the run's answer is checked against: one allowed answer and a one-line reason. */
export const SCHEMA = Object.freeze({
  type: "object",
  required: ["answer", "text"],
  additionalProperties: false,
  properties: { answer: { type: "string", enum: [...ALLOWED] }, text: { type: "string" } },
});

type Facts = Readonly<{ ref: ItemRef; item: TicketItem }>;
const READ = new WeakMap<object, Facts>();

/** `itemOfKey`'s grammar: the last segment of the key is `<n>` for the first tracker or `<key>#<n>` for another's. */
function itemOfOrder(order: DecisionOrder, scopeOf: (key: string) => string | null): ItemRef | null {
  const found = /(?:^|\/)(?:([a-z0-9-]+)#)?(\d+)$/.exec(order.causeKey);
  if (found === null) return null;
  const scope = scopeOf(found[1] ?? "");
  return scope === null ? null : { tracker: "github", scope, id: Number(found[2]) };
}

/**
 * Whether the order's gap is still open on this item: the gate boards a row that carries a state, so a row with one (other than `parked`, which the gate leaves) has
 * nothing left for this decision, and a closed row has none either.
 */
export const gapOpen = (item: TicketItem): boolean => item.state === null || item.state === "parked";

/** The condition a `parked` answer needs, as the item declares it, or `null` when it declares none. A sentence in the body is not one. */
export function declaredCondition(item: TicketItem): string | null {
  const r = item.relations;
  if (r.blockedBy.length > 0) return "an open blocking edge";
  if (r.waitingFor.length > 0) return "a Waiting-for line";
  if (r.notBefore !== null) return "a Not-before date";
  if (item.flags.some((f) => f.startsWith("answer-owed:"))) return "an answer owed";
  return null;
}

/** Whether `ready` is supported: the promotion checks `unclaimed-blocker-cleared` makes, read from the item's own facts. */
export function startable(item: TicketItem, nowMs: number): boolean {
  const r = item.relations;
  if (r.blockedBy.length > 0 || r.waitingFor.length > 0 || item.flags.includes("hold")) return false;
  if (item.flags.some((f) => f.startsWith("answer-owed:"))) return false;
  if (r.notBefore === null) return true;
  const until = Date.parse(r.notBefore);
  return !Number.isNaN(until) && until <= nowMs;
}

const lineOf = (text: string): string => text.replace(/\s+/g, " ").trim();

function questionText(item: TicketItem | null): string {
  const read = item === null ? "" : ` It carries ${item.state === null ? "no state" : `the state \`${item.state}\``}${declaredCondition(item) === null ? " and declares no condition" : ` and declares ${declaredCondition(item)}`}.`;
  return [
    `Which state does this row's body support?${read}`,
    "Answer `backlog` unless the row clearly supports another; `ready` needs a plain row with nothing owed or awaited,",
    "`parked` needs a condition the row itself declares, `epic` is for an epic, and `escalate` hands the row to the standing seat.",
    "Give a one-line reason in `text`.",
  ].join(" ");
}

/** What the class is, over `scopeOf` and a clock. Exported so a test can name both; the default export is this over the project's declaration. */
export function rowOffBoardClass(scopeOf: (trackerKey: string) => string | null, now: () => number = Date.now): DecisionClass {
  return Object.freeze({
    cause: CAUSE,
    schema: SCHEMA,
    allowed: ALLOWED,

    buildQuestion(order: DecisionOrder, port: Pick<TicketPort, "readItem">): BriefQuestion {
      const ref = itemOfOrder(order, scopeOf);
      const item = ref === null ? null : port.readItem(ref);
      if (ref !== null && item !== null) READ.set(order, { ref, item });
      return { text: questionText(item), default: DEFAULT_ANSWER, allowed: ALLOWED };
    },

    tierQuestion(_order: DecisionOrder, _port: Pick<TicketPort, "readItem">): BriefQuestion {
      return {
        text: `Is a model other than the smallest needed to place this row? Answer \`${TIER_ESCALATED}\` when you are under ${Math.round(SONNET_BELOW_CONFIDENCE * 100)}% sure `
          + "which state its body supports, or it has two state labels, an epic label or a Waiting-for or Not-before line; otherwise answer "
          + `\`${TIER_DEFAULT}\`.`,
        default: TIER_DEFAULT,
        allowed: [TIER_DEFAULT, TIER_ESCALATED],
      };
    },

    actionsFor(answer: unknown, order: DecisionOrder): readonly DecisionAction[] {
      const facts = READ.get(order);
      if (facts === undefined || !gapOpen(facts.item)) return [];
      const given = typeof answer === "object" && answer !== null ? (answer as Record<string, unknown>) : {};
      const choice = given.answer;
      if (typeof choice !== "string" || !(ALLOWED as readonly string[]).includes(choice)) return [];
      const picked = choice as RowOffBoardAnswer;
      if (picked === "escalate") return [];
      const { ref, item } = facts;

      let change: StateChange;
      if (picked === "backlog") change = { state: "backlog" };
      else if (picked === "ready") {
        if (!startable(item, now())) return [];
        change = { state: "ready" };
      } else if (picked === "parked") {
        if (declaredCondition(item) === null) return [];
        change = { state: "parked" };
      } else {
        // An epic is boarded at Backlog in lane any (`row-file --board=<n> --lane=any`, #4456), and never gets `ready`.
        const lane = item.flags.some((f) => f.startsWith("lane:"));
        change = lane ? { state: "backlog" } : { state: "backlog", addFlags: ["lane:any" satisfies TicketFlag] };
      }
      const reason = typeof given.text === "string" ? lineOf(given.text).slice(0, REASON_CAP_CHARS) : "";
      const state: TicketState | undefined = change.state;
      const text = `row-off-board: ${picked}${state === undefined ? "" : ` -> ${state}`}${reason === "" ? "" : `. ${reason}`}`;
      return [{ type: "post", item: ref, kind: DECISION_KIND, text }, { type: "change", item: ref, change }];
    },
  } satisfies DecisionClass);
}

/** The project's tracker key as a repository, read once and lazily: a declaration that cannot be read answers `null` for every key. */
let declared: ((key: string) => string | null) | undefined;
async function declaredScopeOf(): Promise<(key: string) => string | null> {
  if (declared !== undefined) return declared;
  try {
    const { homeProjectDeclaration } = await import("../../project-config.ts");
    const project = homeProjectDeclaration();
    declared = (key) => (key === "" ? project.repo : project.tracker.find((tracker) => tracker.key === key)?.repo ?? null);
  } catch {
    declared = () => null;
  }
  return declared;
}

export default rowOffBoardClass(await declaredScopeOf());
