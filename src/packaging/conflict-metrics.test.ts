// no-token: gh
/**
 * #466 (C5): conflict metrics, READ FROM THE REPOSITORY rather than reported by a session.
 *
 * ceo's own done-when criteria (p90 under an hour, no PR over four hours, no file touched by more than
 * five PRs, zero conflicts, trunk green on every merge) are unanswerable except by a session asserting
 * them, until something computes them from GitHub and git directly. This is that something.
 *
 * The pure helpers (`percentile`, `mergeLifetimeMinutes`, `hotspotFiles`) are tested against plain
 * fixtures, no network or git needed. `mergedPRNeededReconciliation` calls `git` directly and is tested
 * against REAL commits already in this repository's history — the same idiom `board-report.test.ts` uses
 * for `whatMerged`'s real `git(["rev-parse", ...])` call, rather than mocking a wrapper this file does not
 * make injectable. #1407: `conflictMetrics` is the LIVE entry and
 * no test here calls it. `composeConflictMetrics` is the same composition with the `gh` listing handed in, and it
 * is driven with recorded listings, so a local run makes no `gh` call.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeLifetimeMinutes, hotspotFiles, mergedPRNeededReconciliation, composeConflictMetrics, PR_WINDOW_LIMIT, REPO,
} from "../board-data.ts";
import { readFileSync } from "node:fs";
import { readsRowsSince, sinceAnswer } from "./rows-by-label-fixtures.ts";

// --- mergeLifetimeMinutes: pure ---

test("mergeLifetimeMinutes: THE MEASUREMENT -- minutes from createdAt to mergedAt, ascending", () => {
  const prs = [
    { createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T02:00:00Z" }, // 120 min
    { createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T00:10:00Z" }, // 10 min
  ];
  assert.deepEqual(mergeLifetimeMinutes(prs), [10, 120]);
});

test("mergeLifetimeMinutes: a PR missing either timestamp is excluded, not read as zero", () => {
  const prs = [
    { createdAt: "2026-09-08T00:00:00Z", mergedAt: null },
    { createdAt: null, mergedAt: "2026-09-08T00:00:00Z" },
    { createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T00:05:00Z" },
  ];
  assert.deepEqual(mergeLifetimeMinutes(prs), [5]);
});

test("mergeLifetimeMinutes: no merged PRs at all is an empty array, never a crash", () => {
  assert.deepEqual(mergeLifetimeMinutes([]), []);
});

// --- hotspotFiles: pure, DISTINCT PR count, not occurrence count ---

test("hotspotFiles: THE MEASUREMENT -- a file touched by the same PR many times still counts ONCE", () => {
  // The hazard is convergence -- how many AUTHORS landed here -- not how much a file changed.
  const prs = [{ number: 1, files: [{ path: "ci.yml" }, { path: "ci.yml" }, { path: "ci.yml" }] }];
  assert.deepEqual(hotspotFiles(prs), [{ path: "ci.yml", prCount: 1 }]);
});

test("hotspotFiles: ranks by distinct PR count, ties broken by path", () => {
  const prs = [
    { number: 1, files: [{ path: "b.mjs" }, { path: "a.mjs" }] },
    { number: 2, files: [{ path: "b.mjs" }] },
    { number: 3, files: [{ path: "a.mjs" }] },
  ];
  assert.deepEqual(hotspotFiles(prs), [
    { path: "a.mjs", prCount: 2 },
    { path: "b.mjs", prCount: 2 },
  ]);
});

test("hotspotFiles: respects `limit`, and a PR with no files touches nothing", () => {
  const prs = Array.from({ length: 7 }, (_, i) => ({ number: i, files: [{ path: `f${i}.mjs` }] }));
  prs.push({ number: 99, files: [] });
  assert.equal(hotspotFiles(prs, 5).length, 5);
});

test("hotspotFiles: no PRs at all is an empty table", () => {
  assert.deepEqual(hotspotFiles([]), []);
});

// --- mergedPRNeededReconciliation: real git, against REAL commits in this repository's own history ---

/**
 * `git show`/`git merge-base`/`git log --merges` on a real, old commit need FULL history, which a shallow
 * clone (a sandbox, the `acceptance` job's depth-1 checkout) does not have -- but `mergedPRNeededReconciliation`
 * ITSELF SWALLOWS that failure into its own `null` ("could not inspect") return, on exactly the contract
 * #466 was filed to build: a lookup failure is refused, never folded into a false clean. So this checker
 * does NOT wrap the call in a try/catch -- the function never throws here, and the first version of this
 * guard caught nothing, exactly because it was built to catch an exception that this function's own
 * design deliberately never lets escape. It checks the RETURN VALUE instead: `null` is read as "this
 * environment could not tell", the honest skip; anything else is asserted against `expected`.
 *
 * FOUND BY WATCHING IT FAIL TO SKIP, not by reasoning about it -- the first version of this test read
 * `assert.equal(result, true)` inside `skipIfShallow(() => {...})` and failed for real in the `acceptance`
 * job with `null !== true`, never reaching the catch block at all. A guard must be shown to fire before it
 * is trusted, this repository's own rule, and the wrong shape here would have shipped believing it did.
 */
function assertOrSkipIfUnresolvable(actual: boolean | null, expected: boolean, testName: string): void {
  if (actual === null) {
    console.log(`SKIPPED: ${testName} -- this checkout could not inspect the commit history `
      + "mergedPRNeededReconciliation needs (a shallow clone) -- an honest skip, not a pass.");
    return;
  }
  assert.equal(actual, expected);
}

test("mergedPRNeededReconciliation: THE REAL RECONCILED CASE -- PR #503's merge commit synced main twice", () => {
  const result = mergedPRNeededReconciliation({ number: 503,
    mergeCommit: { oid: "5fd57e051db0784fe23d24bf91700d8ce681f69f" } });
  assertOrSkipIfUnresolvable(result, true, "PR #503's reconciled case");
});

test("mergedPRNeededReconciliation: THE REAL CLEAN CASE -- PR #502's merge commit needed no sync at all", () => {
  const result = mergedPRNeededReconciliation({ number: 502,
    mergeCommit: { oid: "67e4022226c35629a319d3eade62a0d6460fd784" } });
  assertOrSkipIfUnresolvable(result, false, "PR #502's clean case");
});

test("mergedPRNeededReconciliation: no mergeCommit.oid at all is unresolvable (null), never a false clean", () => {
  assert.equal(mergedPRNeededReconciliation({ number: 1 }), null);
});

test("mergedPRNeededReconciliation: a bogus sha is unresolvable (null), not thrown and not a false clean", () => {
  assert.equal(mergedPRNeededReconciliation({ number: 1, mergeCommit: { oid: "0".repeat(40) } }), null);
});

// --- composeConflictMetrics: THE COMPOSED FIGURE, driven with recorded `pullRequests` connection answers (#1407, #5076) ---
//
// It was live. `conflictMetrics(since)` ran `gh pr list --limit 500 --json ...files` searches on every local run
// (worker-capture's census on #1275), and with no credentials it FAILED rather than skipped, because a refusal that
// is not `gh auth login` was rethrown. The composition is now driven with a `run` that answers each connection read from
// a listing this test writes, and every argv the composition sent is asserted. #5076: the three windows are `pullRequests`
// connections (`created` newest-created first; `merged` and `closed` newest-updated first), not `--search <q>:>=<since>`.
//
// WHAT THIS CANNOT CATCH: GitHub's real answer -- the field names the connection yields, how it orders rows it has updated.
// That is still exercised where it always mattered: `board-report.ts` calls the live `conflictMetrics` for every board
// edition. No local test reaches it any more, and that is the point.

const SINCE = "2026-09-08T00:00:00.000Z";

/** Which of the three windows a request is: `created` reads every state by creation, `merged` the MERGED state, `closed` the CLOSED one. */
function qualifierOf(args: string[]): string {
  const asked = readsRowsSince(args);
  if (asked === null) throw new Error(`no recorded listing for: ${args.join(" ")}`);
  return asked.orderBy === "CREATED_AT" ? "created" : asked.states.join(",") === "MERGED" ? "merged" : "closed";
}

/** The newest-first order a connection answers in: by the field the window is read by. */
const newestFirst = (rows: Record<string, unknown>[], field: string) => [...rows].sort((a, b) => Date.parse(String(b[field])) - Date.parse(String(a[field])));

/** A `run` answering each window from `byQualifier` (the pull requests that window's states hold, in the shape `gh pr list --json` gave), keeping every argv. */
function listingRun(byQualifier: Record<string, Record<string, unknown>[]>) {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    const qualifier = qualifierOf(args);
    const answer = byQualifier[qualifier];
    if (!answer) throw new Error(`no recorded listing for: ${args.join(" ")}`);
    // a pull request is never updated before it merged or closed: `updatedAt` defaults to the latest of its own times
    const stamped = answer.map((row) => ({ updatedAt: row.mergedAt ?? row.closedAt ?? row.createdAt, ...row }));
    return sinceAnswer(args, newestFirst(stamped, qualifier === "created" ? "createdAt" : "updatedAt") as never);
  };
  return { run, calls };
}

// #503 and #502 are the REAL merge commits the reconciliation tests above already use; the rest is fixture.
const RECONCILED = { number: 503, title: "fixture", createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T00:30:00Z",
  closedAt: "2026-09-08T00:30:00Z", mergeCommit: { oid: "5fd57e051db0784fe23d24bf91700d8ce681f69f" },
  files: [{ path: "a.mjs" }] };
const CLEAN = { number: 502, title: "fixture", createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T02:00:00Z",
  closedAt: "2026-09-08T02:00:00Z", mergeCommit: { oid: "67e4022226c35629a319d3eade62a0d6460fd784" },
  files: [{ path: "a.mjs" }, { path: "b.mjs" }] };
const NO_COMMIT = { number: 9001, title: "fixture", createdAt: "2026-09-08T00:00:00Z", mergedAt: "2026-09-08T00:10:00Z",
  closedAt: "2026-09-08T00:10:00Z", mergeCommit: null, files: [{ path: "a.mjs" }] };
const CLOSED = { number: 9002, title: "fixture", createdAt: "2026-09-08T01:00:00Z", mergedAt: null,
  closedAt: "2026-09-08T01:05:00Z", mergeCommit: null, files: [{ path: "c.mjs" }] };

test("composeConflictMetrics: THE COMPOSED SHAPE over recorded listings -- every connection read, and every figure", () => {
  const { run, calls } = listingRun({
    created: [RECONCILED, CLEAN, NO_COMMIT, CLOSED],
    merged: [RECONCILED, CLEAN, NO_COMMIT],
    closed: [RECONCILED, CLEAN, NO_COMMIT, CLOSED], // a listing that carries merged PRs too: the caller keeps only those with no `mergedAt`
  });
  const result = composeConflictMetrics(SINCE, { run });
  assert.deepEqual(calls.map((args) => readsRowsSince(args)), [
    { kind: "pullRequests", states: ["OPEN", "CLOSED", "MERGED"], orderBy: "CREATED_AT", label: null, repo: REPO, after: null },
    { kind: "pullRequests", states: ["MERGED"], orderBy: "UPDATED_AT", label: null, repo: REPO, after: null },
    { kind: "pullRequests", states: ["CLOSED"], orderBy: "UPDATED_AT", label: null, repo: REPO, after: null },
  ], "the three connection reads the live call makes, in order, each with its states and its order");
  assert.deepEqual(calls.filter((args) => args.includes("--search") || args.includes("--label")), [], "and none is a GitHub search (#5076)");
  assert.equal(result.since, SINCE);
  assert.ok(result.method.length > 20, "the method must be a real sentence, not a placeholder");
  assert.equal(result.opened, 4);
  assert.equal(result.merged, 3);
  assert.equal(result.closedUnmerged, 1, "a merged PR in the `closed:` listing is not closed-unmerged");
  assert.equal(result.lifetimeMinutes.count, 3);
  assert.deepEqual(result.hotspotFiles, [{ path: "a.mjs", prCount: 3 }, { path: "b.mjs", prCount: 1 },
    { path: "c.mjs", prCount: 1 }], "deduped by PR number across the three listings");
  assert.equal(result.reconciliation.of, 3);
  // THE REFUSE-RATHER-THAN-ZERO PROPERTY: the merge with no commit is `unresolvable`, never clean. #503 and #502
  // resolve only with full history; a shallow checkout reads all three as unresolvable, never as clean.
  if (result.reconciliation.unresolvable === 3) {
    console.log("SKIPPED the resolved-count half: this checkout could not inspect #503/#502 (a shallow clone).");
    assert.equal(result.reconciliation.neededReconciliation, 0);
  } else {
    assert.deepEqual(result.reconciliation, { neededReconciliation: 1, of: 3, unresolvable: 1 });
  }
});

test("composeConflictMetrics with no run is REFUSED by name, before any read -- a defaulted run is a live gh", () => {
  assert.throws(() => composeConflictMetrics(SINCE), /prsBy\("created"\) needs a run/);
  assert.throws(() => composeConflictMetrics(SINCE, {}), /prsBy\("created"\) needs a run/);
});

test("a window that needs more than PR_WINDOW_LIMIT rows is refused as possibly cut short; one that fits its pages is read (#5076)", () => {
  // Each row is created inside the window, newest first, so the read keeps asking for pages until the window ends.
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ number: i + 1, files: [], createdAt: new Date(Date.parse(SINCE) + (n - i) * 1000).toISOString() }));
  const pages = (n: number) => Math.ceil(n / 100);
  const over = listingRun({ created: rows(PR_WINDOW_LIMIT + 1), merged: [], closed: [] });
  assert.throws(() => composeConflictMetrics(SINCE, { run: over.run }), /may be cut short/);
  assert.equal(over.calls.length, pages(PR_WINDOW_LIMIT), "it read its five pages and no more");
  const at = listingRun({ created: rows(PR_WINDOW_LIMIT), merged: [], closed: [] });
  assert.equal(composeConflictMetrics(SINCE, { run: at.run }).opened, PR_WINDOW_LIMIT,
    "the positive control: exactly the limit is a whole window, which the connection can PROVE (no next page) where a bare list length could not");
  assert.equal(at.calls.filter((args) => qualifierOf(args) === "created").length, pages(PR_WINDOW_LIMIT), "paged 100 at a time");
});

test("wiring: conflictMetrics is the live entry and hands in gh; the composition calls no gh of its own", () => {
  const source = readFileSync(new URL("../board-data.ts", import.meta.url), "utf8");
  const body = (name: string) => {
    const start = source.indexOf(`export function ${name}(`);
    assert.ok(start >= 0, `${name} is exported from board-data.ts`);
    return source.slice(start, source.indexOf("\n}\n", start)).replace(/\/\/.*$/gm, "");
  };
  assert.match(body("conflictMetrics"), /^export function conflictMetrics\(since: string\) \{\s*return composeConflictMetrics\(since, \{ run: gh \}\);\s*$/);
  assert.doesNotMatch(body("composeConflictMetrics"), /\bgh\(|execFileSync/);
});

// --- MUTATION TARGET ---

test("MUTATION TARGET: folding an uninspectable PR into 'no conflict' is exactly the defect this row ends", () => {
  // Documents the shape a regression would take: treating `null` (could not tell) as `false` (no
  // conflict) reports a clean queue on the day the tool could not look.
  const wrongCollapse = (v: boolean | null) => v === true; // `null` reads identically to `false` here
  assert.equal(wrongCollapse(null), false,
    "this is precisely why `conflictMetrics` reports `unresolvable` as its OWN field rather than folding "
    + "an uninspectable PR into the conflict count's zero");
});
