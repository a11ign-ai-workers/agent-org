// no-token: gh -- importing `org-health.ts` reaches `defaultRun`, and this file never lets it run: every read step is handed a recorded `run` that answers from a table and REFUSES any effect, and the effect steps are handed a fake `release` or a fake `post`.
/**
 * agent-org#1209: THE READS OF `orgHealthNow`'s readers are separated from their EFFECTS, with no behaviour change. Each reader that interleaved the two is split into a READ step
 * (returns data, performs no effect) and an EFFECT step (consumes that data, performs the effects, in the order the reader always did):
 *
 *   - the stale waits and the hold release  -- `liftableWaits` (read) then `applyHoldLifts` (release, log); `liftResolvedHolds` is the two in order;
 *   - the board truth audit and its post     -- `readBoardTruthAudit` (read: the closed rows, the merged pull requests, the herdr listing, the roadmaps, the epics)
 *     then `postBoardTruth` (effect: the day's table, and the prose findings' labels, inside `postDaysTable`); `boardTruthNow` is the two in order.
 *
 * THE RECORDED RUNNER is the test's proof: a read step is run against `recorder`, which answers the read verbs and THROWS on any effect verb (a comment, an edit, a POST or a
 * field write to the API), recording the call first. A read step that performs an effect is therefore caught twice: the call is in `writes`, and the step throws.
 * The POSITIVE CONTROLS are a reader with an effect, which the recorder catches, and the effect step itself, which the same recorder catches, so the negatives are not passing
 * because the recorder never sees a write.
 *
 * Logging is NOT an effect for this file: the log lines are the same text in the same order before and after the split, and the tests say so where they check them.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { WAIT_MARKER, waitItemOf, staleWaits } from "../wait-condition.ts";
import { postDaysTable } from "../board-truth-audit.ts";
import { applyHoldLifts, boardTruthNow, liftResolvedHolds, liftableWaits, postBoardTruth, readBoardTruthAudit } from "./org-health.ts";

const HOUR_MS = 3_600_000;
const NOW = Date.parse("2026-10-03T16:00:00Z");
const ISO = (ms: number) => new Date(ms).toISOString();
const REPO = "a11ign/a11ign";

type Fact = { state: "open" | "closed" | "merged"; labels: string[]; resolvedAt: number | null; changedAt: number | null };
const resolved = (state: "closed" | "merged"): Fact => ({ state, labels: [], resolvedAt: NOW - HOUR_MS, changedAt: NOW - HOUR_MS });

const marker = (lines: string) => ({ author: { login: "a11ign-ai-workers" }, createdAt: ISO(NOW - 3 * HOUR_MS), body: `${WAIT_MARKER}\nHeld by \`ceo\`.\n${lines}` });

/** A pull request held by `labels`, declaring `waits` in its hold marker (or none). */
function heldPr(labels: string[], waits: string[], extra: Record<string, unknown> = {}) {
  return { number: 3155, labels: labels.map((name) => ({ name })), body: "", comments: waits.length ? [marker(waits.map((w) => `Waiting-for: ${w}`).join("\n"))] : [],
    updatedAt: ISO(NOW - 2 * HOUR_MS), ...extra };
}

/** What the gate would find stale for `raw`, with `facts` as the referenced items. */
function staleOf(raw: Record<string, unknown>, facts: Record<string, Fact>) {
  return staleWaits({ items: [waitItemOf(raw, "pr")], facts: { items: facts }, now: NOW });
}

// --- the recorded runner --------------------------------------------------------------------------------------------------------

/** The verbs `gh` takes for an effect: a comment, an edit, a create, a state change, a merge, or an API write (POST, PATCH, PUT, DELETE, or a field). */
const EFFECT_VERBS = new Set(["comment", "edit", "create", "close", "reopen", "merge", "lock", "delete", "transfer"]);
const FIELD_FLAGS = new Set(["-f", "-F", "--field", "--raw-field"]);

function isEffect(args: string[]): boolean {
  if (args[0] === "api") {
    if (args.some((a) => a === "-X" || a === "--method" || a === "--input")) return true;
    return args[1] !== "graphql" && args.some((a) => FIELD_FLAGS.has(a));
  }
  return EFFECT_VERBS.has(args[1]);
}

/** A `run` for a read step: it answers the read verbs from a table (an empty list for a list, nothing for a REST read), records every call, and REFUSES an effect. */
function recorder() {
  const calls: string[][] = [];
  const writes: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    if (isEffect(args)) {
      writes.push(args);
      throw new Error(`EFFECT REFUSED in a read step: gh ${args.join(" ")}`);
    }
    if (args[0] === "api" && args[1] === "graphql") return JSON.stringify({ data: { repository: null } });
    if (args[0] === "issue" || args[0] === "pr") return "[]";
    return "";
  };
  return { run, calls, writes };
}

// --- the lift: the read step names what may be lifted, the effect step releases it ----------------------------------------------

test("the lift's READ STEP performs no release: it names the lifts from the waits alone, and the same reading twice is the same reading", () => {
  const stale = staleOf(heldPr(["hold:ceo"], ["closed #3220"]), { "#3220": resolved("closed") });
  const first = liftableWaits(stale, NOW, new Set([REPO]));
  const second = liftableWaits(stale, NOW, new Set([REPO]));
  assert.deepEqual(first, second, "a read is a function of its inputs, with nothing released between two readings");
  assert.equal(first.lifts.length, 1, "POSITIVE CONTROL: the read names the one hold whose Waiting-for is true");
  assert.equal(first.lifts[0].holders.join(","), "ceo");
  assert.equal(first.remaining.length, 0);
});

test("the read step leaves a stale wait it may not lift in `remaining`, unreleased, as `liftResolvedHolds` always did", () => {
  const stale = staleOf(heldPr(["answer:ceo"], ["closed #3220"]), { "#3220": resolved("closed") });
  const read = liftableWaits(stale, NOW, new Set([REPO]));
  assert.equal(read.lifts.length, 0, "an answer label is the session's to give, so the read names no lift");
  assert.equal(read.remaining.length, 1, "and the wait stays in remaining for a session");
});

test("the effect step releases each held lift once per holder, in the order the read named them, and logs each lift that held", () => {
  const stale = staleOf(heldPr(["hold:ceo", "hold:orchestrator"], ["closed #3220"]), { "#3220": resolved("closed") });
  const { lifts, remaining } = liftableWaits(stale, NOW, new Set([REPO]));
  const asked: [number, string][] = [];
  const said: string[] = [];
  const left = applyHoldLifts({ lifts, remaining }, { release: (n: number, s: string) => { asked.push([n, s]); return true; }, log: (l: string) => said.push(l) });
  assert.deepEqual(asked, [[3155, "ceo"], [3155, "orchestrator"]], "one release per holder, in the holder order the read named");
  assert.equal(said.length, 1, "one line for the one pull request that lifted");
  assert.match(said[0], /^DID lift-hold pr-.* \(ceo, orchestrator\)/);
  assert.deepEqual(left, [], "nothing is left for a session");
});

test("a release that fails keeps its stale wait in `remaining`, after the waits the read never lifted, and logs nothing for it", () => {
  const stale = staleOf(heldPr(["hold:ceo"], ["closed #3220"]), { "#3220": resolved("closed") });
  const { lifts, remaining } = liftableWaits(stale, NOW, new Set([REPO]));
  const said: string[] = [];
  const left = applyHoldLifts({ lifts, remaining }, { release: () => false, log: (l: string) => said.push(l) });
  assert.equal(left.length, 1, "the failed lift is ordered to a session instead");
  assert.deepEqual(said, [], "no lift is logged for a release that did not hold");
});

test("`liftResolvedHolds` is the read step then the effect step, the same calls, the same log and the same return", () => {
  const stale = staleOf(heldPr(["hold:ceo", "answer:ceo"], ["closed #3220"]), { "#3220": resolved("closed") });
  const viaComposed: [number, string][] = [];
  const logComposed: string[] = [];
  const composed = liftResolvedHolds(stale, { now: NOW, release: (n: number, s: string) => { viaComposed.push([n, s]); return true; }, log: (l: string) => logComposed.push(l), declared: new Set([REPO]) });
  const viaSplit: [number, string][] = [];
  const logSplit: string[] = [];
  const { lifts, remaining } = liftableWaits(stale, NOW, new Set([REPO]));
  const split = applyHoldLifts({ lifts, remaining }, { release: (n: number, s: string) => { viaSplit.push([n, s]); return true; }, log: (l: string) => logSplit.push(l) });
  assert.deepEqual(viaComposed, viaSplit);
  assert.deepEqual(logComposed, logSplit);
  assert.deepEqual(composed, split);
});

// --- the board truth: the read step performs no effect, the effect step posts ----------------------------------------------------

const OPEN_ROW = { number: 4001, title: "a row", labels: [], body: "", comments: [], updatedAt: ISO(NOW - HOUR_MS) };

test("the board truth READ STEP performs no effect: the audit is read through a recorded runner that refuses every write", () => {
  const rec = recorder();
  const audit = readBoardTruthAudit({ openRowsRead: [OPEN_ROW], claimedComments: [], waitFacts: null, now: NOW }, { repo: REPO, run: rec.run, agents: () => [] });
  assert.deepEqual(rec.writes, [], `no effect was attempted: ${JSON.stringify(rec.writes)}`);
  assert.ok(rec.calls.length > 0, "the read step did read, so the runner was really exercised");
  assert.ok(Array.isArray(audit.findings) && Array.isArray(audit.unread), "and it returns the audit a post would consume");
});

test("POSITIVE CONTROL: a reader that performs an effect is caught by the recorded runner, and the call is recorded before the refusal", () => {
  const rec = recorder();
  const readerWithEffect = (run: (args: string[]) => string) => { run(["issue", "comment", "3", "--body", "a post"]); return {}; };
  assert.throws(() => readerWithEffect(rec.run), /EFFECT REFUSED/);
  assert.deepEqual(rec.writes, [["issue", "comment", "3", "--body", "a post"]]);
});

test("POSITIVE CONTROL: the effect step, `postBoardTruth`, is caught by the same recorder when it posts the day's table", () => {
  const rec = recorder();
  const audit = readBoardTruthAudit({ openRowsRead: [OPEN_ROW], claimedComments: [], waitFacts: null, now: NOW }, { repo: REPO, run: recorder().run, agents: () => [] });
  const logged: string[] = [];
  postBoardTruth({ ...audit, unread: [] }, { now: NOW, repo: REPO, run: rec.run, post: postDaysTable, log: (l: string) => logged.push(l) });
  assert.ok(rec.writes.length > 0, `the day's table was the effect the recorder caught: ${logged.join(" | ")}`);
  assert.ok(rec.writes.some((args) => args[0] === "issue" && args[1] === "comment"), "posted as an issue comment");
});

test("`boardTruthNow` is the read step then the effect step: the post receives the very audit it returns, after the reads", () => {
  const order: string[] = [];
  const run = (args: string[]): string => { order.push(`read ${args[0]} ${args[1] ?? ""}`.trim()); return recorder().run(args); };
  let posted: { audit: unknown } | null = null;
  const returned = boardTruthNow({ openRowsRead: [OPEN_ROW], claimedComments: [], waitFacts: null, now: NOW }, {
    repo: REPO, run, agents: () => [], log: () => {},
    post: (input) => { order.push("post"); posted = { audit: input.audit }; return "posted"; },
  });
  assert.equal(posted!.audit, returned, "the post is handed the audit the gate gets back");
  assert.equal(order[order.length - 1], "post", "every read happens before the post");
  assert.ok(order.slice(0, -1).every((step) => step.startsWith("read ")), "and nothing but reads comes before it");
});
