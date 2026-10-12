// no-token: none -- a class file: it builds a question and maps an answer to port changes; it spawns nothing and reaches no tracker.
// agent-org#906 (Move 3 of a11ign/a11ign#4505): THE CLASS `org-health` -- THE DAY'S BOARD-TRUTH TABLE, POSTED BY A ONE-SHOT RUN OR HANDED BACK TO THE SEAT.
//
// Two answers. `posted` posts the table the order carries as a decision comment on the tracker's record issue (a11ign#928) through the port. `escalate` writes
// nothing, so `serveByRun` finds no action and the standing seat is prompted with the order; it is also the default, so a run that cannot decide hands the order
// back and the seat is not woken twice.
//
// THE LINE BETWEEN A READING AND A FIX: a run never writes a per-row field fix. A table that names a row needing one is `escalate`, naming the row, and the seat does
// the write. The excerpt says so and so does code: `actionsFor` yields exactly one post for `posted` and nothing for any other answer, and a `posted` whose text
// names no row-fix imperative is the only one that passes, because a prompt that is the only guard is a guard the run can talk past.
//
// Nothing here switches the class on: `seatModeOf("org-health")` stays `seat` until a project says otherwise.
import { homeProjectDeclaration } from "../../project-config.ts";
import type { ItemRef } from "../../ticket-port/port.ts";
import type { BriefQuestion } from "../brief.ts";
import type { DecisionAction, DecisionClass, DecisionOrder } from "../registry.ts";

export const CAUSE = "org-health";
export const POSTED = "posted";
export const ESCALATE = "escalate";
export const ALLOWED = [POSTED, ESCALATE] as const;

/** The number of the tracker's record issue the day's table is posted on (`board-truth-audit.ts` `TABLE_ROW`, kept equal by the test). */
export const RECORD_ID = 928;

/** The record issue, in the repository the project declares for its first tracker (`key: ""`). `null` when none is declared: no item, and so no action (#2616). */
export function recordItem(): ItemRef | null {
  const repo = homeProjectDeclaration().tracker.find((t) => t.key === "")?.repo;
  return repo === undefined ? null : { tracker: "github", scope: repo, id: RECORD_ID };
}

/** Haiku unless the provider's pick or its confidence says otherwise; Sonnet is never a standing seat. `serveByRun` moves to Sonnet on a pick or an answer under the floor. */
export const TIER_DEFAULT = "haiku";
export const TIER_LARGER = "sonnet";

/** The most the role excerpt may weigh, in bytes. The shared prefix is never trimmed, so the class bounds its own part of it. */
export const ROLE_EXCERPT_CAP_BYTES = 1400;

export const ROLE_EXCERPT = [
  "## org-health: the gate has computed a board-truth table; you read it and post it, you do not fix rows",
  "- The order names which checks tripped and which rows. Read it against the item's recent comments.",
  "- `posted`: the table is complete and nothing in it needs a field written. Put the table in `text`. It is posted on the record issue.",
  "- `escalate`: any row needs a field fix (a label, a wait, a state), a check is unread, or you cannot tell. Name the row in `row`. The standing seat does the write; you never do.",
  "- A table that says `0 disagree` is `posted`; silence is not health, so an unread check is `escalate`.",
  "- If you are unsure, escalate. A wrong post costs more than waking the standing seat.",
].join("\n");

const SCHEMA = {
  type: "object",
  required: ["answer", "text"],
  additionalProperties: false,
  properties: {
    answer: { type: "string", enum: [...ALLOWED] },
    text: { type: "string" },
    row: { type: "string" },
  },
} as const;

/**
 * What marks a text as asking for a per-row write rather than reading. Deliberately broad: a false match costs one wake of the seat, a miss lets a run write a fix.
 * It is applied to the text of a `posted` answer, which is a reading and so has no business directing a write.
 */
export const FIX_PATTERN = /(?:gh\s+(?:issue|project)\s+(?:edit|item-edit)|item-edit|--add-label|--remove-label|remove the label|add the label|set the (?:field|state)|close (?:the )?row)/i;

/** What `buildQuestion` learned about an order, for `actionsFor`, which is not given the item. Keyed by the order, overwritten each time it is asked. */
const read = new Map<string, { flagHeld: boolean }>();

/** The flag the order puts on the record issue: `org-health:<session>`, the session the order is addressed to. */
const flagOf = (order: DecisionOrder): string | null =>
  order.session === undefined || order.session === "" ? null : `org-health:${order.session}`;

/** The item an `org-health` order is served on: always the record issue. An order that is not this cause's is no item. */
export function itemOf(order: Pick<DecisionOrder, "causeKey">): ItemRef | null {
  return /(?:^|\/)org-health\//.test(order.causeKey) ? recordItem() : null;
}

export function buildQuestion(order: DecisionOrder, port: Parameters<DecisionClass["buildQuestion"]>[1]): BriefQuestion {
  const record = recordItem();
  const item = record === null ? null : port.readItem(record);
  const flag = flagOf(order);
  const flagHeld = item !== null && flag !== null && (item.flags as readonly string[]).includes(flag);
  read.set(order.causeKey, { flagHeld });
  const text = [
    `The gate's org-health reading tripped and \`${flag ?? "org-health:<session>"}\` is on the record issue. The order said: ${order.prompt ?? "(no text)"}`,
    "If the table is complete and no row needs a field written, answer `posted` with the table in `text`. If any row needs a fix, or any check is unread, answer `escalate` naming the row in `row`: you read, the standing seat writes.",
    ...(flagHeld ? [] : ["This item must be `escalate`: the order's flag is no longer on it, so there is nothing to decide."]),
  ].join("\n");
  return { text, default: ESCALATE, allowed: flagHeld ? [...ALLOWED] : [ESCALATE] };
}

/** The question that picks the tier. The default is Haiku; `serveByRun` moves to Sonnet when the provider picks it or answers under its confidence floor. */
export function tierQuestion(): BriefQuestion {
  return {
    text: "Which model should read one day's board-truth table? Choose `haiku` unless the table has several findings whose fix is unclear, then `sonnet`.",
    default: TIER_DEFAULT,
    allowed: [TIER_DEFAULT, TIER_LARGER],
  };
}

export function actionsFor(answer: unknown, order: DecisionOrder): readonly DecisionAction[] {
  if (typeof answer !== "object" || answer === null) return [];
  const { answer: chosen, text } = answer as { answer?: unknown; text?: unknown };
  // Anything but `posted` (`escalate` included, and a name outside `allowed`) is no action.
  if (chosen !== POSTED) return [];
  const seen = read.get(order.causeKey);
  // Never asked, or the flag already gone: no action, and the standing seat has the order.
  if (seen === undefined || !seen.flagHeld || flagOf(order) === null) return [];
  if (typeof text !== "string" || text.trim() === "" || FIX_PATTERN.test(text)) return [];
  const record = recordItem();
  if (record === null) return [];
  return [{ type: "post", item: record, kind: "board-truth", text }];
}

const orgHealth: DecisionClass = { cause: CAUSE, schema: SCHEMA, allowed: ALLOWED, buildQuestion, tierQuestion, actionsFor };
export default orgHealth;
