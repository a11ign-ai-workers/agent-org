// no-token: none -- every port, `claude` and provider call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#907 (Move 3 of a11ign/a11ign#4505): THE CLASS `unclaimed-blocker-cleared`.
 *
 * POSITIVE CONTROL: against a fixture item of this cause the question holds the order, its default (`hold`) and the three allowed answers, each allowed answer yields exactly
 * its declared actions, the class is a loadable `DecisionClass`, and the whole path through `serveByRun` posts and promotes.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; an item that is no longer shelved yields none; a promotion with an open edge, no
 * Open-check, no head or a head other than the one given yields none; the tier question with no provider answers Haiku and with a low-confidence pick Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cls, {
  ALLOWED, ESCALATE, HOLD, PROMOTE, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, TIER_DEFAULT, TIER_LARGER, actionsFor, buildQuestion, itemOf, tierQuestion,
} from "./unclaimed-blocker-cleared.ts";
import { loadClasses, whyNotClass, type DecisionOrder } from "../registry.ts";
import { serveByRun, type ServeOrder } from "../../serve-by-run.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "unclaimed-blocker-cleared-907-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

const REF: ItemRef = { tracker: "github", scope: "a11ign/agent-org", id: 907 };
const HEAD = "c0cf4112";
const ORDER: ServeOrder = {
  session: "product-manager", cause: "unclaimed-blocker-cleared", subject: "row-agent-org#907", discriminator: "902",
  causeKey: "product-manager/unclaimed-blocker-cleared/row-agent-org#907/902",
  prompt: `agent-org#907 IS UNCLAIMED AND NO LONGER BLOCKED. Every row it declared a dependency on is now closed: #902.\nHead: ${HEAD}`,
};
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const itemWith = (over: Partial<TicketItem> = {}): TicketItem => ({
  ref: REF, title: "A class row", state: "backlog", flags: [], events: [],
  body: "## What it is\nA class.\n\n## Open-check\nRead at origin/main = `c0cf4112`.",
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  ...over,
});
const withRelations = (over: Partial<TicketItem["relations"]>): Partial<TicketItem> => ({ relations: { ...itemWith().relations, ...over } });
const portOf = (item: TicketItem | null) => ({ readItem: () => item });
const stubPort = (item: TicketItem | null) => {
  const log = { posts: [] as unknown[], changes: [] as unknown[] };
  const port = {
    readItem: () => item,
    postDecision: (_ref: ItemRef, d: unknown) => { log.posts.push(d); return "c-1"; },
    changeState: (_ref: ItemRef, c: unknown) => { log.changes.push(c); return true; },
  } as unknown as TicketPort;
  return { port, log };
};
const PROMOTE_ANSWER = { answer: "promote", text: "Premise holds at the head.", openCheckHead: HEAD };

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions", () => {
  const q = buildQuestion(ORDER, portOf(itemWith()), NOW);
  assert.ok(q.text.includes(ORDER.prompt as string), "the order is in the question");
  assert.equal(q.default, HOLD);
  assert.deepEqual(q.allowed, [...ALLOWED]);
  assert.deepEqual(actionsFor(PROMOTE_ANSWER, ORDER), [
    { type: "post", item: REF, kind: "promote", text: "Premise holds at the head." },
    { type: "change", item: REF, change: { state: "ready" } },
  ]);
  assert.deepEqual(actionsFor({ answer: "hold", text: "Not-before is ahead." }, ORDER), [{ type: "post", item: REF, kind: "hold", text: "Not-before is ahead." }]);
  assert.deepEqual(actionsFor({ answer: "escalate", text: "Needs the seat." }, ORDER), []);
});

test("POSITIVE CONTROL: the file is a loadable class, the role excerpt is under its cap, and the tier question defaults to Haiku", async () => {
  assert.equal(whyNotClass(cls), null);
  assert.equal((await loadClasses(join(import.meta.dirname))).get("unclaimed-blocker-cleared")?.cause, "unclaimed-blocker-cleared");
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, "under the named cap");
  assert.deepEqual(tierQuestion(), { text: tierQuestion().text, default: TIER_DEFAULT, allowed: [TIER_DEFAULT, TIER_LARGER] });
  assert.equal(cls.allowed.includes(PROMOTE), true);
  assert.deepEqual(itemOf(ORDER), REF);
  assert.deepEqual(itemOf({ causeKey: "product-manager/unclaimed-blocker-cleared/row-12/3.4" }), { tracker: "github", scope: "a11ign/a11ign", id: 12 });
  assert.equal(itemOf({ causeKey: "product-manager/unclaimed-blocker-cleared/row-nope#12/3" }), null);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or a malformed one, yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()), NOW);
  for (const bad of [{ answer: "merge", text: "x" }, { answer: "PROMOTE", text: "x", openCheckHead: HEAD }, { answer: "hold" }, { answer: "hold", text: " " }, { answer: "promote", text: "x" }, null, "hold", 3]) {
    assert.deepEqual(actionsFor(bad, ORDER), [], JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: an item that is no longer shelved yields no action, and only `escalate` is allowed", () => {
  for (const state of ["ready", "in-progress", "done"] as const) {
    const q = buildQuestion(ORDER, portOf(itemWith({ state })), NOW);
    assert.deepEqual(q.allowed, [ESCALATE], state);
    assert.deepEqual(actionsFor(PROMOTE_ANSWER, ORDER), [], state);
    assert.deepEqual(actionsFor({ answer: "hold", text: "x" }, ORDER), [], state);
  }
  buildQuestion(ORDER, portOf(null), NOW);
  assert.deepEqual(actionsFor(PROMOTE_ANSWER, ORDER), [], "unreadable");
  const never: DecisionOrder = { causeKey: "product-manager/unclaimed-blocker-cleared/row-agent-org#4040/1", session: "product-manager" };
  assert.deepEqual(actionsFor(PROMOTE_ANSWER, never), [], "never asked");
});

test("NEGATIVE CONTROL: a promotion is no action while an edge stands, the Open-check is missing, no head was given or the run re-read another head", () => {
  const cases: [string, Partial<TicketItem>, DecisionOrder, unknown][] = [
    ["open blocker", withRelations({ blockedBy: [{ tracker: "github", scope: "a11ign/agent-org", id: 5 }] }), ORDER, PROMOTE_ANSWER],
    ["waiting for", withRelations({ waitingFor: ["a ruling"] }), ORDER, PROMOTE_ANSWER],
    ["not-before ahead", withRelations({ notBefore: "2026-10-13T00:00:00Z" }), ORDER, PROMOTE_ANSWER],
    ["held", { flags: ["hold"] }, ORDER, PROMOTE_ANSWER],
    ["no Open-check", { body: "What it is." }, ORDER, PROMOTE_ANSWER],
    ["no head given", {}, { ...ORDER, prompt: "agent-org#907 IS UNCLAIMED." }, PROMOTE_ANSWER],
    ["another head", {}, ORDER, { ...PROMOTE_ANSWER, openCheckHead: "deadbeef" }],
    ["no head re-read", {}, ORDER, { answer: "promote", text: "x" }],
  ];
  for (const [name, over, order, answer] of cases) {
    const q = buildQuestion(order, portOf(itemWith(over)), NOW);
    assert.deepEqual(actionsFor(answer, order), [], name);
    if (name !== "another head" && name !== "no head re-read") assert.deepEqual(q.allowed, [HOLD, ESCALATE], name);
    // A hold is still available: the row stays where it is, with the reason on it.
    if (name !== "another head" && name !== "no head re-read") assert.equal(actionsFor({ answer: "hold", text: "why" }, order).length, 1, name);
  }
});

test("through serveByRun: a promotion posts and sets `ready`; a hold posts and changes nothing; an escalate falls back to the seat", async () => {
  const run = async (structured: unknown) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "unclaimed-blocker-cleared": "run" }));
    const { port, log } = stubPort(itemWith());
    const result = await serveByRun(ORDER, {
      classes: new Map([["unclaimed-blocker-cleared", cls]]), seats: { path: join(dir, "seats.json") }, itemOf: () => REF, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW,
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: structured, session_id: "run-1" }), timedOut: false }) },
    });
    return { result, log };
  };
  const promoted = await run(PROMOTE_ANSWER);
  assert.equal(promoted.result.outcome, "served");
  assert.equal(promoted.log.posts.length, 1);
  assert.deepEqual(promoted.log.changes, [{ state: "ready" }]);
  const held = await run({ answer: "hold", text: "Premise is stale." });
  assert.equal(held.result.outcome, "served");
  assert.deepEqual(held.log.changes, []);
  assert.equal(held.log.posts.length, 1);
  const escalated = await run({ answer: "escalate", text: "Needs the seat." });
  assert.deepEqual(escalated.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(escalated.log, { posts: [], changes: [] });
});

test("NEGATIVE CONTROL: the tier is Haiku with no provider configured and Sonnet for a low-confidence pick", async () => {
  const tierOf = async (decide?: NonNullable<Parameters<typeof serveByRun>[1]["decide"]>) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "unclaimed-blocker-cleared": "run" }));
    const { port } = stubPort(itemWith());
    const result = await serveByRun(ORDER, {
      classes: new Map([["unclaimed-blocker-cleared", cls]]), seats: { path: join(dir, "seats.json") }, itemOf: () => REF, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW, decisionDeps: { host: {} }, ...(decide === undefined ? {} : { decide }),
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: { answer: "hold", text: "Stale." }, session_id: "r" }), timedOut: false }) },
    });
    assert.equal(result.outcome, "served");
    return result.outcome === "served" ? result.tier : "";
  };
  assert.equal(await tierOf(), "haiku", "no provider configured");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet", confidence: 0.3 } } })), "sonnet", "low-confidence pick");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", fellBack: false, confidence: 0.9 } } })), "sonnet", "the provider picks Sonnet");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", fellBack: false, confidence: 0.9 } } })), "haiku");
});
