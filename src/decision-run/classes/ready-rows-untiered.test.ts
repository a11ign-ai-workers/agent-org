// no-token: none -- every port, `claude` and provider call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#909 (Move 3 of a11ign/a11ign#4505): THE CLASS `ready-rows-untiered`.
 *
 * POSITIVE CONTROL: against a fixture ready row the question holds the order, its default and the allowed answers, each allowed answer yields exactly its declared actions, the
 * class is a loadable `DecisionClass`, and the path through `serveByRun` writes the Tier line.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; a row that no longer needs a decision yields none; a `haiku-label` on a row whose Acceptance is
 * not a command yields none; the tier question with no provider configured answers Haiku, and with a low-confidence pick Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import readyRows, {
  ALLOWED, ESCALATE, HAIKU_LABEL, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, SONNET_LINE, TIER_DEFAULT, TIER_LARGER, acceptanceIsCommand, actionsFor, buildQuestion, itemOf, reasonOf, tierQuestion,
} from "./ready-rows-untiered.ts";
import { loadClasses, whyNotClass, type DecisionOrder } from "../registry.ts";
import { serveByRun, type ServeOrder } from "../../serve-by-run.ts";
import { hasTierDecision } from "../../untiered-ready-rows.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "ready-rows-untiered-909-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

const REF: ItemRef = { tracker: "github", scope: "a11ign/agent-org", id: 909 };
const ORDER: ServeOrder = {
  session: "product-manager", cause: "ready-rows-untiered", causeKey: "product-manager/ready-rows-untiered/agent-org#909,agent-org#910",
  prompt: "2 `ready` row(s) have made NO tier decision:\n  agent-org#909 Class `ready-rows-untiered`\n  agent-org#910 Another row\nFor each row above: put `tier:haiku` on it ...",
};
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const COMMAND_BODY = "## What it is\nx\n\n## Acceptance\n\n```bash\nnpx rstest run src/a.test.ts\n```\n\n## Tier\n";
const itemWith = (over: Partial<TicketItem> = {}): TicketItem => ({
  ref: REF, title: "A row", body: COMMAND_BODY, state: "ready", flags: [],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  events: [{ at: "2026-10-12T09:00:00.000Z", actor: "a11ign-managers", kind: "item-opened" }],
  ...over,
});
const portOf = (item: TicketItem | null) => ({ readItem: () => item });
const stubPort = (item: TicketItem | null) => {
  const log = { posts: [] as { kind: string; text: string }[], changes: [] as unknown[] };
  const port = {
    readItem: () => item,
    postDecision: (_ref: ItemRef, d: { kind: string; text: string }) => { log.posts.push(d); return "c-1"; },
    changeState: (_ref: ItemRef, c: unknown) => { log.changes.push(c); return true; },
  } as unknown as TicketPort;
  return { port, log };
};

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions", () => {
  const q = buildQuestion(ORDER, portOf(itemWith()));
  assert.ok(q.text.includes(ORDER.prompt as string), "the order is in the question");
  assert.equal(q.default, SONNET_LINE);
  assert.deepEqual(q.allowed, [...ALLOWED]);
  assert.deepEqual(actionsFor({ answer: "sonnet-line", text: "needs a read of the Region" }, ORDER), [
    { type: "post", item: REF, kind: "tier", text: "Tier: sonnet -- needs a read of the Region" },
  ]);
  assert.deepEqual(actionsFor({ answer: "haiku-label", text: "one mechanical edit, a command Acceptance" }, ORDER), [
    { type: "post", item: REF, kind: "tier", text: "tier:haiku: one mechanical edit, a command Acceptance" },
    { type: "change", item: REF, change: { addFlags: ["tier:haiku"] } },
  ]);
  assert.deepEqual(actionsFor({ answer: "escalate", text: "cannot tell" }, ORDER), []);
});

test("POSITIVE CONTROL: the posted line is counted as a decision by the sweep's own reader; the file is a loadable class under its byte cap", async () => {
  const [post] = actionsFor({ answer: "sonnet-line", text: "line one\n```\nnot a fence", }, ORDER);
  assert.ok(post !== undefined && post.type === "post");
  assert.equal(hasTierDecision({ number: 909, body: "", comments: [post.text] }), true);
  assert.equal(post.text.includes("\n"), false);
  assert.equal(whyNotClass(readyRows), null);
  assert.equal((await loadClasses(join(import.meta.dirname))).get("ready-rows-untiered")?.cause, "ready-rows-untiered");
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, "under the named cap");
  assert.deepEqual(tierQuestion(), { text: tierQuestion().text, default: TIER_DEFAULT, allowed: [TIER_DEFAULT, TIER_LARGER] });
  assert.deepEqual(itemOf(ORDER), REF);
  assert.deepEqual(itemOf({ prompt: "1 row:\n  #12 t" }), { tracker: "github", scope: "a11ign/a11ign", id: 12 });
  assert.equal(itemOf({ prompt: "1 row:\n  nope#12 t" }), null);
  assert.equal(itemOf({}), null);
  assert.equal(reasonOf("Tier: sonnet -- already"), "already");
  assert.equal(reasonOf("x".repeat(500)).length, 240);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or a malformed one, yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()));
  for (const bad of [{ answer: "approve", text: "x" }, { answer: "SONNET-LINE", text: "x" }, { answer: "sonnet-line" }, { answer: "sonnet-line", text: "  " }, { answer: "haiku-label", text: " " }, null, "sonnet-line", 3]) {
    assert.deepEqual(actionsFor(bad, ORDER), [], JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: a row that is no longer ready, or already carries a Tier line, yields no action and allows only `escalate`", () => {
  for (const item of [itemWith({ state: "in-progress" }), itemWith({ body: `${COMMAND_BODY}\nTier: sonnet -- judgment\n` }), itemWith({ flags: ["tier:haiku" as never] })]) {
    const q = buildQuestion(ORDER, portOf(item));
    assert.deepEqual(q.allowed, [ESCALATE]);
    assert.deepEqual(actionsFor({ answer: "sonnet-line", text: "x" }, ORDER), []);
    assert.deepEqual(actionsFor({ answer: "haiku-label", text: "x" }, ORDER), []);
  }
  buildQuestion(ORDER, portOf(null));
  assert.deepEqual(actionsFor({ answer: "sonnet-line", text: "x" }, ORDER), [], "unreadable");
  const never: DecisionOrder = { causeKey: "product-manager/ready-rows-untiered/other", prompt: ORDER.prompt as string };
  assert.deepEqual(actionsFor({ answer: "sonnet-line", text: "x" }, never), [], "never asked");
});

test("NEGATIVE CONTROL: `haiku-label` on a row whose Acceptance is not a command is refused by code, and the Sonnet line is still allowed", () => {
  for (const body of ["## Acceptance\n\nIt looks right.\n", "## Acceptance\n\n```bash\n# nothing yet\n```\n", "no section", "```bash\nnpx x\n```\n"]) {
    assert.equal(acceptanceIsCommand(body), false, body);
    const q = buildQuestion(ORDER, portOf(itemWith({ body })));
    assert.deepEqual(q.allowed, [SONNET_LINE, ESCALATE]);
    assert.deepEqual(actionsFor({ answer: "haiku-label", text: "mechanical" }, ORDER), [], body);
    assert.equal(actionsFor({ answer: "sonnet-line", text: "judgment" }, ORDER).length, 1);
  }
  assert.equal(acceptanceIsCommand(COMMAND_BODY), true);
});

const serve = async (structured: unknown, item: TicketItem, decide?: NonNullable<Parameters<typeof serveByRun>[1]["decide"]>) => {
  const dir = fresh();
  writeFileSync(join(dir, "seats.json"), JSON.stringify({ "ready-rows-untiered": "run" }));
  const { port, log } = stubPort(item);
  const result = await serveByRun(ORDER, {
    classes: new Map([["ready-rows-untiered", readyRows]]), seats: { path: join(dir, "seats.json") }, itemOf: () => REF, port: () => port, stateDir: fresh(),
    roleExcerpt: () => ROLE_EXCERPT, now: () => NOW, decisionDeps: { host: {} }, ...(decide === undefined ? {} : { decide }),
    run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: structured, session_id: "run-1" }), timedOut: false }) },
  });
  return { result, log };
};

test("through serveByRun: the Tier line is posted; haiku adds the label; an escalate writes nothing and falls back to the seat", async () => {
  const sonnet = await serve({ answer: "sonnet-line", text: "judgment over the Region" }, itemWith());
  assert.equal(sonnet.result.outcome, "served");
  assert.deepEqual(sonnet.log.posts.map((p) => p.text), ["Tier: sonnet -- judgment over the Region"]);
  assert.deepEqual(sonnet.log.changes, []);
  const haiku = await serve({ answer: "haiku-label", text: "mechanical" }, itemWith());
  assert.equal(haiku.result.outcome, "served");
  assert.deepEqual(haiku.log.changes, [{ addFlags: ["tier:haiku"] }]);
  const escalated = await serve({ answer: "escalate", text: "cannot tell" }, itemWith());
  assert.deepEqual(escalated.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(escalated.log, { posts: [], changes: [] });
});

test("NEGATIVE CONTROL: the tier is Haiku with no provider configured and Sonnet for a low-confidence pick", async () => {
  const tierOf = async (decide?: Parameters<typeof serve>[2]) => {
    const { result } = await serve({ answer: "sonnet-line", text: "judgment" }, itemWith(), decide);
    assert.equal(result.outcome, "served");
    return result.outcome === "served" ? result.tier : "";
  };
  assert.equal(await tierOf(), "haiku", "no provider configured");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet", confidence: 0.3 } } })), "sonnet", "low-confidence pick");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", fellBack: false, confidence: 0.9 } } })), "sonnet", "the provider picks Sonnet");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", fellBack: false, confidence: 0.9 } } })), "haiku");
});
