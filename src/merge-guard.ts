#!/usr/bin/env node
// @ts-check
// command: ask whether a PR's checks actually ran and passed, never trusting mergeStateStatus alone
// IS THIS PR ACTUALLY TESTED? -- asked of the check RUNS, never of `mergeStateStatus`.
//
// `mergeStateStatus` cannot tell "every required check passed" from "no check ever ran", and on
// 2026-09-07 the second one presented as the greenest PR on the board. #148's base was another open PR's
// branch rather than `main`:
//
//     #148  lead/gate-ages-what-it-scored -> lead/real-page-outcome-is-stated
//     CLEAN/MERGEABLE   check-runs: []   182 insertions into check-real-page-findings.ts
//
// `ci.yml` is `on: pull_request: branches: [main]`, so a PR into a non-`main` base triggers no workflow
// at all and branch protection -- which covers `main` -- applies to nothing. **`CLEAN/MERGEABLE` is the
// CORRECT answer to the question GitHub was asked**, which is exactly what makes it dangerous: a required
// context that never ran is not a failing check, it is NO check, and the field cannot express the
// difference. That is this repository's most-recorded defect -- a check reporting cleanly having examined
// nothing -- arriving in the merge flow itself. It was caught by a human noticing the check-run list was
// EMPTY rather than green.
//
// THIS TOOL THEREFORE NEVER READS `mergeStateStatus`, and `merge-guard.test.ts` asserts that it does not.
// A verification that shares a failure mode with the action verifies nothing -- the same rule as checking
// `/health` over HTTP rather than through the deploy channel that just failed.
//
//   node packages/agent-org/src/merge-guard.ts <pr-number> [--session=<name>] [--allow-claimed-close=<name>]
//
// Exit codes are the contract:
//   0  READY      -- based on main, every required context present and concluded, tested against this main
//   1  REFUSED    -- and it NAMES which of the reasons, because they need different fixes
//   2  CANNOT ASK -- a lookup failed. INCONCLUSIVE, never "fine": reporting an unaskable question as
//                    clean is how "verified" comes to mean "unexamined"
//
// #455 (A4 of the merge-conflict-prevention plan): ONE MODULE PER RULE, THIS FILE KEEPS THE ENTRY POINT.
//
// Three changes to this one file in one night produced two conflicts and a deadlock between rules nobody
// read together (#442, the armed-race rule and the ancestry rule interacting under strict protection --
// see `packages/agent-org/src/merge-guard/armed-race-rule.ts` for the full account). Each check now lives in its own
// file under `packages/agent-org/src/merge-guard/`, with its own test, so a rule can be read, changed and
// mutation-checked without touching the seven others:
//
//   packages/agent-org/src/merge-guard/base-rule.ts          is the PR based on `main`?               (#148)
//   packages/agent-org/src/merge-guard/head-tip-rule.ts       does GitHub's recorded head match the tip? (#294/#195)
//   packages/agent-org/src/merge-guard/checks-rule.ts         did every required context run and conclude? (#148)
//   packages/agent-org/src/merge-guard/staleness-rule.ts      did every run finish after main's CURRENT tip? (#100/#135)
//   packages/agent-org/src/merge-guard/ancestry-rule.ts       does this head CONTAIN main's tip?        (#182/#165)
//   packages/agent-org/src/merge-guard/claimed-row-rule.ts    would arming close a row someone else holds? (#249)
//   packages/agent-org/src/merge-guard/pr-hold-rule.ts        is somebody else actively working this PR?  (#266/#258)
//   packages/agent-org/src/merge-guard/armed-race-rule.ts     would a push race an already-armed merge?    (#386/#442)
//
// Two more modules hold shared machinery that is not itself a refusal rule, so splitting it per-rule
// would recreate the fact-stated-twice shape rather than fix it:
//
//   packages/agent-org/src/merge-guard/reason-kind.ts         classifies a reason string -- read by every rule's own
//                                                test AND by the reconciliation log below
//   packages/agent-org/src/merge-guard/lookups.ts             the network/process calls every rule's facts come from
//   packages/agent-org/src/merge-guard/reconciliation.ts      #188's verdict log and its `--reconcile` comparison
//
// This file composes them (`mergeReadiness`, the full composition; `mergeSafetyVerdict`, the narrower
// self-reference-safe one), re-exports every name a rule module owns (so the five existing importers --
// `merge-queue.ts`, `row-claim.ts`, `workflow-run-liveness.ts`, and
// `pre-push-armed-pr.test.ts` -- need no changes at all), and runs the CLI.
import { pathToFileURL } from "node:url";
import { realpathSync, readFileSync } from "node:fs";
import { join } from "node:path";
// RELATIVE, NOT the `@a11ign/screenreader-fleet/cli-flags` package specifier: that export map
// points at `dist/`, so it needs both `node_modules` AND a completed build. This file is reachable
// from a pre-install entry (see `pre-install-import-graph.test.ts`, which derives that population
// rather than naming it), and there it dies on startup with ERR_MODULE_NOT_FOUND.
import { refuseUnknownFlags, flagValue } from "./lib/cli-flags.ts";
import { REPO } from "./project-identity.ts";
import { HOME_CHECKOUT, PROJECT_DECLARATION_PATH } from "./project-config.ts";
import { SESSION_PREFIX } from "./project-vocabulary.ts";

import { reasonKind } from "./merge-guard/reason-kind.ts";
import { testsFirstReadsOf, type TestsFirstFacts } from "./ticket-port/tests-first-reads.ts";
import { gh, lookup, lookupRequiredContexts, lookupBranchTip, lookupCheckRuns, lookupClosingIssues,
  lookupApprovalFacts }
  from "./merge-guard/lookups.ts";
import { baseReason } from "./merge-guard/base-rule.ts";
import { headTipMismatchReason } from "./merge-guard/head-tip-rule.ts";
import { SATISFIED, checkReasons } from "./merge-guard/checks-rule.ts";
import { stalenessReason } from "./merge-guard/staleness-rule.ts";
import { ancestryReason } from "./merge-guard/ancestry-rule.ts";
import {
  closingClaimReasons, claimedCloseCoveredBy, applyAllowClaimedClose,
} from "./merge-guard/claimed-row-rule.ts";
import { prHoldReasons } from "./merge-guard/pr-hold-rule.ts";
import { approvalHeadReasons, type ApprovalFacts } from "./merge-guard/approval-head-rule.ts";
import { holdersOf, HOLD_PREFIX } from "./pr-hold-state.ts";
import { racesAnArmedMerge, lookupArmedPrStatus } from "./merge-guard/armed-race-rule.ts";
import {
  appendJsonl, gitCommonDir, verdictLogPath, agreementLogPath, recordVerdict, latestVerdictFor,
  realOutcomeFor, reconcile,
} from "./merge-guard/reconciliation.ts";

// RE-EXPORTED so every existing importer keeps working unchanged -- see the header above for who reads
// which. Each name is now DEFINED in its own rule/shared module; this is the one place all of them are
// visible together, which is what an entry point is for.
export {
  reasonKind,
  gh, lookup, lookupRequiredContexts, lookupBranchTip, lookupCheckRuns, lookupClosingIssues,
  baseReason, headTipMismatchReason, SATISFIED, checkReasons, stalenessReason, ancestryReason,
  closingClaimReasons, claimedCloseCoveredBy, prHoldReasons, approvalHeadReasons, lookupApprovalFacts,
  racesAnArmedMerge, lookupArmedPrStatus,
  appendJsonl, gitCommonDir, verdictLogPath, agreementLogPath, recordVerdict, latestVerdictFor,
  realOutcomeFor, reconcile,
};

const EXIT = { READY: 0, REFUSED: 1, CANNOT_ASK: 2 };

// --- ROWS ARE HAIKU-READY (a11ign#5109): THE TESTS A ROW NAMES ARE THE ROW'S, NOT THE WORKER'S ----------------------------------------
//
// A row that says `Tests-first: <test file>` has its acceptance tests written BEFORE the worker starts. The claim checks the line
// names a test file (`row-claim.ts`'s `testsFirstClaimReason`); THIS is the other half: the worker's first commit lands those tests
// unchanged, and a PR that moves them afterwards is refused unless a reviewer who is not its author approves the change in so many
// words. A worker that may edit its own oracle has no oracle (Haiku 3/12 one-shot, 11/12 with a suite it could not move).
//
// BEHIND `rows.testsFirst` in `.agent-org/project.json`, ABSENT MEANING OFF, so a project that never declared it makes exactly the
// calls it always made. The facts come from REST only -- the required gate answers through a GraphQL outage (see `ciGateFacts`) -- so
// the rows a PR closes are read from its own `Closes` line, which `pr:open` and CI already refuse a PR for omitting.

/** The review-body line that lets a PR move its named tests. Explicit on purpose: an ordinary approval says nothing about the tests. */
const TESTS_FIRST_APPROVAL = /^\s*Tests-first:\s*changes?\s+approved\b/im;
const TESTS_FIRST_INLINE = /^\s*(?:\*\*|__)?Tests-first:(?:\*\*|__)?\s*(.*)$/i;
const TESTS_FIRST_HEADING = /^\s*#{1,6}\s*Tests-first\b(?::\s*(.*))?.*$/i;
const MARKDOWN_HEADING = /^\s*#{1,6}\s/;
const PATH_SHAPE = /^[\w@.+~-]+(?:\/[\w@.+~-]+)*\.\w+$/;
const TEST_NAMED = /(^|[._-])(test|tests|spec)([._-]|$)/i;
const TEST_DIRECTORY = /(^|\/)(tests?|__tests__)\//;
const CLOSING_LIST = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b:?\s+((?:[\w.-]+\/[\w.-]+)?#\d+(?:\s*,\s*(?:[\w.-]+\/[\w.-]+)?#\d+)*)/gi;

export type { TestsFirstFacts };

function testFilePath(token: string): string | null {
  const bare = token.replace(/^[-*>\s`'"(]+|[`'",;.)]+$/g, "").replace(/^[a-z0-9][\w-]*:(?=[^/])/i, "");
  if (!PATH_SHAPE.test(bare)) return null;
  const base = bare.slice(bare.lastIndexOf("/") + 1);
  return TEST_NAMED.test(base) || TEST_DIRECTORY.test(bare) ? bare : null;
}

function testsFirstValue(body: string): string | null {
  const lines = body.split(/\r\n|\r|\n/);
  for (const [index, line] of lines.entries()) {
    const found = TESTS_FIRST_HEADING.exec(line) ?? TESTS_FIRST_INLINE.exec(line);
    if (!found) continue;
    const inline = (found[1] ?? "").trim();
    if (inline.length > 0) return inline;
    const rest: string[] = [];
    for (const later of lines.slice(index + 1)) {
      if (MARKDOWN_HEADING.test(later)) break;
      rest.push(later);
    }
    return rest.join("\n");
  }
  return null;
}

/**
 * What a row's body says about `Tests-first:`. `marked` is whether it says it at all -- an UNMARKED row (decomposition,
 * investigation, fleet) is exempt by saying nothing -- and `paths` the test files it names, `[]` for a mark that names none.
 */
export function testsFirstOf(body: string): { marked: boolean; paths: string[]; } {
  const value = testsFirstValue(body);
  if (value === null) return { marked: false, paths: [] };
  const paths = value.split(/[\s,;]+/).map(testFilePath).filter((path): path is string => path !== null);
  return { marked: true, paths: [...new Set(paths)] };
}

/** `rows.testsFirst` of a project declaration's TEXT: on only when exactly `true`, so absent, unreadable and mistyped are all OFF. */
export function testsFirstFlagOf(declarationText: string): boolean {
  try {
    return JSON.parse(declarationText)?.rows?.testsFirst === true;
  } catch (cause) {
    void cause; // not JSON is not a declaration that turned the flag on; the declaration reader refuses it where it matters
    return false;
  }
}

/** The flag as this checkout's declaration says it. A checkout with no declaration is a project that never declared it: OFF. */
export function readTestsFirstFlag(checkout: string = HOME_CHECKOUT): boolean {
  try {
    return testsFirstFlagOf(readFileSync(join(checkout, PROJECT_DECLARATION_PATH), "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw cause;
  }
}

/** The rows a PR body closes by its `Closes` line, each with the repository it is in (a bare `#n` is `repo`'s own). */
export function closedRowsOf(prBody: string, repo: string = REPO): { number: number; repo: string; }[] {
  const seen = new Map<string, { number: number; repo: string; }>();
  for (const [, list] of prBody.matchAll(CLOSING_LIST)) {
    for (const [, named, number] of list.matchAll(/([\w.-]+\/[\w.-]+)?#(\d+)/g)) {
      seen.set(`${named ?? repo}#${number}`, { number: Number(number), repo: named ?? repo });
    }
  }
  return [...seen.values()];
}

/**
 * THE VERDICT, PURE: reasons a PR moves the tests its rows name. An approval by a reviewer who read the head silences both, because
 * what a reviewer approves is the change; a first commit that lacks the tests is the other fault and is named first.
 */
export function testsFirstEditReasons(number: number | string, facts: TestsFirstFacts): string[] {
  if (facts.approvedBy.length > 0) return [];
  const absent = facts.paths.filter((path) => !facts.firstCommitFiles.includes(path));
  const moved = facts.paths.filter((path) => !absent.includes(path) && facts.changedSinceFirst.includes(path));
  const way = "A reviewer who agrees posts an approving review whose body carries the line `Tests-first: change approved`.";
  return [
    ...absent.length > 0 ? [`TESTS-FIRST: the FIRST commit of #${number} does not carry ${absent.join(", ")}.\n`
      + "  The row named these tests so the worker starts from them, failing; they land in the first commit, unchanged.\n  " + way] : [],
    ...moved.length > 0 ? [`TESTS-FIRST: #${number} changes ${moved.join(", ")} after its first commit.\n`
      + "  The row's tests are its acceptance, and the worker may not move them.\n  " + way] : [],
  ];
}

/**
 * The facts for PR `number`, or `undefined` when there is nothing to ask (flag off, no closed row names a test) -- never `[]` for
 * that -- or `null` when a read failed, which is INCONCLUSIVE and never "the tests are where they were".
 * `repo` is the PR's own repository; each closed row is read in the repository it is in.
 */
export function lookupTestsFirstFacts(
  pr: { number: number; head: string; author: string | null; body: string | null; },
  { run = gh, enabled = readTestsFirstFlag(), repo = REPO }: { run?: (args: string[]) => string; enabled?: boolean; repo?: string; } = {},
): TestsFirstFacts | null | undefined {
  if (!enabled) return undefined;
  const rows = closedRowsOf(pr.body ?? "", repo);
  if (rows.length === 0) return undefined;
  return lookup(() => testsFirstReadsOf({
    repo, number: pr.number, head: pr.head, author: pr.author, rows,
    pathsOf: (rowBody) => testsFirstOf(rowBody).paths, isApproval: (reviewBody) => TESTS_FIRST_APPROVAL.test(reviewBody),
  }, run));
}

/**
 * THE SUBSET OF `mergeReadiness` THAT NEVER ASKS ABOUT THIS RUN'S OWN SIBLING CHECKS — #298 (unit 1).
 *
 * `mergeReadiness`'s `checkReasons`/`stalenessReason` inspect check-run CONCLUSIONS, which is exactly
 * what makes it unsafe to run as a REQUIRED job inside the very workflow run whose own sibling jobs are
 * still in flight: a job asking "did every required context conclude" about a commit it is itself
 * currently testing reads STILL_RUNNING on every ordinary push, forever, and would block every merge
 * permanently rather than only the unsafe ones. `gate` already answers "did CI pass" by construction
 * (branch protection requires it, and it is `if: always()` over every sibling's `result`) — this answers
 * the one question `strict=false` (#277) left nobody answering that does not depend on whether CI has
 * finished: does this head match what the platform thinks it is (`head-tip-rule.ts`, #294).
 *
 * TWO RULES ARE DELIBERATELY NOT COMPOSED HERE, and both cost a live near-miss to find before they
 * shipped — `dispatcher` drove this function against the real, moving queue and measured both refusing
 * the NORMAL case. See `ancestry-rule.ts` and `claimed-row-rule.ts` for the full account of each; in
 * short, ancestry refuses almost every open PR under `strict=false`'s normal throughput, and the claimed-
 * row rule needs a `session` identity a CI job does not have and would otherwise refuse its own PR's
 * merge as "closing a stranger's row".
 *
 * **What must NOT happen is a required job refusing the normal case** — `dispatcher`'s own words — because
 * the response to an unmergeable-by-default queue is to bypass the gate, and this repository's record on
 * that is `A11Y_SKIP_VERIFY` used six times in one evening.
 *
 * A HOLD IS NOW ENFORCED HERE, AND UNTIL 2026-09-09 IT WAS ENFORCED NOWHERE THAT COULD STOP A MERGE.
 *
 * `pr-hold` disarms auto-merge when it takes a hold, and `armabilityOf` stops anything re-arming — so the
 * hold worked, at ARM time. A hold placed on a PR that was ALREADY ARMED stopped nothing: GitHub's
 * auto-merge consults no label, and `gate` — the only required context — read head-vs-tip and nothing
 * else. Measured: eleven of the twelve PRs one session labelled on 2026-09-09 merged, labelled, armed.
 * #645 called that "a label that stops nothing"; it was the observed behaviour rather than a hypothesis.
 *
 * This is deliberately NOT the two rules below it. Ancestry and the claimed-row rule were both measured
 * refusing the NORMAL case from CI. A hold cannot: the normal case is a PR with no `hold:` label, and the
 * refusal is only ever the state somebody asked for by hand.
 *
 * @param {{pr: {headRefOid: string, number?: number, state?: string}, branchTip: string | null,
 *   prLabels?: string[] | null}} facts
 * @returns {{code: number, reasons: string[]}}
 */
export function mergeSafetyVerdict({ pr, branchTip, prLabels = [], approvals, testsFirst }: {
        pr: { headRefOid: string; number?: number; state?: string; }; branchTip: string | null;
        prLabels?: string[] | null; approvals?: ApprovalFacts | null; testsFirst?: TestsFirstFacts | null;
    }): { code: number; reasons: string[]; } {
  if (branchTip === null) {
    return { code: EXIT.CANNOT_ASK, reasons: [
      `CANNOT SAY whether #${pr.headRefOid.slice(0, 10)} is safe to auto-arm: could not read the branch's `
      + "real tip (`git ls-remote`, #294).\n  This is INCONCLUSIVE, not clear.",
    ] };
  }
  // UNREADABLE REFUSES, AND SAYS SO IN ITS OWN WORDS. "Could not read the labels" and "this PR is held"
  // are different facts needing different actions -- one sends a reader to the API, the other to the
  // holder -- and printing the same sentence for both is how a reader learns to ignore it.
  if (prLabels === null) {
    return { code: EXIT.CANNOT_ASK, reasons: [
      `CANNOT SAY whether #${pr.number ?? "?"} is held: its labels could not be read.\n`
      + "  This is INCONCLUSIVE, not unheld. Nobody looked, and a merge that happens when nothing looked "
      + "is what this tool exists to prevent.",
    ] };
  }
  // ONLY WHILE THE PR IS OPEN, and this is #690's rule reaching one field further. `labeled`/`unlabeled`
  // fire on a CLOSED PR too -- anything that strips a label after a merge re-triggers this workflow --
  // and `gate` is deliberately ungated (`if: always()`), so without this a merged PR that still carries
  // its `hold:` label would go permanently red on its own head. That red blocks nothing, lands in the
  // report of non-success checks on merged heads, and trains people to skip the section: exactly the
  // failure #690 was written to stop, and exactly how one real red sat on seven merged PRs for ninety
  // minutes. A closed PR cannot merge, so refusing it protects nothing.
  const holders = pr.state === "closed"
    ? []
    : holdersOf(prLabels).map((label) => label.slice(HOLD_PREFIX.length));
  if (holders.length > 0) {
    return { code: EXIT.REFUSED, reasons: [
      `#${pr.number ?? "?"} IS HELD by ${holders.join(", ")}, so it must not merge.\n`
      + "  A hold is a decision somebody made by hand; releasing it is `pnpm run pr:release <n> "
      + `--session=<name>\`, which puts auto-merge back.\n  The label is \`${HOLD_PREFIX}<session>\`; a `
      + `\`${SESSION_PREFIX}<name>\` label is OWNERSHIP and is deliberately not read here.`,
    ] };
  }
  // `undefined` is "the caller did not ask" (the pre-#5038 callers); `null` is "asked and could not read",
  // which is INCONCLUSIVE, never "covered".
  if (approvals === null) {
    return { code: EXIT.CANNOT_ASK, reasons: [
      `CANNOT SAY whether an approval covers #${pr.number ?? "?"}'s head: its reviews or commits could not be read.\n`
      + "  This is INCONCLUSIVE, not covered.",
    ] };
  }
  // #5109: the same convention -- `undefined` is "nothing to ask" (flag off, or no closed row names a test), `null` is "asked and could not read".
  if (testsFirst === null) {
    return { code: EXIT.CANNOT_ASK, reasons: [
      `CANNOT SAY whether #${pr.number ?? "?"} leaves its rows' named tests alone: the rows, the first commit or the reviews could not be read.\n`
      + "  This is INCONCLUSIVE, not clear.",
    ] };
  }
  const reasons = [...headTipMismatchReason(pr, branchTip),
    ...(approvals === undefined || pr.state === "closed" ? [] : approvalHeadReasons(pr.headRefOid, approvals)),
    ...(testsFirst === undefined || pr.state === "closed" ? [] : testsFirstEditReasons(pr.number ?? "?", testsFirst))];
  return { code: reasons.length > 0 ? EXIT.REFUSED : EXIT.READY, reasons };
}

/**
 * THE VERDICT, PURE — composes all eight rules so every state can be exercised without a network,
 * including the one no fixture gives you for free (a real run against a base that has since moved).
 *
 * Each input is a FACT somebody looked up; `null` means the lookup failed and is never treated as an
 * empty answer. `[]` and `null` are the difference between "nothing ran" and "I could not ask", and this
 * whole tool exists because two states that need opposite responses were being reported as one.
 *
 * @param {{pr: {number: number, state: string, baseRefName: string, headRefOid: string},
 *          required: string[] | null,
 *          runs: {name: string, status: string, conclusion: string | null, completedAt: string | null}[] | null,
 *          mainTipIso: string | null,
 *          behindBy: number | null,
 *          branchTip: string | null,
 *          closes?: {number: number, title?: string, labels: string[]}[] | null,
 *          prLabels?: string[] | null,
 *          session?: string | null}} facts
 * @returns {{code: number, reasons: string[], notes: string[]}}
 */
export function mergeReadiness({ pr, required, runs, mainTipIso, behindBy, branchTip, closes = [],
  prLabels = [],
  session = null, approvals = undefined, testsFirst = undefined }: {
        pr: { number: number; state: string; baseRefName: string; headRefOid: string; };
        required: string[] | null;
        runs: { name: string; status: string; conclusion: string | null; completedAt: string | null; }[] | null;
        mainTipIso: string | null;
        behindBy: number | null;
        branchTip: string | null;
        closes?: { number: number; title?: string; labels: string[]; }[] | null;
        prLabels?: string[] | null;
        session?: string | null;
        approvals?: ApprovalFacts | null;
        testsFirst?: TestsFirstFacts | null;
    }): { code: number; reasons: string[]; notes: string[]; } {
  const missingLookups = [
    required === null && "the required status checks for `main` (branch protection)",
    runs === null && `the check runs for head ${pr.headRefOid.slice(0, 10)}`,
    mainTipIso === null && "the current tip of `main`",
    behindBy === null && "whether this head contains `main`'s tip (the compare API)",
    // A FAILED tip lookup is CANNOT_ASK, never READY -- `null` and "equal to headRefOid" are different
    // answers, the same distinction every other lookup here already draws (#294).
    branchTip === null && "the branch's real tip (`git ls-remote`)",
    closes === null && "which rows this PR would close (the closingIssuesReferences lookup)",
    prLabels === null && "this PR's own labels (which say whether somebody is holding it)",
    approvals === null && "this PR's reviews and the commits since each approval (#5038)",
    testsFirst === null && "the tests its rows name, its first commit and its reviews (#5109)",
  ].filter(Boolean);
  if (missingLookups.length > 0) {
    return { code: EXIT.CANNOT_ASK, notes: [], reasons: [
      `CANNOT SAY whether #${pr.number} is tested: could not read ${missingLookups.join("; ")}.\n`
      + "  This is INCONCLUSIVE, not clear. Re-run with a network and a `gh` credential.",
    ] };
  }

  const notes = pr.state === "OPEN" ? []
    : [`note: #${pr.number} is ${pr.state}, so this is a post-mortem rather than a merge decision.`];
  // Already proven non-null by `missingLookups` above -- TS's narrowing does not follow a null check
  // performed inside an array-literal expression, so the casts restate what the guard clause established.
  const knownRequired = (required as string[]);
  const knownRuns = (runs as {name: string, status: string, conclusion: string | null, completedAt: string | null}[]);
  const knownMainTipIso = (mainTipIso as string);
  const knownBranchTip = (branchTip as string);
  const knownCloses = (closes as {number: number, title?: string, labels: string[]}[]);
  const knownPrLabels = (prLabels as string[]);
  const reasons = [...baseReason(pr), ...headTipMismatchReason(pr, knownBranchTip),
    ...checkReasons(pr, knownRequired, knownRuns),
    ...ancestryReason(behindBy), ...stalenessReason(knownRuns, knownMainTipIso),
    ...closingClaimReasons(knownCloses, session), ...prHoldReasons(pr, knownPrLabels, session),
    ...(approvals ? approvalHeadReasons(pr.headRefOid, approvals) : []),
    ...(testsFirst ? testsFirstEditReasons(pr.number, testsFirst) : [])];
  return { code: reasons.length > 0 ? EXIT.REFUSED : EXIT.READY, reasons, notes };
}

/**
 * `mergeSafetyVerdict`'s inputs, none of which ask about this run's own sibling check-runs -- see that
 * function's own comment for why that omission is deliberate rather than an oversight. Cheaper than
 * `facts()` too: no required-contexts or check-runs lookup at all.
 * @param {number} number
 */
/**
 * REST, NOT `gh pr view`, AND THAT IS A PROPERTY OF THE REQUIRED GATE RATHER THAN A PREFERENCE.
 *
 * `gh pr view` spends GRAPHQL. On 2026-09-09 the shared GraphQL pool reached 5000 of 5000 at 14:41Z and
 * every `gh pr list`/`view`/`checks` in every session failed for twenty-two minutes. `gate` is the ONLY
 * required context on this repository, so a GraphQL outage would make the one check that must answer
 * unable to answer -- and an unanswerable required check is a queue that stops. `gh api repos/.../pulls/N`
 * is core, a separate pool, and returns the labels on the same payload, so the hold read below costs
 * nothing extra.
 *
 * `prLabels` is `null` when the read failed, NEVER `[]`. The two need opposite responses: an empty list
 * means nobody holds this PR and it may proceed; a failed lookup means nobody LOOKED, and this whole tool
 * exists because a merge happened when nothing looked (#294's "Unreadable is not unheld").
 *
 * @param {number} number
 */
function ciGateFacts(number: number) {
  const raw = JSON.parse(gh(["api", `repos/${REPO}/pulls/${number}`]));
  const pr = {
    number: raw.number,
    state: raw.state,
    baseRefName: raw.base?.ref,
    headRefOid: raw.head?.sha,
    headRefName: raw.head?.ref,
  };
  const names = Array.isArray(raw.labels)
    ? raw.labels.map((l: { name?: unknown; }) => l?.name)
    : null;
  const prLabels = names && names.every((n: unknown) => typeof n === "string")
    ? (names as string[])
    : null;
  const branchTip = lookupBranchTip(pr.headRefName);
  const approvals = lookupApprovalFacts(pr.number, pr.headRefOid);
  // #5109: a CLOSED PR cannot merge, so it asks nothing; the rows come from the PR's own body because this gate is REST-only.
  const testsFirst = raw.state === "open"
    ? lookupTestsFirstFacts({ number: pr.number, head: pr.headRefOid, author: raw.user?.login ?? null, body: raw.body ?? "" })
    : undefined;
  return { pr, branchTip, prLabels, approvals, testsFirst };
}

/**
 * `--ci-gate <n>`: the check a required CI job runs FOR ITSELF, mid-workflow -- #298 (unit 1). Checks
 * head-vs-tip (#294) ONLY -- see `mergeSafetyVerdict`'s own comment for why ancestry (#182) and
 * closing-claim (#262) are deliberately not asked here: both refuse the NORMAL case when CI asks them,
 * measured live on this PR's own queue.
 * @param {number} number
 */
function ciGateCommand(number: number) {
  const verdict = mergeSafetyVerdict(ciGateFacts(number));
  if (verdict.code === EXIT.READY) {
    console.log(`#${number} is safe to auto-arm: this head matches what GitHub recorded (#294).`);
  } else {
    console.error(`REFUSING to auto-arm #${number}:\n${verdict.reasons.map((r) => `- ${r}`).join("\n")}`);
  }
  process.exit(verdict.code);
}

/** @param {number} number */
function facts(number: number) {
  // DELIBERATELY NOT REQUESTING `mergeStateStatus`. Asking for it at all would invite the next reader to
  // use it, and this tool's entire reason for existing is that its answer cannot be trusted here.
  const pr = JSON.parse(gh(["pr", "view", String(number), "--repo", REPO,
    "--json", "number,state,baseRefName,headRefOid,headRefName,labels,body,author"]));
  // `null` WHEN THE SHAPE IS NOT THE ONE EXPECTED, never `[]` -- an empty array reads as "nobody holds
  // this PR", which is the safest-LOOKING answer and the wrong one when the truth is "I could not ask".
  // Same rule as every other lookup here, and the reason this file exists.
  const prLabels = Array.isArray(pr.labels)
    ? pr.labels.map((l: { name?: unknown; }) => l?.name).filter(
      (name: unknown) => typeof name === "string")
    : null;
  const required = lookupRequiredContexts();
  const runs = lookupCheckRuns(pr.headRefOid);
  const mainTipIso = lookup(() => gh(["api", `repos/${REPO}/commits/main`,
    "--jq", ".commit.committer.date"]).trim() || null);
  // `behind_by` is how many commits `main` has that this head does not -- the ancestry fact, not a
  // mergeability opinion. `lookup` keeps a failed call NULL so it lands as INCONCLUSIVE rather than 0,
  // which would read as "contains main's tip" and reintroduce the false pass this replaced.
  const behindBy = lookup(() => {
    const value = JSON.parse(gh(["api",
      `repos/${REPO}/compare/main...${pr.headRefOid}`])).behind_by;
    return typeof value === "number" ? value : null;
  });
  const branchTip = lookupBranchTip(pr.headRefName);
  const closes = lookupClosingIssues(number);
  const approvals = lookupApprovalFacts(number, pr.headRefOid);
  const testsFirst = lookupTestsFirstFacts({ number, head: pr.headRefOid, author: pr.author?.login ?? null, body: pr.body ?? "" });
  return { pr, required, runs, mainTipIso, behindBy, branchTip, closes, prLabels, approvals, testsFirst };
}

/**
 * `--reconcile <n>`: compare the LAST recorded verdict for #n against its real, terminal outcome (#188).
 * @param {number} number
 */
function reconcileCommand(number: number) {
  const recordedVerdict = latestVerdictFor(verdictLogPath(), number);
  const pr = JSON.parse(gh(["pr", "view", String(number), "--repo", REPO,
    "--json", "state,mergedAt,closedAt"]));
  const realOutcome = realOutcomeFor(pr.state);
  const resolvedAt = pr.mergedAt ?? pr.closedAt ?? null;
  const result = reconcile({ prNumber: number, recordedVerdict, realOutcome, resolvedAt });
  // NARROWED ON `record`, NEVER ON `code` -- `code` is typed as plain `number` in both branches of
  // `reconcile`'s return union, so comparing it to `EXIT.READY` (also a plain number) cannot narrow
  // which branch this is. `record` is the actual discriminant: null in one branch, an object in the
  // other. Checking the wrong field type-checked as fine before #234 added `@ts-check` to this file.
  if (result.record === null) {
    console.error(`CANNOT RECONCILE #${number}: ${result.reason}`);
    process.exit(result.code);
  }
  appendJsonl(agreementLogPath(), result.record);
  console.log(`#${number}: guard said ${result.record.guardVerdict} `
    + `(${result.record.guardReasonKinds.join(", ") || "no reasons"}), the platform's real outcome was `
    + `${result.record.realOutcome} — ${result.record.agreement}.`);
  process.exit(EXIT.READY);
}

/**
 * `--armed-check=<branch>`: is THIS branch's own open PR armed with auto-merge AND already green?
 * #386's pre-push wiring calls this on the pushing branch itself -- never a PR number, since the hook
 * only ever knows its own branch, not whether a PR exists for it yet.
 * @param {string} branch
 */
function armedCheckCommand(branch: string) {
  const status = lookupArmedPrStatus(branch);
  if (racesAnArmedMerge(status)) {
    // `status` is non-null here (racesAnArmedMerge(null) is false), so `.number` is safe.
    console.error(`REFUSING: #${(status as {number: number}).number} is armed and its gate `
      + "is already green -- pushing now risks racing a merge that can complete before this push "
      + "finishes (#386), stranding the commit on a branch nothing can find afterward. Wait a moment "
      + "and push again once the merge has landed, or if this is deliberate:\n"
      + '  A11Y_ALLOW_ARMED_PUSH="<why>" git push ...');
    process.exit(EXIT.REFUSED);
  }
  if (status === null) {
    console.log("could not ask GitHub about this branch's PR -- allowing (a race guard fails open).");
  }
  process.exit(EXIT.READY);
}

/**
 * `--allow-claimed-close=<name>`'s value, refusing (never silently) a bare boolean -- #249's follow-up,
 * 2026-09-07: it must be a CHECKABLE claim naming who was confirmed with, not an honor system.
 *
 * KEPT HERE, not in `claimed-row-rule.ts`, deliberately -- #455: this is the one place in that rule's
 * whole surface that touches `process.argv` directly, and this file already reads argv and already calls
 * `refuseUnknownFlags` for the entire command. Moving it into the rule module would make that module a
 * second, untracked CLI entry point -- `cli-flags.test.ts`'s argv-reading census discovers exactly this
 * shape and failed on it the first time this was tried, correctly.
 * @returns {string | null}
 */
function readAllowClaimedClose(): string | null {
  if (process.argv.includes("--allow-claimed-close") && flagValue(process.argv, "allow-claimed-close") === undefined) {
    console.error("--allow-claimed-close requires a value naming who you confirmed with:\n"
      + "  --allow-claimed-close=<session>\n"
      + "A bare boolean was refused on purpose: it must be a CHECKABLE claim, not an honor system.");
    process.exit(EXIT.CANNOT_ASK);
  }
  return flagValue(process.argv, "allow-claimed-close") ?? null;
}

function main() {
  refuseUnknownFlags(["--reconcile", "--session", "--allow-claimed-close", "--ci-gate", "--armed-check"],
    { entry: import.meta.url, command: "node packages/agent-org/src/merge-guard.ts" });

  if (flagValue(process.argv, "armed-check") !== undefined) {
    armedCheckCommand((flagValue(process.argv, "armed-check") as string));
    return;
  }

  const number = process.argv.slice(2).find((arg) => /^\d+$/.test(arg));
  if (!number) {
    console.error("Usage: node packages/agent-org/src/merge-guard.ts <pr-number> [--session=<name>] [--allow-claimed-close=<name>]\n"
      + "       node packages/agent-org/src/merge-guard.ts --reconcile <pr-number>\n"
      + "       node packages/agent-org/src/merge-guard.ts --ci-gate <pr-number>\n"
      + "       node packages/agent-org/src/merge-guard.ts --armed-check=<branch>\n"
      + "Answers whether that PR has actually been tested, by reading its check RUNS rather than\n"
      + "`mergeStateStatus` -- which reports CLEAN for a PR that has never run a check. `--reconcile`\n"
      + "compares the last recorded verdict against the PR's real, terminal outcome (#188). `--ci-gate` is\n"
      + "the narrower, self-reference-safe check a required CI job runs against its own commit (#298).\n"
      + "`--armed-check` asks whether pushing to this branch right now would race an already-green,\n"
      + "already-armed merge (#386).");
    process.exit(EXIT.CANNOT_ASK);
  }

  if (process.argv.includes("--reconcile")) {
    reconcileCommand(Number(number));
    return;
  }

  if (process.argv.includes("--ci-gate")) {
    ciGateCommand(Number(number));
    return;
  }

  const session = flagValue(process.argv, "session") ?? null;
  const allowClaimedClose = readAllowClaimedClose();

  const factsResult = facts(Number(number));
  const verdict = mergeReadiness({ ...factsResult, session });
  recordVerdict(verdictLogPath(), Number(number), verdict);
  for (const note of verdict.notes) console.error(note);

  const { overridden, remaining } = applyAllowClaimedClose(verdict, factsResult.closes ?? [], allowClaimedClose);
  for (const reason of overridden) {
    console.error(`OVERRIDDEN by --allow-claimed-close=${allowClaimedClose}: ${reason}`);
  }
  const code = verdict.code === EXIT.CANNOT_ASK ? EXIT.CANNOT_ASK
    : (remaining.length > 0 ? EXIT.REFUSED : EXIT.READY);

  if (code === EXIT.READY) {
    console.log(`#${number} is tested: based on main, every required context present and concluded, and `
      + "this head CONTAINS main's tip -- so what ran, ran against the code it is about to join.");
  } else if (code === EXIT.REFUSED) {
    console.error(`REFUSING #${number}:\n${remaining.map((r) => `- ${r}`).join("\n")}`);
  }
  process.exit(code);
}

if (import.meta.url === pathToFileURL(process.argv[1] ? realpathSync(process.argv[1]) : "").href) main();
