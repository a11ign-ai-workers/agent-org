// no-token: gh -- every input is injected; the claim and the guard are asked about facts, and no lookup reaches GitHub.
/**
 * ROWS ARE HAIKU-READY (a11ign#5109, the Haiku push): a row that says `Tests-first:` names the test file its worker must make pass,
 * the CLAIM refuses a row that says it and names none, and the MERGE GUARD refuses a PR that moves those tests after its first commit
 * unless a reviewer approves the change in so many words.
 *
 * Why the tests are the row's and not the worker's: Haiku went 0/15 to 7/9 with a written spec and 3/12 to 11/12 with a test oracle it
 * could run, and a worker that may edit the oracle has no oracle. So the first commit lands the tests unchanged and failing, and what
 * moves them afterwards needs a second reader.
 *
 * Behind `rows.testsFirst` in `.agent-org/project.json`, absent meaning OFF: every test below that expects a refusal has a twin that
 * proves the same fixture passes with the flag off, so a refusal that fires always cannot pass.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  testsFirstOf, testsFirstFlagOf, closedRowsOf, testsFirstEditReasons, lookupTestsFirstFacts, mergeReadiness, mergeSafetyVerdict,
} from "../merge-guard.ts";
import { claimRow, testsFirstClaimReason } from "../row-claim.ts";

const ROW = 5109;
const TEST_PATH = "src/packaging/tests-first.test.ts";

// --- WHAT A ROW SAYS: `Tests-first:` NAMES A TEST FILE --------------------------------------------------------------------------

test("an inline `Tests-first:` line names its files, in any of the shapes a row is written in", () => {
  assert.deepEqual(testsFirstOf(`Tests-first: ${TEST_PATH}`), { marked: true, paths: [TEST_PATH] });
  assert.deepEqual(testsFirstOf("Tests-first: `src/a.test.ts`, src/b.test.ts"), { marked: true, paths: ["src/a.test.ts", "src/b.test.ts"] });
  assert.deepEqual(testsFirstOf("## Tests-first\n- `src/a.test.ts`\n- tests/test_b.py\n\n## Region\nsrc/a.ts"),
    { marked: true, paths: ["src/a.test.ts", "tests/test_b.py"] }, "a heading, its bullets, and nothing from the next section");
  assert.deepEqual(testsFirstOf("**Tests-first:** agent-org:src/a.test.ts"), { marked: true, paths: ["src/a.test.ts"] },
    "a Region-style `key:` prefix names the repository and is not part of the path");
});

test("a row that does not say `Tests-first:` is not marked, and a mark that names no test file is marked with no paths", () => {
  assert.deepEqual(testsFirstOf("## Region\nsrc/a.ts\n## Acceptance\nnode --test src/a.test.ts"), { marked: false, paths: [] },
    "a test file named under Acceptance is not a Tests-first row: decomposition, investigation and fleet rows stay unmarked");
  for (const body of ["Tests-first:", "Tests-first: none", "Tests-first: TBD -- the worker will write them", "Tests-first: src/a.ts"]) {
    assert.deepEqual(testsFirstOf(body), { marked: true, paths: [] }, body);
  }
});

// --- THE FLAG: ABSENT IS OFF ---------------------------------------------------------------------------------------------------

test("`rows.testsFirst` is on only when it is exactly true; absent, false, a string and unreadable text are all off", () => {
  assert.equal(testsFirstFlagOf(JSON.stringify({ schema: 1, rows: { testsFirst: true } })), true);
  for (const text of [JSON.stringify({ schema: 1 }), JSON.stringify({ rows: {} }), JSON.stringify({ rows: { testsFirst: false } }),
    JSON.stringify({ rows: { testsFirst: "true" } }), JSON.stringify({ rows: null }), "not json", ""]) {
    assert.equal(testsFirstFlagOf(text), false, text);
  }
});

// --- THE CLAIM: A TESTS-FIRST ROW MUST NAME ITS TEST FILE ------------------------------------------------------------------------

test("DONE-WHEN 1a: a claim of a marked row that names no test path is refused, and the reason says what to write", () => {
  const reason = testsFirstClaimReason("## Region\nsrc/a.ts\nTests-first: TBD", ROW, { enabled: true });
  assert.ok(reason, "a marked row naming no test file is refused at claim");
  assert.match(reason as string, new RegExp(`#${ROW}`));
  assert.match(reason as string, /Tests-first/);
  assert.match(reason as string, /test file/, "it says what the line must carry");
});

test("DONE-WHEN 1a POSITIVE CONTROLS: the same row is claimed when it names a test, when it is unmarked, and when the flag is off", () => {
  assert.equal(testsFirstClaimReason(`Tests-first: ${TEST_PATH}`, ROW, { enabled: true }), null, "a named test file is the whole requirement");
  assert.equal(testsFirstClaimReason("## Region\nsrc/a.ts", ROW, { enabled: true }), null, "an unmarked row is exempt: decomposition, investigation, fleet");
  assert.equal(testsFirstClaimReason("Tests-first: TBD", ROW, { enabled: false }), null, "flag off is today's behaviour");
});

const BODY_NAMING_NO_TEST = "## Region\nsrc/row-claim.ts\n\n## Acceptance\nnpx rstest run src/packaging/tests-first.test.ts\n\n"
  + "## Open-check\ngit grep -c Tests-first origin/main -- src/row-claim.ts\n\nTests-first: TBD\n";
const BODY_NAMING_A_TEST = BODY_NAMING_NO_TEST.replace("Tests-first: TBD", `Tests-first: ${TEST_PATH}`);

/** A `gh` for one `ready` row with this body that records every write. */
function claimStub(body: string, writes: string[][]) {
  let labelReads = 0;
  return (_cmd: string, args: string[]): string => {
    if (args[1] === "edit" || args[1] === "comment") writes.push(args);
    if (args[1] === "view" && args.includes("number,title,labels,state")) {
      labelReads += 1;
      const mine = ["session:worker-5109", "in-progress"];
      const labels = labelReads === 1 ? ["ready"] : [...mine, "started", "was-ready"];
      return JSON.stringify({ number: ROW, title: "A row", state: "OPEN", labels: labels.map((name) => ({ name })) });
    }
    if (args[1] === "view" && args.includes("body,labels")) return JSON.stringify({ body, labels: [{ name: "ready" }] });
    if (args[1] === "view") throw new Error("simulated: this fixture answers no blockedBy");
    return "[]";
  };
}
const claim = (body: string, testsFirst: boolean, writes: string[][] = []) =>
  claimRow(ROW, "worker-5109", { run: claimStub(body, writes), moveStatus: () => ({ moved: true }), testsFirst });

test("DONE-WHEN 1a THROUGH `claimRow`: a marked row with no test path is NOT CLAIMED and nothing is written", () => {
  const writes: string[][] = [];
  const got = claim(BODY_NAMING_NO_TEST, true, writes);
  assert.equal(got.claimed, false);
  assert.match((got as { reason: string }).reason, /Tests-first/);
  assert.deepEqual(writes, [], "a refused claim leaves the row exactly as it found it");
});

test("DONE-WHEN 1a POSITIVE CONTROLS THROUGH `claimRow`: the same row claims once it names a test, and with the flag off", () => {
  assert.equal(claim(BODY_NAMING_A_TEST, true).claimed, true, "naming the test file clears the refusal");
  assert.equal(claim(BODY_NAMING_NO_TEST, false).claimed, true, "flag off: the claim asks nothing new");
});

// --- THE GUARD: THE TESTS DO NOT MOVE AFTER THE FIRST COMMIT --------------------------------------------------------------------

const facts = (over: Partial<Parameters<typeof testsFirstEditReasons>[1] & object> = {}) => ({
  paths: [TEST_PATH], firstCommitFiles: [TEST_PATH], changedSinceFirst: ["src/row-claim.ts", "src/merge-guard.ts"], approvedBy: [], ...over,
});

test("DONE-WHEN 1b: a PR that edits a named test after its first commit is refused, naming the test and the way through", () => {
  const reasons = testsFirstEditReasons(7, facts({ changedSinceFirst: ["src/row-claim.ts", TEST_PATH] }));
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /TESTS-FIRST/);
  assert.match(reasons[0], new RegExp(TEST_PATH.replace(/[.]/g, "\\.")));
  assert.match(reasons[0], /#7/);
  assert.match(reasons[0], /Tests-first: change approved/, "the refusal names the line a reviewer posts to let it through");
});

test("DONE-WHEN 1b POSITIVE CONTROLS: tests landed in the first commit and untouched since raise nothing, and neither do other files", () => {
  assert.deepEqual(testsFirstEditReasons(7, facts()), [], "implementation after the tests is the whole point");
  assert.deepEqual(testsFirstEditReasons(7, facts({ changedSinceFirst: ["src/packaging/other.test.ts"] })), [], "another test is not a named one");
});

test("a PR whose first commit does not carry the named tests is refused: they are the FIRST commit's, not a later one's", () => {
  const reasons = testsFirstEditReasons(7, facts({ firstCommitFiles: ["src/row-claim.ts"], changedSinceFirst: [TEST_PATH] }));
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /FIRST commit/);
  assert.match(reasons[0], new RegExp(TEST_PATH.replace(/[.]/g, "\\.")));
});

test("DONE-WHEN 1c: an explicit reviewer approval lets the edit through, and only for what that reviewer read", () => {
  const edited = { changedSinceFirst: [TEST_PATH] };
  assert.equal(testsFirstEditReasons(7, facts(edited)).length, 1, "NEGATIVE CONTROL: the identical edit with nobody approving is refused");
  assert.deepEqual(testsFirstEditReasons(7, facts({ ...edited, approvedBy: ["reviewer-7"] })), [], "approved: through");
});

// --- THE LOOKUP: WHICH ROW, WHICH TESTS, WHICH REVIEWER ---------------------------------------------------------------------

const HEAD = "b".repeat(40);
const FIRST = "a".repeat(40);
const REVIEWED = "c".repeat(40);

/** A scripted `gh api` for PR 7 of the repository `a11ign/agent-org`, closing row 5109 whose body is `rowBody`. */
function scriptedGh(rowBody: string, { reviews = [] as object[], sinceReview = [] as string[], sinceFirst = [TEST_PATH, "src/row-claim.ts"] } = {}) {
  const calls: string[] = [];
  const run = (args: string[]): string => {
    const path = args.find((arg) => arg.startsWith("repos/")) ?? args.join(" ");
    calls.push(path);
    if (path.includes("/issues/5109") || (args[0] === "issue" && args[1] === "view")) return JSON.stringify({ body: rowBody, labels: [] });
    if (path.includes("/pulls/7/commits")) return `${FIRST}\n`;
    if (path.includes(`/commits/${FIRST}`)) return JSON.stringify([TEST_PATH]);
    if (path.includes(`/compare/${FIRST}...${HEAD}`)) return JSON.stringify(sinceFirst);
    if (path.includes(`/compare/${REVIEWED}...${HEAD}`)) return JSON.stringify(sinceReview);
    if (path.includes("/pulls/7/reviews")) return reviews.map((review) => JSON.stringify(review)).join("\n");
    throw new Error(`simulated: no answer for ${path}`);
  };
  return { run, calls };
}
const PR = { number: 7, head: HEAD, author: "worker-5109", body: "Closes a11ign/agent-org#5109\n" };
const APPROVAL = { reviewer: "reviewer-7", state: "APPROVED", body: "Tests-first: change approved", commitId: REVIEWED };

test("the lookup reads the closed row's tests, the first commit's files and what changed since, and finds the edit", () => {
  const { run } = scriptedGh(`Tests-first: ${TEST_PATH}\n`);
  const got = lookupTestsFirstFacts(PR, { run, enabled: true });
  assert.deepEqual(got, { paths: [TEST_PATH], firstCommitFiles: [TEST_PATH], changedSinceFirst: [TEST_PATH, "src/row-claim.ts"], approvedBy: [] });
});

test("the lookup asks nothing when the flag is off, when the PR closes no row, and when the row is not marked", () => {
  const off = scriptedGh(`Tests-first: ${TEST_PATH}\n`);
  assert.equal(lookupTestsFirstFacts(PR, { run: off.run, enabled: false }), undefined);
  assert.deepEqual(off.calls, [], "flag off spends no call: it is today's guard exactly");
  assert.equal(lookupTestsFirstFacts({ ...PR, body: "Closes: none -- docs only\n" }, { run: off.run, enabled: true }), undefined);
  assert.equal(lookupTestsFirstFacts(PR, { run: scriptedGh("## Region\nsrc/a.ts\n").run, enabled: true }), undefined, "an unmarked row is exempt");
});

test("the lookup counts a reviewer's approval only when it is by someone other than the author, carries the line, and read what will merge", () => {
  const via = (review: object, sinceReview: string[] = []) =>
    lookupTestsFirstFacts(PR, { run: scriptedGh(`Tests-first: ${TEST_PATH}\n`, { reviews: [review], sinceReview }).run, enabled: true });
  assert.deepEqual((via(APPROVAL) as { approvedBy: string[] }).approvedBy, ["reviewer-7"], "POSITIVE CONTROL: the whole shape counts");
  assert.deepEqual((via({ ...APPROVAL, reviewer: "worker-5109" }) as { approvedBy: string[] }).approvedBy, [], "the author cannot approve their own edit");
  assert.deepEqual((via({ ...APPROVAL, body: "LGTM" }) as { approvedBy: string[] }).approvedBy, [], "an approval without the line did not read the tests");
  assert.deepEqual((via({ ...APPROVAL, state: "COMMENTED" }) as { approvedBy: string[] }).approvedBy, [], "the line in a bare comment is not an approval");
  assert.deepEqual((via(APPROVAL, [TEST_PATH]) as { approvedBy: string[] }).approvedBy, [],
    "the tests moved again after the review, so the reviewer did not read what will merge");
});

test("a lookup that could not be read is null, never undefined and never an empty approval", () => {
  const broken = (args: string[]) => { throw new Error(`simulated outage on ${args.join(" ")}`); };
  assert.equal(lookupTestsFirstFacts(PR, { run: broken, enabled: true }), null);
});

test("the rows a PR closes come from its own `Closes` line, in either repository form", () => {
  assert.deepEqual(closedRowsOf("Closes #12, #13\n", "a11ign/a11ign"), [{ number: 12, repo: "a11ign/a11ign" }, { number: 13, repo: "a11ign/a11ign" }]);
  assert.deepEqual(closedRowsOf("Closes: a11ign/a11ign#5109", "a11ign/agent-org"), [{ number: 5109, repo: "a11ign/a11ign" }]);
  assert.deepEqual(closedRowsOf("Closes: none -- docs only", "a11ign/a11ign"), [], "`none` closes no row");
});

// --- THE VERDICT: THE GUARD COMPOSES IT, AND UNREAD IS NEVER CLEAR ----------------------------------------------------------------

const green = [{ name: "gate", status: "completed", conclusion: "success", completedAt: "2026-10-11T10:00:00Z" }];
const ready = {
  pr: { number: 7, state: "OPEN", baseRefName: "main", headRefOid: HEAD }, required: ["gate"], runs: green,
  mainTipIso: "2026-10-11T09:00:00Z", behindBy: 0, branchTip: HEAD,
};

test("`mergeReadiness` refuses an edited test, passes it once approved, and says it could not ask when the facts are null", () => {
  assert.equal(mergeReadiness(ready).code, 0, "BASELINE: the fixture is ready with no Tests-first facts at all");
  const edited = mergeReadiness({ ...ready, testsFirst: facts({ changedSinceFirst: [TEST_PATH] }) });
  assert.equal(edited.code, 1);
  assert.match(edited.reasons.join("\n"), /TESTS-FIRST/);
  assert.equal(mergeReadiness({ ...ready, testsFirst: facts({ changedSinceFirst: [TEST_PATH], approvedBy: ["reviewer-7"] }) }).code, 0);
  assert.equal(mergeReadiness({ ...ready, testsFirst: facts() }).code, 0, "named tests left alone");
  assert.equal(mergeReadiness({ ...ready, testsFirst: null }).code, 2, "unread is not clear");
});

test("the REQUIRED gate (`mergeSafetyVerdict`) enforces it too, because that is the check that can stop an armed merge", () => {
  const pr = { headRefOid: HEAD, number: 7, state: "open" };
  assert.equal(mergeSafetyVerdict({ pr, branchTip: HEAD }).code, 0, "BASELINE: no facts, no refusal");
  assert.equal(mergeSafetyVerdict({ pr, branchTip: HEAD, testsFirst: facts({ changedSinceFirst: [TEST_PATH] }) }).code, 1);
  assert.equal(mergeSafetyVerdict({ pr, branchTip: HEAD, testsFirst: facts({ changedSinceFirst: [TEST_PATH], approvedBy: ["r"] }) }).code, 0);
  assert.equal(mergeSafetyVerdict({ pr, branchTip: HEAD, testsFirst: null }).code, 2);
  assert.equal(mergeSafetyVerdict({ pr: { ...pr, state: "closed" }, branchTip: HEAD, testsFirst: facts({ changedSinceFirst: [TEST_PATH] }) }).code, 0,
    "a closed PR cannot merge, so refusing it protects nothing (#690)");
});
