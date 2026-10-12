// no-token: none -- every port, `claude` and provider call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#905 (Move 3 of a11ign/a11ign#4505): THE CLASS `answer-owed`.
 *
 * POSITIVE CONTROL: against a fixture item carrying the order's flag the question holds the order, its default and the three allowed answers, each allowed answer yields exactly
 * its declared actions, the class is a loadable `DecisionClass`, and the whole path through `serveByRun` writes the answer and removes the flag.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; an item that no longer carries the order's flag yields none; a ruling or an admin
 * question allows only `escalate`; a relabel to a session outside the closed list yields none; the tier question with no provider answers Haiku and with a low-confidence pick Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import answerOwed, {
  ALLOWED, ESCALATE, RELABEL_SESSIONS, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, TIER_DEFAULT, TIER_LARGER, actionsFor, buildQuestion, itemOf, tierQuestion,
} from "./answer-owed.ts";
import { loadClasses, whyNotClass, type DecisionOrder } from "../registry.ts";
import { serveByRun, type ServeOrder } from "../../serve-by-run.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "answer-owed-905-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

const REF: ItemRef = { tracker: "github", scope: "a11ign/agent-org", id: 905 };
const ORDER: ServeOrder = {
  session: "ceo", cause: "answer-owed", causeKey: "ceo/answer-owed/row-agent-org#905",
  prompt: "agent-org#905 IS WAITING ON AN ANSWER FROM YOU. Read that row's most recent comments for the question.",
};
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const itemWith = (over: Partial<TicketItem> = {}): TicketItem => ({
  ref: REF, title: "A row", body: "What it is.", state: "in-progress", flags: ["answer-owed:ceo"],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  events: [{ at: "2026-10-12T09:00:00.000Z", actor: "worker-1", kind: "flag-added", detail: "Is the Region allowed to include the test file?" }],
  ...over,
});
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

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions", () => {
  const q = buildQuestion(ORDER, portOf(itemWith()));
  assert.ok(q.text.includes(ORDER.prompt as string), "the order is in the question");
  assert.ok(q.text.includes("answer-owed:ceo"));
  assert.equal(q.default, ESCALATE);
  assert.deepEqual(q.allowed, [...ALLOWED]);
  assert.deepEqual(actionsFor({ answer: "answered", text: "Yes, it is." }, ORDER), [
    { type: "post", item: REF, kind: "answer", text: "Yes, it is." },
    { type: "change", item: REF, change: { removeFlags: ["answer-owed:ceo"] } },
  ]);
  assert.deepEqual(actionsFor({ answer: "relabel", text: "Not mine.", session: "orchestrator" }, ORDER), [
    { type: "post", item: REF, kind: "relabel", text: "Not mine." },
    { type: "change", item: REF, change: { removeFlags: ["answer-owed:ceo"], addFlags: ["answer-owed:orchestrator"] } },
  ]);
  assert.deepEqual(actionsFor({ answer: "escalate", text: "Needs the seat." }, ORDER), []);
});

test("POSITIVE CONTROL: the file is a loadable class, the role excerpt is under its cap, and the tier question defaults to Haiku", async () => {
  assert.equal(whyNotClass(answerOwed), null);
  assert.equal((await loadClasses(join(import.meta.dirname))).get("answer-owed")?.cause, "answer-owed");
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, "under the named cap");
  assert.match(ROLE_EXCERPT, /RULING/);
  assert.deepEqual(tierQuestion(), { text: tierQuestion().text, default: TIER_DEFAULT, allowed: [TIER_DEFAULT, TIER_LARGER] });
  assert.deepEqual(itemOf(ORDER), REF);
  assert.deepEqual(itemOf({ causeKey: "ceo/answer-owed/row-12" }), { tracker: "github", scope: "a11ign/a11ign", id: 12 });
  assert.equal(itemOf({ causeKey: "ceo/answer-owed/row-nope#12" }), null);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or a malformed one, yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()));
  for (const bad of [{ answer: "approve", text: "x" }, { answer: "approve", text: "x", session: "orchestrator" }, { answer: "escalate", text: "x", session: "orchestrator" }, { answer: "ANSWERED", text: "x" }, { answer: "answered" }, { answer: "answered", text: "  " }, null, "answered", 3]) {
    assert.deepEqual(actionsFor(bad, ORDER), [], JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: an item that no longer carries the order's flag yields no action, and only `escalate` is allowed", () => {
  const q = buildQuestion(ORDER, portOf(itemWith({ flags: [] })));
  assert.deepEqual(q.allowed, [ESCALATE]);
  assert.deepEqual(actionsFor({ answer: "answered", text: "Yes." }, ORDER), []);
  assert.deepEqual(actionsFor({ answer: "relabel", text: "x", session: "ceo" }, ORDER), []);
  // An unreadable item and an item the order does not name are the same: no ref, no action.
  buildQuestion(ORDER, portOf(null));
  assert.deepEqual(actionsFor({ answer: "answered", text: "Yes." }, ORDER), []);
  const never: DecisionOrder = { causeKey: "ceo/answer-owed/row-agent-org#4040", session: "ceo" };
  assert.deepEqual(actionsFor({ answer: "answered", text: "Yes." }, never), [], "never asked");
});

test("NEGATIVE CONTROL: a question that asks for a ruling, a rule change, an admin write or a chairman decision is `escalate` only", () => {
  for (const asked of ["Please give a ruling on whether lanes may merge.", "Can we change the rule on rebases?", "Needs an admin write to branch protection.", "The chairman must decide this."]) {
    const q = buildQuestion(ORDER, portOf(itemWith({ events: [{ at: "2026-10-12T09:00:00.000Z", actor: "worker-1", kind: "flag-added", detail: asked }] })));
    assert.deepEqual(q.allowed, [ESCALATE], asked);
    assert.deepEqual(actionsFor({ answer: "answered", text: "Granted." }, ORDER), [], asked);
  }
});

test("NEGATIVE CONTROL: a relabel to a session outside the closed list, or back to the same one, yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()));
  assert.ok(RELABEL_SESSIONS.includes("orchestrator" as never));
  for (const session of ["worker-1", "", undefined, 7, "ceo"]) {
    assert.deepEqual(actionsFor({ answer: "relabel", text: "x", session }, ORDER), [], String(session));
  }
});

test("through serveByRun: the answer is posted and the flag removed; an escalate writes nothing and falls back to the seat", async () => {
  const run = async (structured: unknown, item = itemWith()) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "answer-owed": "run" }));
    const { port, log } = stubPort(item);
    const result = await serveByRun(ORDER, {
      classes: new Map([["answer-owed", answerOwed]]), seats: { path: join(dir, "seats.json") }, itemOf: () => REF, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW,
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: structured, session_id: "run-1" }), timedOut: false }) },
    });
    return { result, log };
  };
  const answered = await run({ answer: "answered", text: "Yes, include it." });
  assert.equal(answered.result.outcome, "served");
  assert.equal(answered.log.posts.length, 1);
  assert.deepEqual(answered.log.changes, [{ removeFlags: ["answer-owed:ceo"] }]);
  const escalated = await run({ answer: "escalate", text: "Needs the seat." });
  assert.deepEqual(escalated.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(escalated.log, { posts: [], changes: [] });
});

test("NEGATIVE CONTROL: the tier is Haiku with no provider configured and Sonnet for a low-confidence pick", async () => {
  const tierOf = async (decide?: NonNullable<Parameters<typeof serveByRun>[1]["decide"]>) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "answer-owed": "run" }));
    const { port } = stubPort(itemWith());
    const result = await serveByRun(ORDER, {
      classes: new Map([["answer-owed", answerOwed]]), seats: { path: join(dir, "seats.json") }, itemOf: () => REF, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW, decisionDeps: { host: {} }, ...(decide === undefined ? {} : { decide }),
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: { answer: "answered", text: "Yes." }, session_id: "r" }), timedOut: false }) },
    });
    assert.equal(result.outcome, "served");
    return result.outcome === "served" ? result.tier : "";
  };
  assert.equal(await tierOf(), "haiku", "no provider configured");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet", confidence: 0.3 } } })), "sonnet", "low-confidence pick");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", fellBack: false, confidence: 0.9 } } })), "sonnet", "the provider picks Sonnet");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", fellBack: false, confidence: 0.9 } } })), "haiku");
});
