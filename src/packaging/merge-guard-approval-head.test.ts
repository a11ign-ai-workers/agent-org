/**
 * RULE: DOES AN APPROVAL COVER THE HEAD? -- a11ign#5038, `src/merge-guard/approval-head-rule.ts`.
 * Replaces GitHub's `require_last_push_approval`, which marked an approval stale on every merge-base change
 * (a11ign#4980). Commits are given as a graph: `own` is `main...head`, parents point at earlier shas.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { approvalHeadReasons, latestApprovals } from "../merge-guard/approval-head-rule.ts";
import { mergeSafetyVerdict } from "../merge-guard.ts";
import { reasonKind } from "../merge-guard/reason-kind.ts";

const X = "aaaaaaaaaaaa"; // the approved commit
const MAIN_TIP = "bbbbbbbbbbbb"; // a commit main brought in: not one of the PR's own
const MERGE = "cccccccccccc"; // a merge of main into the branch, on top of X
const WORK = "dddddddddddd"; // a worker commit

const approvedAt = (commitId: string, sinceApproval: { sha: string; parents: string[]; }[] | null) =>
  ({ reviewer: "a11ign-bot", commitId, sinceApproval });

test("approval at X, then a merge from main: covered", () => {
  const facts = { ownShas: [X, MERGE],
    approvals: [approvedAt(X, [{ sha: MAIN_TIP, parents: ["0"] }, { sha: MERGE, parents: [X, MAIN_TIP] }])] };
  assert.deepEqual(approvalHeadReasons(MERGE, facts), []);
});

test("approval at X, then a worker commit: not covered, with a named reason", () => {
  const facts = { ownShas: [X, WORK], approvals: [approvedAt(X, [{ sha: WORK, parents: [X] }])] };
  const reasons = approvalHeadReasons(WORK, facts);
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /APPROVAL DOES NOT COVER THE HEAD/);
  assert.equal(reasonKind(reasons[0]), "APPROVAL_NOT_COVERING_HEAD");
});

test("approval at X, then a merge from main and a worker commit: not covered", () => {
  const facts = { ownShas: [X, MERGE, WORK], approvals: [approvedAt(X, [
    { sha: MAIN_TIP, parents: ["0"] }, { sha: MERGE, parents: [X, MAIN_TIP] }, { sha: WORK, parents: [MERGE] }])] };
  assert.equal(approvalHeadReasons(WORK, facts).length, 1);
});

test("a merge of another BRANCH (its parent is one of the PR's own commits) is not a merge from main", () => {
  const OTHER = "eeeeeeeeeeee";
  const facts = { ownShas: [X, OTHER, MERGE], approvals: [approvedAt(X, [
    { sha: OTHER, parents: ["0"] }, { sha: MERGE, parents: [X, OTHER] }])] };
  assert.equal(approvalHeadReasons(MERGE, facts).length, 1);
});

test("the approved commit is not an ancestor of the head (force-push): not covered", () => {
  assert.equal(approvalHeadReasons(WORK, { ownShas: [WORK], approvals: [approvedAt(X, null)] }).length, 1);
});

test("approval AT the head covers it; no approval at all raises no reason (protection's job, and gate does not rerun on a review)", () => {
  assert.deepEqual(approvalHeadReasons(X, { ownShas: [X], approvals: [approvedAt(X, [])] }), []);
  assert.deepEqual(approvalHeadReasons(WORK, { ownShas: [WORK], approvals: [] }), []);
});

test("reviews without an opinion never count, and a later CHANGES_REQUESTED replaces an approval", () => {
  const review = (state: string, at: string, reviewer = "r") => ({ reviewer, state, commitId: X, submittedAt: at });
  assert.deepEqual(latestApprovals([review("COMMENTED", "2026-10-11T01:00:00Z")]), []);
  assert.equal(latestApprovals([review("APPROVED", "2026-10-11T01:00:00Z"),
    review("COMMENTED", "2026-10-11T02:00:00Z")]).length, 1, "a comment does not undo an approval");
  assert.deepEqual(latestApprovals([review("APPROVED", "2026-10-11T01:00:00Z"),
    review("CHANGES_REQUESTED", "2026-10-11T02:00:00Z")]), []);
});

test("the gate verdict is REFUSED with the reason, CANNOT_ASK when unread, and READY when covered", () => {
  const pr = { headRefOid: WORK, number: 1, state: "open" };
  const uncovered = { ownShas: [X, WORK], approvals: [approvedAt(X, [{ sha: WORK, parents: [X] }])] };
  assert.equal(mergeSafetyVerdict({ pr, branchTip: WORK, approvals: uncovered }).code, 1);
  assert.equal(mergeSafetyVerdict({ pr, branchTip: WORK, approvals: null }).code, 2, "unread is not covered");
  assert.equal(mergeSafetyVerdict({ pr, branchTip: WORK, approvals: { ownShas: [], approvals: [] } }).code, 0);
});
