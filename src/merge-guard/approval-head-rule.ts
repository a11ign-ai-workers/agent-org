#!/usr/bin/env node
// @ts-check
// RULE: DOES AN APPROVAL COVER THE HEAD? -- #5038 (a11ign), replacing GitHub's `require_last_push_approval`.
//
// GitHub's last-push rule answered "was this approval submitted after the newest push", and ALSO marked an
// approval stale whenever the PR's MERGE BASE changed. a11ign#4980 sat approved at its head, clean and
// armed, and was refused with "Review ... is stale because it was submitted before the merge base
// changed"; every refresh from main would have done the same to every approved PR. The chairman turned
// the setting back off, which reopened the gap it closed: a commit pushed after the approval merges unreviewed.
//
// THE QUESTION THIS RULE ASKS INSTEAD: is every commit after the approved one a MERGE FROM main? Such a
// commit brings in what main already carries and nothing the reviewer has not seen from this PR. Anything
// else -- a worker commit, or a merge of some other branch -- is new work and the approval does not cover it.
//
// "A merge from main" is read from the graph, not from a message: a commit with two or more parents whose
// every parent after the first is NOT among the PR's own commits (`main...head`). A parent that is an
// ancestor of the head and is not one of the PR's own commits is reachable from main, by construction.
// Conservative on purpose: a rebase, a force-push or a merge with main as the FIRST parent is read as new work.
//
// Reviews without an opinion (COMMENTED, PENDING) never count, and neither do approvals a later
// CHANGES_REQUESTED or DISMISSED from the same reviewer replaced. NO approval at all raises NO reason here:
// "somebody must approve" is branch protection's requirement, and `gate` does not rerun on a review event,
// so refusing an unapproved head would stay red after the approval arrived.

import type { ApprovalFacts } from "../ticket-port/approval-reads.ts";

export type { ApprovalFacts };
export { latestApprovals } from "../ticket-port/approval-reads.ts";

function isMergeFromMain(commit: { parents: string[]; }, own: Set<string>): boolean {
  return commit.parents.length >= 2 && commit.parents.slice(1).every((parent) => !own.has(parent));
}

/** Does one approval cover `head`? True when every PR commit after the approved one is a merge from main. */
export function approvalCovers(
  approval: ApprovalFacts["approvals"][number], head: string, ownShas: string[],
): boolean {
  if (approval.commitId === head) return true;
  if (approval.sinceApproval === null) return false;
  const own = new Set(ownShas);
  return approval.sinceApproval.filter((c) => own.has(c.sha)).every((c) => isMergeFromMain(c, own));
}

export function approvalHeadReasons(head: string, facts: ApprovalFacts): string[] {
  if (facts.approvals.length === 0) return [];
  if (facts.approvals.some((a) => approvalCovers(a, head, facts.ownShas))) return [];
  const who = facts.approvals.map((a) => `${a.reviewer} at ${a.commitId.slice(0, 10)}`).join(", ");
  return [`APPROVAL DOES NOT COVER THE HEAD: approved by ${who}; the head is ${head.slice(0, 10)}.\n`
    + "  A commit after the approval is not a merge from main, so a reviewer has not read it.\n"
    + "  Merges from main do not count against an approval; any other commit does. "
    + "Ask the reviewer to re-review the new commits."];
}
