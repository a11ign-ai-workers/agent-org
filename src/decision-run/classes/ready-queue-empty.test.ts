// no-token: none -- every port, `claude` and provider call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#910 (Move 3 of a11ign/a11ign#4505): THE CLASS `ready-queue-empty`.
 *
 * POSITIVE CONTROL: against a fixture item of this cause the question holds the order, its default (`none-promotable`) and the allowed answers, each allowed answer yields
 * exactly its declared actions, the class is a loadable `DecisionClass`, and a single examined row posts through `serveByRun`.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; a row that left the shelf yields none; a promotion with an open edge, no Open-check, no
 * head or another head yields none; the tier question with no provider answers Haiku and with a low-confidence pick Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cls, {
  ALLOWED, ESCALATE, MAX_ROWS, NONE_PROMOTABLE, PROMOTE, RECORD_ITEM, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, TIER_DEFAULT, TIER_LARGER, actionsFor, buildQuestion, itemOf, refOf, tierQuestion,
} from "./ready-queue-empty.ts";
import { loadClasses, whyNotClass, type DecisionOrder } from "../registry.ts";
import { serveByRun, type ServeOrder } from "../../serve-by-run.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "ready-queue-empty-910-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

const HEAD = "c0cf4112";
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const ORDER: ServeOrder = {
  session: "product-manager", cause: "ready-queue-empty", subject: "ready-queue", discriminator: "3", causeKey: "product-manager/ready-queue-empty/3",
  prompt: `The Ready queue has NOTHING an engineer may take -- and 3 unlaned backlog row(s) carry no label that means unpickable.\nHead: ${HEAD}`,
};
const NO_HEAD: ServeOrder = { ...ORDER, prompt: "The Ready queue has NOTHING an engineer may take." };
const ROW_A: ItemRef = { tracker: "github", scope: "a11ign/a11ign", id: 11 };
const ROW_B: ItemRef = { tracker: "github", scope: "a11ign/agent-org", id: 12 };
const itemFor = (ref: ItemRef, over: Partial<TicketItem> = {}): TicketItem => ({
  ref, title: "A row", state: "backlog", flags: [], events: [],
  body: "## What it is\nA row.\n\n## Open-check\nRead at origin/main = `c0cf4112`.",
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  ...over,
});
type Items = Record<string, Partial<TicketItem> | null>;
const key = (r: ItemRef): string => `${r.scope}#${r.id}`;
/** A port over `{ "<scope>#<id>": overrides | null }`; the record issue and every listed row are readable unless `null`. */
const portOf = (items: Items = {}) => ({
  readItem: (ref: ItemRef): TicketItem | null => {
    const k = key(ref);
    if (k in items) return items[k] === null ? null : itemFor(ref, items[k] ?? {});
    return itemFor(ref);
  },
});
const stubPort = (items: Items = {}) => {
  const log = { posts: [] as unknown[], changes: [] as unknown[] };
  const port = {
    ...portOf(items),
    postDecision: (_ref: ItemRef, d: unknown) => { log.posts.push(d); return "c-1"; },
    changeState: (_ref: ItemRef, c: unknown) => { log.changes.push(c); return true; },
  } as unknown as TicketPort;
  return { port, log };
};
const NONE = { answer: "none-promotable", text: "Each is finished or unready.", rows: ["#11", "agent-org#12"] };
const PROMOTE_ANSWER = { answer: "promote", text: "Premise holds.", rows: ["#11"], openCheckHead: HEAD };

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions", () => {
  const q = buildQuestion(ORDER, portOf(), NOW);
  assert.ok(q.text.includes(ORDER.prompt as string), "the order is in the question");
  assert.equal(q.default, NONE_PROMOTABLE);
  assert.deepEqual(q.allowed, [...ALLOWED]);
  assert.deepEqual(actionsFor(NONE, ORDER), [
    { type: "post", item: ROW_A, kind: "none-promotable", text: NONE.text },
    { type: "post", item: ROW_B, kind: "none-promotable", text: NONE.text },
  ]);
  assert.deepEqual(actionsFor(PROMOTE_ANSWER, ORDER), [
    { type: "post", item: ROW_A, kind: "promote", text: "Premise holds." },
    { type: "change", item: ROW_A, change: { state: "ready" } },
  ]);
  assert.deepEqual(actionsFor({ answer: "escalate", text: "Needs the seat.", rows: [] }, ORDER), []);
});

test("POSITIVE CONTROL: the file is a loadable class, the role excerpt is under its cap, the order is served on the record issue", async () => {
  assert.equal(whyNotClass(cls), null);
  assert.equal((await loadClasses(join(import.meta.dirname))).get("ready-queue-empty")?.cause, "ready-queue-empty");
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, "under the named cap");
  assert.deepEqual(itemOf(ORDER), RECORD_ITEM);
  assert.equal(itemOf({ causeKey: "product-manager/lane-backlog-unpromoted/3" }), null);
  assert.deepEqual(refOf("agent-org#12"), ROW_B);
  assert.equal(refOf("nope#12"), null);
  assert.equal(refOf("ready:audit"), null);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or a malformed one, yields no action", () => {
  buildQuestion(ORDER, portOf(), NOW);
  const rows = ["#11"];
  const tooMany = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `#${100 + i}`);
  for (const bad of [
    { answer: "merge", text: "x", rows }, { answer: "NONE-PROMOTABLE", text: "x", rows }, { answer: "none-promotable", rows }, { answer: "none-promotable", text: " ", rows },
    { answer: "none-promotable", text: "x" }, { answer: "none-promotable", text: "x", rows: [] }, { answer: "none-promotable", text: "x", rows: ["#11", "#11"] },
    { answer: "none-promotable", text: "x", rows: ["nope#11"] }, { answer: "none-promotable", text: "x", rows: tooMany }, null, "promote", 3,
  ]) assert.deepEqual(actionsFor(bad, ORDER), [], JSON.stringify(bad));
});

test("NEGATIVE CONTROL: a row that left the shelf, or cannot be read, yields no action; so does an unreadable record issue", () => {
  for (const state of ["ready", "in-progress", "done"] as const) {
    buildQuestion(ORDER, portOf({ "a11ign/a11ign#11": { state } }), NOW);
    assert.deepEqual(actionsFor(NONE, ORDER), [], state);
    assert.deepEqual(actionsFor(PROMOTE_ANSWER, ORDER), [], state);
  }
  buildQuestion(ORDER, portOf({ "a11ign/a11ign#11": null }), NOW);
  assert.deepEqual(actionsFor(NONE, ORDER), [], "unreadable row");
  const q = buildQuestion(ORDER, portOf({ "a11ign/a11ign#928": null }), NOW);
  assert.deepEqual(q.allowed, [ESCALATE]);
  assert.deepEqual(actionsFor(NONE, ORDER), [], "unreadable record issue");
  const never: DecisionOrder = { causeKey: "product-manager/ready-queue-empty/99", session: "product-manager" };
  assert.deepEqual(actionsFor(NONE, never), [], "never asked");
});

test("NEGATIVE CONTROL: a promotion is no action while an edge stands, the Open-check is missing, no head was given or the run re-read another head", () => {
  const A = "a11ign/a11ign#11";
  const cases: [string, Items, ServeOrder, unknown][] = [
    ["open blocker", { [A]: { relations: { ...itemFor(ROW_A).relations, blockedBy: [ROW_B] } } }, ORDER, PROMOTE_ANSWER],
    ["waiting for", { [A]: { relations: { ...itemFor(ROW_A).relations, waitingFor: ["a ruling"] } } }, ORDER, PROMOTE_ANSWER],
    ["not-before ahead", { [A]: { relations: { ...itemFor(ROW_A).relations, notBefore: "2026-10-13T00:00:00Z" } } }, ORDER, PROMOTE_ANSWER],
    ["held", { [A]: { flags: ["hold"] } }, ORDER, PROMOTE_ANSWER],
    ["no Open-check", { [A]: { body: "What it is." } }, ORDER, PROMOTE_ANSWER],
    ["no head given", {}, NO_HEAD, PROMOTE_ANSWER],
    ["another head", {}, ORDER, { ...PROMOTE_ANSWER, openCheckHead: "deadbeef" }],
    ["no head re-read", {}, ORDER, { answer: "promote", text: "x", rows: ["#11"] }],
    ["one of two rows blocked", { [A]: {}, "a11ign/agent-org#12": { flags: ["hold"] } }, ORDER, { ...PROMOTE_ANSWER, rows: ["#11", "agent-org#12"] }],
  ];
  for (const [name, items, order, answer] of cases) {
    const q = buildQuestion(order, portOf(items), NOW);
    assert.deepEqual(actionsFor(answer, order), [], name);
    // Saying why is still available, so the rows carry the reason.
    assert.equal(actionsFor(NONE, order).length, 2, name);
    if (name === "no head given") assert.deepEqual(q.allowed, [NONE_PROMOTABLE, ESCALATE]);
  }
});

test("through serveByRun: one examined row posts; an answer naming several rows or `escalate` falls back to the seat", async () => {
  const run = async (structured: unknown) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "ready-queue-empty": "run" }));
    const { port, log } = stubPort();
    const result = await serveByRun(ORDER, {
      classes: new Map([["ready-queue-empty", cls]]), seats: { path: join(dir, "seats.json") }, itemOf: () => ROW_A, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW,
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: structured, session_id: "run-1" }), timedOut: false }) },
    });
    return { result, log };
  };
  const one = await run({ answer: "none-promotable", text: "Finished.", rows: ["#11"] });
  assert.equal(one.result.outcome, "served");
  assert.equal(one.log.posts.length, 1);
  assert.deepEqual(one.log.changes, []);
  const several = await run(NONE);
  assert.equal(several.result.outcome, "fallback");
  assert.deepEqual(several.log, { posts: [], changes: [] });
  const escalated = await run({ answer: "escalate", text: "Needs the seat.", rows: [] });
  assert.deepEqual(escalated.result, { outcome: "fallback", reason: "no-action" });
});

test("NEGATIVE CONTROL: the tier is Haiku with no provider configured and Sonnet for a low-confidence pick", async () => {
  assert.deepEqual(tierQuestion(), { text: tierQuestion().text, default: TIER_DEFAULT, allowed: [TIER_DEFAULT, TIER_LARGER] });
  const tierOf = async (decide?: NonNullable<Parameters<typeof serveByRun>[1]["decide"]>) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "ready-queue-empty": "run" }));
    const { port } = stubPort();
    const result = await serveByRun(ORDER, {
      classes: new Map([["ready-queue-empty", cls]]), seats: { path: join(dir, "seats.json") }, itemOf: () => ROW_A, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW, decisionDeps: { host: {} }, ...(decide === undefined ? {} : { decide }),
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: { answer: "none-promotable", text: "Stale.", rows: ["#11"] }, session_id: "r" }), timedOut: false }) },
    });
    assert.equal(result.outcome, "served");
    return result.outcome === "served" ? result.tier : "";
  };
  assert.equal(await tierOf(), "haiku", "no provider configured");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet", confidence: 0.3 } } })), "sonnet", "low-confidence pick");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", fellBack: false, confidence: 0.9 } } })), "sonnet", "the provider picks Sonnet");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", fellBack: false, confidence: 0.9 } } })), "haiku");
});
