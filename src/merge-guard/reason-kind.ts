#!/usr/bin/env node
// @ts-check
// WHICH reason a refusal is, not just that there was one -- shared classification, not a rule of its own.
//
// Kept as ONE list rather than distributed one pattern per rule module: "the guard refused for ancestry
// and GitHub merged it" and "the guard refused for a missing check and GitHub merged it" are different
// bugs, and `merge-guard.ts`'s `#188` reconciliation log needs to tell them apart from a bare verdict.
// Scattering these regexes across eight rule files would recreate exactly the fact-stated-twice shape
// CLAUDE.md warns against -- a rule's message text and its classification pattern are the SAME fact, and
// they belong next to each other only if nothing else needs to compare across rules. `reasonKind` does.

/** @type {[RegExp, string][]} */
const REASON_KINDS: [RegExp, string][] = [
  [/^BASE IS NOT main/, "BASE_NOT_MAIN"],
  [/^NO CHECK RUNS EXIST/, "NO_RUNS"],
  [/^REQUIRED CONTEXT NEVER RAN/, "MISSING_REQUIRED_CONTEXT"],
  [/^STILL RUNNING/, "STILL_RUNNING"],
  [/^FAILING/, "FAILING"],
  [/^THIS HEAD DOES NOT CONTAIN main's TIP/, "ANCESTRY"],
  [/^EVERY RUN PREDATES THE CURRENT main/, "STALE"],
  [/^WOULD CLOSE #/, "CLAIMED_BY_ANOTHER_SESSION"],
  [/^GITHUB'S HEAD IS NOT THE BRANCH TIP/, "HEAD_MISMATCH"],
  [/^APPROVAL DOES NOT COVER THE HEAD/, "APPROVAL_NOT_COVERING_HEAD"],
  // `#<n>` is `#?` when the PR number is not known yet (`merge-guard.ts` falls back to it), so the number is any non-space run.
  [/^TESTS-FIRST: #\S+ changes /, "TESTS_FIRST_TESTS_MOVED"],
  [/^TESTS-FIRST: the FIRST commit of /, "TESTS_FIRST_NOT_IN_FIRST_COMMIT"],
];

/**
 * @param {string} reason
 * @returns {string}
 */
export function reasonKind(reason: string): string {
  const hit = REASON_KINDS.find(([pattern]) => pattern.test(reason));
  return hit ? hit[1] : "UNCLASSIFIED";
}
