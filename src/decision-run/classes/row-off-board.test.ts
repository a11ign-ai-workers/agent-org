// no-token: none -- every port, executor and provider call is an injected stub; nothing here reaches a tracker, a model or a pane.
/**
 * agent-org#911 (Move 3 of a11ign/a11ign#4505): THE `row-off-board` CLASS.
 *
 * POSITIVE CONTROL: against a fixture item of the cause, the brief's question holds the default and the allowed answers, and each allowed answer yields exactly its declared
 * actions. The same class, loaded from its own directory by `loadClasses` and served by `serveByRun`, writes the decision and the state through the port.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; an item that no longer carries the gap yields none; `ready` without its facts and `parked`
 * without a declared condition yield none; the tier question with no provider answers Haiku and with a low-confidence pick answers Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadClasses, type DecisionOrder } from "../registry.ts";
import { checkAgainstSchema } from "../run.ts";
import { serveByRun, type ServeByRunDeps } from "../../serve-by-run.ts";
import cls, {
  ALLOWED, CAUSE, DECISION_KIND, DEFAULT_ANSWER, REASON_CAP_CHARS, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, SCHEMA, SONNET_BELOW_CONFIDENCE, TIER_DEFAULT, TIER_ESCALATED, rowOffBoardClass,
} from "./row-off-board.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = mkdtempSync(join(tmpdir(), "row-off-board-911-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

// --- fixtures ------------------------------------------------------------------------------------------------------------------------

const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const SCOPE = "a11ign/agent-org";
const REF: ItemRef = { tracker: "github", scope: SCOPE, id: 4242 };
const ORDER: DecisionOrder & { session: string; prompt: string } = {
  session: "product-manager", cause: CAUSE, causeKey: "product-manager/row-off-board/agent-org#4242", subject: "project-1", discriminator: "agent-org#4242",
  prompt: "1 open row(s) have NO item on Project 1",
};
const classUnderTest = rowOffBoardClass((key) => (key === "agent-org" ? SCOPE : null), () => NOW);

const itemOf = (over: Partial<TicketItem> = {}, relations: Partial<TicketItem["relations"]> = {}): TicketItem => ({
  ref: REF, title: "An unlabelled row", body: "What it is.", state: null, flags: ["lane:any"],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [], ...relations },
  events: [{ at: "2026-10-12T09:00:00.000Z", actor: "someone", kind: "item-opened" }],
  ...over,
});
const portOf = (item: TicketItem | null): Pick<TicketPort, "readItem"> => ({ readItem: () => item });

/** The brief's question is built first, as `serveByRun` does, and then the answer is turned into actions; each case gets its own order object. */
function actionsOf(item: TicketItem | null, answer: unknown): ReturnType<typeof classUnderTest.actionsFor> {
  const order = { ...ORDER };
  classUnderTest.buildQuestion(order, portOf(item));
  return classUnderTest.actionsFor(answer, order);
}
const decided = (choice: string, text = "The body says so.") => ({ answer: choice, text });
const post = (text: string) => ({ type: "post", item: REF, kind: DECISION_KIND, text });
const change = (to: object) => ({ type: "change", item: REF, change: to });

// --- POSITIVE CONTROL ----------------------------------------------------------------------------------------------------------------

test("POSITIVE CONTROL: the question holds the default and the allowed answers, and the class is a valid registry row", () => {
  const question = classUnderTest.buildQuestion({ ...ORDER }, portOf(itemOf()));
  assert.equal(question.default, DEFAULT_ANSWER);
  assert.equal(DEFAULT_ANSWER, "backlog");
  assert.deepEqual([...question.allowed], ["backlog", "ready", "parked", "epic", "escalate"]);
  assert.deepEqual([...classUnderTest.allowed], [...ALLOWED]);
  assert.equal(classUnderTest.cause, "row-off-board");
  assert.match(question.text, /no state/);
  assert.equal(checkAgainstSchema(SCHEMA, decided("ready")), null);
});

test("POSITIVE CONTROL: each allowed answer yields exactly its declared actions", () => {
  const text = (line: string) => `row-off-board: ${line}. The body says so.`;
  assert.deepEqual(actionsOf(itemOf(), decided("backlog")), [post(text("backlog -> backlog")), change({ state: "backlog" })]);
  assert.deepEqual(actionsOf(itemOf(), decided("ready")), [post(text("ready -> ready")), change({ state: "ready" })]);
  assert.deepEqual(actionsOf(itemOf({}, { waitingFor: ["a11ign/agent-org#900 closed"] }), decided("parked")),
    [post(text("parked -> parked")), change({ state: "parked" })]);
  assert.deepEqual(actionsOf(itemOf(), decided("epic")), [post(text("epic -> backlog")), change({ state: "backlog" })]);
  assert.deepEqual(actionsOf(itemOf(), decided("escalate")), []);
});

test("POSITIVE CONTROL: an epic with no lane is boarded in lane any, and one that has a lane keeps it", () => {
  assert.deepEqual(actionsOf(itemOf({ flags: [] }), decided("epic")).at(-1), change({ state: "backlog", addFlags: ["lane:any"] }));
  assert.deepEqual(actionsOf(itemOf({ flags: ["lane:ceo"] }), decided("epic")).at(-1), change({ state: "backlog" }));
});

test("POSITIVE CONTROL: each parked condition the port reads is a declared one, and the reason is one line under its cap", () => {
  const conditions: [string, Partial<TicketItem>, Partial<TicketItem["relations"]>][] = [
    ["blocker", {}, { blockedBy: [{ tracker: "github", scope: SCOPE, id: 1 }] }],
    ["waiting-for", {}, { waitingFor: ["x"] }],
    ["not-before", {}, { notBefore: "2026-12-01" }],
    ["answer", { flags: ["answer-owed:ceo"] }, {}],
  ];
  for (const [name, over, relations] of conditions) assert.equal(actionsOf(itemOf(over, relations), decided("parked")).length, 2, name);
  const long = actionsOf(itemOf(), decided("backlog", `line one\n\n${"x".repeat(5000)}`))[0] as { text: string };
  assert.ok(!long.text.includes("\n") && long.text.length <= REASON_CAP_CHARS + 60, `${long.text.length}`);
});

test("POSITIVE CONTROL: a `parked` row (the gate leaves it) still has its gap, and a Not-before date that has passed is startable", () => {
  assert.equal(actionsOf(itemOf({ state: "parked" }), decided("backlog")).length, 2);
  assert.equal(actionsOf(itemOf({}, { notBefore: "2026-10-01" }), decided("ready")).length, 2);
});

// --- NEGATIVE CONTROL ----------------------------------------------------------------------------------------------------------------

test("NEGATIVE CONTROL: an answer outside `allowed`, or not an answer at all, yields no action", () => {
  for (const bad of [decided("merge"), decided(""), { answer: 3, text: "x" }, { text: "no answer" }, null, "backlog", undefined]) {
    assert.deepEqual(actionsOf(itemOf(), bad), [], JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: an item that no longer carries the gap yields no action, whatever the answer", () => {
  for (const state of ["ready", "backlog", "in-progress", "in-review", "done"] as const) {
    for (const choice of ALLOWED) assert.deepEqual(actionsOf(itemOf({ state }), decided(choice)), [], `${state}/${choice}`);
  }
});

test("NEGATIVE CONTROL: `ready` needs a startable row and `parked` needs a declared condition; the doubt is the seat's", () => {
  assert.deepEqual(actionsOf(itemOf(), decided("parked")), [], "parked with no condition");
  const unstartable: [string, Partial<TicketItem>, Partial<TicketItem["relations"]>][] = [
    ["blocker", {}, { blockedBy: [{ tracker: "github", scope: SCOPE, id: 1 }] }],
    ["waiting-for", {}, { waitingFor: ["x"] }],
    ["future not-before", {}, { notBefore: "2026-12-01" }],
    ["unreadable not-before", {}, { notBefore: "someday" }],
    ["answer owed", { flags: ["answer-owed:ceo"] }, {}],
    ["hold", { flags: ["hold"] }, {}],
  ];
  for (const [name, over, relations] of unstartable) assert.deepEqual(actionsOf(itemOf(over, relations), decided("ready")), [], name);
});

test("NEGATIVE CONTROL: nothing is decided on an item that was never read, and an order naming no repository reads nothing", () => {
  assert.deepEqual(classUnderTest.actionsFor(decided("backlog"), { ...ORDER }), [], "no question was built");
  assert.deepEqual(actionsOf(null, decided("backlog")), [], "the item could not be read");
  const asked: ItemRef[] = [];
  const unknownKey = { ...ORDER, causeKey: "product-manager/row-off-board/elsewhere#7" };
  classUnderTest.buildQuestion(unknownKey, { readItem: (ref) => { asked.push(ref); return itemOf(); } });
  assert.equal(asked.length, 0);
  assert.deepEqual(classUnderTest.actionsFor(decided("backlog"), unknownKey), []);
  const several = { ...ORDER, causeKey: "product-manager/row-off-board/4242.agent-org#7" };
  classUnderTest.buildQuestion(several, { readItem: (ref) => { asked.push(ref); return itemOf(); } });
  assert.equal(asked.length, 0, "a set of rows names no one item");
});

test("the role excerpt is under its named cap, and names every allowed answer", () => {
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, `${Buffer.byteLength(ROLE_EXCERPT, "utf8")} > ${ROLE_EXCERPT_CAP_BYTES}`);
  for (const answer of ALLOWED) assert.ok(ROLE_EXCERPT.includes(`- ${answer}:`), answer);
});

// --- the real file, loaded and served -------------------------------------------------------------------------------------------------

test("POSITIVE CONTROL: the file in `classes/` loads through the registry, by its cause", async () => {
  const loaded = await loadClasses(HERE);
  // The registry imports the file by URL, a second instance of the module, so the class is compared by what it declares.
  assert.ok(loaded.has("row-off-board"), "the file registers under its cause; other classes in the directory are not this test's to name");
  assert.deepEqual(loaded.get("row-off-board")?.allowed, cls.allowed);
  assert.deepEqual(loaded.get("row-off-board")?.schema, cls.schema);
  assert.equal(cls.tierQuestion?.({ ...ORDER }, portOf(null)).default, TIER_DEFAULT);
});

type Exec = NonNullable<ServeByRunDeps["run"]["exec"]>;
const REPLY = JSON.stringify({ structured_output: { answer: "backlog", text: "It is a real row." }, session_id: "run-911", total_cost_usd: 0.01,
  usage: { cache_read_input_tokens: 1, cache_creation_input_tokens: 1 } });

/** One `serveByRun` over the class under test, with a stub port that records its writes, a stub executor that records its argv and a stub `decide` for the tier. */
async function served(decide: ServeByRunDeps["decide"]) {
  const projectDir = fresh();
  const stateDir = fresh();
  mkdirSync(join(projectDir, ".agent-org"));
  writeFileSync(join(projectDir, ".agent-org", "seats.json"), JSON.stringify({ [CAUSE]: "run" }));
  const writes: unknown[] = [];
  const port = {
    readItem: () => itemOf(),
    postDecision: (_ref: ItemRef, d: unknown) => { writes.push(d); return "c1"; },
    changeState: (_ref: ItemRef, c: unknown) => { writes.push(c); return true; },
  } as unknown as TicketPort;
  const argvs: string[][] = [];
  const exec: Exec = async (argv) => { argvs.push([...argv]); return { exitCode: 0, stdout: REPLY, timedOut: false }; };
  const result = await serveByRun({ ...ORDER }, {
    classes: new Map([[CAUSE, classUnderTest]]), seats: { path: join(projectDir, ".agent-org", "seats.json") },
    itemOf: () => REF, port: () => port, run: { exec, cwd: stateDir }, stateDir, roleExcerpt: () => ROLE_EXCERPT, now: () => NOW,
    decide, decisionDeps: { host: {} },
  } as ServeByRunDeps);
  const model = argvs[0]?.[(argvs[0]?.indexOf("--model") ?? -2) + 1];
  return { result, writes, model, argvs };
}
const tierAnswer = (value: string, extra: object = {}) => async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value, fellBack: false, ...extra } } }) as never;

test("POSITIVE CONTROL: served by a run, the decision and the state are written once, through the port, at Haiku", async () => {
  const t = await served(tierAnswer(TIER_DEFAULT));
  assert.equal(t.result.outcome, "served", JSON.stringify(t.result));
  assert.equal(t.model, TIER_DEFAULT);
  assert.equal(t.writes.length, 2);
  assert.deepEqual(t.writes[1], { state: "backlog" });
});

test("NEGATIVE CONTROL: with no provider configured the tier question answers Haiku", async () => {
  const noProvider = async () => ({ use: "model-routing", via: "none", fellBack: true, answers: { tier: { value: TIER_DEFAULT, fellBack: true } } }) as never;
  const t = await served(noProvider);
  assert.equal(t.model, TIER_DEFAULT);
  // And with the provider's default decide (no host, no key) the answer is the same.
  assert.equal((await served(undefined)).model, TIER_DEFAULT);
});

test("NEGATIVE CONTROL: a low-confidence pick, or a pick of Sonnet, answers Sonnet", async () => {
  const low = await served(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: TIER_DEFAULT, fellBack: true, asked: TIER_DEFAULT, confidence: 0.4 } } }) as never);
  assert.equal(low.model, TIER_ESCALATED);
  const picked = await served(tierAnswer(TIER_ESCALATED, { confidence: 0.99 }));
  assert.equal(picked.model, TIER_ESCALATED);
  assert.ok(SONNET_BELOW_CONFIDENCE > 0 && SONNET_BELOW_CONFIDENCE < 1);
});
