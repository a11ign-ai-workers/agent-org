// no-token: none -- every `claude` call is an injected stub and every tracker call is a stub port; nothing here reaches a tracker, a model or a pane.
/**
 * agent-org#1133: `serveByRun` APPLIES EVERY POST THE CLASS NAMED, NOT ONE. A `ready-queue-empty` answer names several rows, so the one-post, one-row rule sent it to the seat.
 *
 * POSITIVE CONTROL: a class whose answer posts and changes THREE rows, each its own item, is `served`, and each triple is applied once through `applyDecision`.
 * NEGATIVE CONTROL, each its own case: a post on a row the class did not name is refused before any row is written (`no-action`); a stale row part-way stops the batch, falls
 * back with `apply:stale`, and the reason names how many rows were already written; a change with no post on its row is refused; one post on the served row serves as before.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyDecision } from "./decision-run/apply.ts";
import type { DecisionAction, DecisionClass } from "./decision-run/registry.ts";
import { serveByRun, type ServeByRunDeps, type ServeOrder } from "./serve-by-run.ts";
import type { ItemRef, TicketItem, TicketPort } from "./ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "serve-by-run-1133-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

// --- the fixture: four shelved rows, one order about the first ----------------------------------------------------------------------------------

const SCOPE = "a11ign/agent-org";
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const ref = (id: number): ItemRef => ({ tracker: "github", scope: SCOPE, id });
const OPENED = { at: "2026-10-12T09:00:00.000Z", actor: "someone", kind: "item-opened" } as const;
const row = (id: number, events: TicketItem["events"] = [OPENED]): TicketItem => ({
  ref: ref(id), title: `Row ${id}`, body: `Row ${id} is a backlog row.`, state: "backlog", flags: [],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] }, events,
});
const rows = (): Map<number, TicketItem> => new Map([11, 12, 13, 14].map((id) => [id, row(id)]));
const SERVED = 11;
const ORDER: ServeOrder = { session: "ceo", cause: "answer-owed", causeKey: `ceo/answer-owed/${SCOPE}#${SERVED}`, prompt: "Decide the rows you examined, and say why in one sentence." };
const SEATS = JSON.stringify({ "answer-owed": "run" });
const RUN_REPLY = JSON.stringify({ structured_output: { answer: "approve", text: "It may start." }, session_id: "run-abc", total_cost_usd: 0.01,
  usage: { cache_read_input_tokens: 10, cache_creation_input_tokens: 5 } });

const post = (id: number): DecisionAction => ({ type: "post", item: ref(id), kind: "decision", text: "It may start." });
const change = (id: number): DecisionAction => ({ type: "change", item: ref(id), change: { state: "ready" } });
/** A class whose answer is `actions`, whatever the run said: the class's own reading is not what these cases test. */
const classWith = (actions: readonly DecisionAction[]): DecisionClass => ({
  cause: "answer-owed",
  schema: { type: "object", required: ["answer", "text"], properties: { answer: { type: "string" }, text: { type: "string" } } },
  allowed: ["approve", "hold"],
  buildQuestion: () => ({ text: "May they start?", default: "hold", allowed: ["approve", "hold"] }),
  actionsFor: () => actions,
});

/** A port over the given rows that logs each write with the row it went to. */
function portOver(items: Map<number, TicketItem>) {
  const log = { posts: [] as { id: number; decision: unknown }[], changes: [] as { id: number; change: unknown }[] };
  const port = {
    readItem: (r: ItemRef) => items.get(r.id) ?? null,
    postDecision: (r: ItemRef, decision: unknown) => { log.posts.push({ id: r.id, decision }); return `comment-${r.id}`; },
    changeState: (r: ItemRef, c: unknown) => { log.changes.push({ id: r.id, change: c }); return true; },
  } as unknown as TicketPort;
  return { port, log };
}

/** One serve of the order, with `actions` as the class's answer, and `applyDecision` wrapped so each row it is handed is named. */
async function serve(actions: readonly DecisionAction[], over: { named?: ServeByRunDeps["namedItems"]; items?: Map<number, TicketItem> } = {}) {
  const dir = fresh();
  writeFileSync(join(dir, "seats.json"), SEATS);
  const { port, log } = portOver(over.items ?? rows());
  const applied: number[] = [];
  const result = await serveByRun(ORDER, {
    classes: new Map([["answer-owed", classWith(actions)]]), seats: { path: join(dir, "seats.json") }, itemOf: () => ref(SERVED), port: () => port,
    run: { exec: async () => ({ exitCode: 0, stdout: RUN_REPLY, timedOut: false }), cwd: dir },
    stateDir: fresh(), roleExcerpt: () => "# ceo\nYou decide.", now: () => NOW,
    apply: (p, input) => { applied.push(input.ref.id); return applyDecision(p, input); },
    ...(over.named === undefined ? {} : { namedItems: over.named }),
  });
  return { result, log, applied };
}

// --- POSITIVE CONTROL ------------------------------------------------------------------------------------------------------------------------------

test("POSITIVE CONTROL: three posts, each on a different row the class named, are served and each row is applied once through applyDecision", async () => {
  const t = await serve([post(11), change(11), post(12), change(12), post(13), change(13)], { named: () => [ref(12), ref(13)] });
  assert.equal(t.result.outcome, "served", JSON.stringify(t.result));
  assert.deepEqual(t.applied, [11, 12, 13], "applyDecision was given each row, in order, once");
  assert.deepEqual(t.log.posts.map((p) => p.id), [11, 12, 13]);
  assert.deepEqual(t.log.changes, [11, 12, 13].map((id) => ({ id, change: { state: "ready" } })));
});

test("POSITIVE CONTROL: a row the class named that has no change is posted and changes nothing", async () => {
  const t = await serve([post(11), change(11), post(12)], { named: () => [ref(12)] });
  assert.equal(t.result.outcome, "served", JSON.stringify(t.result));
  assert.deepEqual(t.log.posts.map((p) => p.id), [11, 12]);
  assert.deepEqual(t.log.changes.map((c) => c.id), [11]);
});

test("POSITIVE CONTROL: one post and one change on the served row still serves exactly as before", async () => {
  const t = await serve([post(11), change(11)]);
  assert.equal(t.result.outcome, "served", JSON.stringify(t.result));
  assert.deepEqual(t.applied, [11]);
  assert.deepEqual(t.log.posts.map((p) => p.id), [11]);
});

// --- NEGATIVE CONTROL ------------------------------------------------------------------------------------------------------------------------------

test("NEGATIVE CONTROL: a post on a row the class did not name is refused before ANY row is written, and the order is the seat's", async () => {
  // Row 14 is posted and changed, but nothing named it. Rows 11 and 12 come before it in the answer and must not be written either.
  const t = await serve([post(11), change(11), post(12), change(12), post(14), change(14)], { named: () => [ref(12)] });
  assert.deepEqual(t.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(t.applied, [], "applyDecision was never called");
  assert.deepEqual(t.log, { posts: [], changes: [] }, "nothing was written");
});

test("NEGATIVE CONTROL: a row the class named, with a post on it and a change elsewhere, is refused", async () => {
  const t = await serve([post(11), change(11), change(12)], { named: () => [ref(12)] });
  assert.deepEqual(t.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(t.log, { posts: [], changes: [] });
});

test("NEGATIVE CONTROL: a stale row part-way stops the batch, falls back with apply:stale, and names how many rows were already written", async () => {
  // Row 12 gained an event after the brief was read, so the real apply finds it stale. Row 11 is written before it; row 13 is never reached.
  const items = rows();
  items.set(12, row(12, [OPENED, { at: "2026-10-12T10:00:01.000Z", actor: "someone", kind: "flag-added" }] as TicketItem["events"]));
  const t = await serve([post(11), change(11), post(12), change(12), post(13), change(13)], { named: () => [ref(12), ref(13)], items });
  assert.equal(t.result.outcome, "fallback", JSON.stringify(t.result));
  assert.deepEqual(t.result, { outcome: "fallback", reason: "apply:stale, 1 of 3 written" });
  assert.deepEqual(t.applied, [11, 12], "row 13 was never handed to applyDecision");
  assert.deepEqual(t.log.posts.map((p) => p.id), [11], "only the row written before the stale one is on the tracker");
});

test("NEGATIVE CONTROL: a stale first row names that none were written", async () => {
  const items = rows();
  items.set(11, row(11, [OPENED, { at: "2026-10-12T10:00:01.000Z", actor: "someone", kind: "flag-added" }] as TicketItem["events"]));
  const t = await serve([post(11), change(11), post(12)], { named: () => [ref(12)], items });
  assert.equal(t.result.outcome, "fallback", JSON.stringify(t.result));
  assert.deepEqual(t.result, { outcome: "fallback", reason: "apply:stale, 0 of 2 written" });
  assert.deepEqual(t.log, { posts: [], changes: [] });
});
