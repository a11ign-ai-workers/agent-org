// no-token: none -- every port, `claude` and `decide` call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#908: THE `row-call-count-signal` CLASS.
 *
 * POSITIVE CONTROL: against a fixture item of this cause the class's brief holds the question, the default and the allowed answers, and each allowed
 * answer yields exactly its declared actions; the module loads as a class through the registry, and the role excerpt is under its byte cap.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; an item that no longer carries the claim yields none (the gap is
 * gone); the tier question with no provider configured answers Haiku, and with a low-confidence pick answers Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadClasses, whyNotClass } from "../registry.ts";
import { serveOrdersByRun, type ServeOrder } from "../../serve-by-run.ts";
import { formatRowCallCountAssessment, rowCallCountAssessedCalls, rowCallCountOrders } from "../../work-gate/row-call-count-orders.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";
import cls, { ALLOWED, CALLS_FOR_LARGER_TIER, DEFAULT_ANSWER, GapGoneError, REASON_CAP_CHARS, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, ROW_SCOPE, ROW_TRACKER, callsNamedIn } from "./row-call-count-signal.ts";

const CLASSES_DIR = fileURLToPath(new URL(".", import.meta.url));
const ROOT = mkdtempSync(join(tmpdir(), "row-call-count-908-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

const REF: ItemRef = { tracker: ROW_TRACKER, scope: ROW_SCOPE, id: 4242 };
const itemOf = (over: Partial<TicketItem> = {}): TicketItem => ({
  ref: REF, title: "A long row", body: "Region: one module.", state: "in-progress", flags: [],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  events: [{ at: "2026-10-12T09:00:00.000Z", actor: "worker", kind: "state-changed" }], ...over,
});
const portOf = (item: TicketItem | null): Pick<TicketPort, "readItem"> => ({ readItem: () => item });

/** The order the gate mints for ONE row, from the shipped `rowCallCountOrders`, so the class is tested against the real prompt and key. */
const [minted] = rowCallCountOrders([{ row: 4242, session: "worker-4242", calls: 143 }]);
const ORDER: ServeOrder = { session: minted.session, cause: minted.cause, causeKey: minted.causeKey, subject: minted.subject, discriminator: minted.discriminator, prompt: minted.prompt };

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers", () => {
  const q = cls.buildQuestion(ORDER, portOf(itemOf()));
  assert.equal(q.default, "one-unit");
  assert.equal(q.default, DEFAULT_ANSWER);
  assert.deepEqual([...q.allowed], ["one-unit", "split", "escalate"]);
  assert.deepEqual([...cls.allowed], [...ALLOWED]);
  assert.match(q.text, /4242 is claimed/);
  assert.match(q.text, /143 calls/);
  assert.ok(q.allowed.includes(q.default), "the default is an allowed answer");
});

test("POSITIVE CONTROL: each allowed answer yields exactly its declared actions", () => {
  const item = { tracker: ROW_TRACKER, scope: ROW_SCOPE, id: 4242 };
  const one = cls.actionsFor({ answer: "one-unit", text: "One module, one command." }, ORDER);
  assert.deepEqual(one, [{ type: "post", item, kind: "decision", text: formatRowCallCountAssessment({ calls: 143, split: false, note: "One module, one command." }) }]);
  // The posted text is what the doubling guard reads back: marker and count survive.
  assert.equal(rowCallCountAssessedCalls([{ body: (one[0] as { text: string }).text }]), 143);
  const owed = [{ type: "change", item, change: { addFlags: ["answer-owed:product-manager"] } }];
  assert.deepEqual(cls.actionsFor({ answer: "split", text: "Two deliverables." }, ORDER), [{ type: "post", item, kind: "decision", text: "split: Two deliverables." }, ...owed]);
  assert.deepEqual(cls.actionsFor({ answer: "escalate", text: "Cannot tell." }, ORDER), [{ type: "post", item, kind: "decision", text: "escalate: Cannot tell." }, ...owed]);
  // A `split` is never recorded as an assessment: no marker, so the signal is not silenced by a split not yet made.
  assert.equal(rowCallCountAssessedCalls([{ body: (cls.actionsFor({ answer: "split", text: "x" }, ORDER)[0] as { text: string }).text }]), null);
});

test("POSITIVE CONTROL: the reason is capped, the count is read from the prompt, and the module is a class the registry loads", async () => {
  const long = cls.actionsFor({ answer: "split", text: "r".repeat(REASON_CAP_CHARS * 2) }, ORDER)[0] as { text: string };
  assert.equal(long.text.length, "split: ".length + REASON_CAP_CHARS);
  assert.equal(callsNamedIn(ORDER), 143);
  assert.equal(whyNotClass(cls), null);
  const classes = await loadClasses(CLASSES_DIR);
  // The registry imports the file by URL, so the instance is its own: compare what it serves, not identity.
  assert.ok(classes.has("row-call-count-signal"), "the registry serves this cause");
  assert.deepEqual([...(classes.get("row-call-count-signal")?.allowed ?? [])], [...cls.allowed]);
});

test("POSITIVE CONTROL: the role excerpt is under its byte cap and names the three answers", () => {
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, `${Buffer.byteLength(ROLE_EXCERPT, "utf8")} bytes`);
  for (const answer of ALLOWED) assert.ok(ROLE_EXCERPT.includes(`\`${answer}\``), answer);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or one with no reason, yields no action", () => {
  assert.deepEqual(cls.actionsFor({ answer: "merge", text: "Because." }, ORDER), []);
  assert.deepEqual(cls.actionsFor({ answer: "one-unit", text: "   " }, ORDER), []);
  assert.deepEqual(cls.actionsFor({ text: "no answer" }, ORDER), []);
  assert.deepEqual(cls.actionsFor("one-unit", ORDER), []);
  assert.deepEqual(cls.actionsFor(null, ORDER), []);
});

test("NEGATIVE CONTROL: an item that is no longer a claim, or cannot be read, yields no question and so no action", () => {
  for (const state of ["done", "ready", "in-review", null] as const) {
    assert.throws(() => cls.buildQuestion(ORDER, portOf(itemOf({ state }))), GapGoneError, String(state));
  }
  assert.throws(() => cls.buildQuestion(ORDER, portOf(null)), GapGoneError);
  // An order whose key names no single row is no item at all.
  assert.throws(() => cls.buildQuestion({ ...ORDER, causeKey: "product-manager/row-call-count-signal/1,2" }, portOf(itemOf())), GapGoneError);
  assert.deepEqual(cls.actionsFor({ answer: "one-unit", text: "x" }, { ...ORDER, causeKey: "product-manager/row-call-count-signal/1,2" }), []);
});

test("NEGATIVE CONTROL: a prompt naming no count posts the reason alone, which signals again rather than being guessed at", () => {
  const bare = { ...ORDER, prompt: "no count here" };
  const [post] = cls.actionsFor({ answer: "one-unit", text: "One unit." }, bare) as unknown as { text: string }[];
  assert.equal(post.text, "One unit.");
  assert.equal(rowCallCountAssessedCalls([{ body: post.text }]), null);
});

// --- the tier question, through `serveOrdersByRun` so the thresholds are `tierFor`'s own ------------------------------------------------------

async function tierOf(order: ServeOrder, decide?: NonNullable<Parameters<typeof serveOrdersByRun>[1]["decide"]>): Promise<{ tier: string | undefined; asked: string[] }> {
  const projectDir = fresh();
  mkdirSync(join(projectDir, ".agent-org"));
  writeFileSync(join(projectDir, ".agent-org", "seats.json"), JSON.stringify({ "row-call-count-signal": "run" }));
  const port = { readItem: () => itemOf(), postDecision: () => "c1", changeState: () => true } as unknown as TicketPort;
  const asked: string[] = [];
  const reply = JSON.stringify({ structured_output: { answer: "one-unit", text: "One unit." }, session_id: "run-1", total_cost_usd: 0.01, usage: { cache_read_input_tokens: 1, cache_creation_input_tokens: 1 } });
  const served = await serveOrdersByRun([order], {
    ledgerPath: join(fresh(), "wake-ledger"), projectDir, gh: () => "", scopeOf: () => ROW_SCOPE, roleBrief: () => "# product-manager",
    classesDir: CLASSES_DIR, port: () => port, now: () => Date.parse("2026-10-12T10:00:00.000Z"), decisionDeps: { host: {} },
    exec: async () => ({ exitCode: 0, stdout: reply, timedOut: false }),
    decide: decide === undefined ? undefined : async (...args) => { asked.push(JSON.stringify(Object.keys(args[2]))); return decide(...args); },
  });
  return { tier: served.get(order.causeKey)?.tier, asked };
}

test("NEGATIVE CONTROL: with no provider configured the tier is Haiku, and the class is served by a run at all", async () => {
  const none = await tierOf(ORDER);
  assert.equal(none.tier, "haiku");
  // A provider that was never reached (the answer fell back with nothing asked) is the same.
  const unreached = await tierOf(ORDER, async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true } } }));
  assert.equal(unreached.tier, "haiku");
  assert.deepEqual(unreached.asked, ['["tier"]']);
});

test("POSITIVE CONTROL: a low-confidence pick answers Sonnet, and so does a pick of Sonnet", async () => {
  const low = await tierOf(ORDER, async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet" } } }));
  assert.equal(low.tier, "sonnet");
  const picked = await tierOf(ORDER, async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", confidence: 0.9, fellBack: false } } }));
  assert.equal(picked.tier, "sonnet");
  const sure = await tierOf(ORDER, async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", confidence: 0.9, fellBack: false } } }));
  assert.equal(sure.tier, "haiku");
});

test("the tier question names the count when it is at or past the named threshold, and only then", () => {
  const at = { ...ORDER, prompt: `1 claimed row(s): #4242 (worker-4242, ${CALLS_FOR_LARGER_TIER} calls).` };
  const q = cls.tierQuestion?.(at, portOf(itemOf()));
  assert.ok(q);
  assert.equal(q.default, "haiku");
  assert.deepEqual([...q.allowed], ["haiku", "sonnet"]);
  assert.match(q.text, new RegExp(`${CALLS_FOR_LARGER_TIER} calls`));
  assert.doesNotMatch(cls.tierQuestion!(ORDER, portOf(itemOf())).text, /at 143 calls/);
});

test("NEGATIVE CONTROL: the class imports no module that reaches wake.ts (the tick loads classes from inside its own top-level await, and would never settle)", () => {
  const source = readFileSync(fileURLToPath(new URL("./row-call-count-signal.ts", import.meta.url)), "utf8");
  const valueImports = [...source.matchAll(/^import (?!type\b)[^\n]*from "([^"]+)"/gm)].map((m) => m[1]);
  assert.ok(valueImports.length > 0);
  for (const spec of valueImports) {
    assert.doesNotMatch(spec, /work-gate\.ts$|row-call-count-orders\.ts$|wake\.ts$/, `${spec} reaches wake.ts, so the tick's own import of this class would wait on the tick`);
  }
});
