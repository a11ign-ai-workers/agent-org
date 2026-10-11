// no-token: gh -- pure: `pipelineCodeownerReviewMissing` over in-memory pull requests and `comparablePrFiles`'s output; nothing reaches `gh`, `git` or the network
/**
 * #796: WHICH REVIEW COUNTS AS THE CODE OWNER'S, NOW THAT A MANAGER REVIEWS AS THE MANAGERS APP.
 *
 * `ceo`'s ruling on the row: a review is the owner's when its author is `a11ign-ai-leads`, or is the managers App AND its body's last
 * `<!-- decided-by: ceo run: ... -->` marker names `ceo`. The App is shared by every manager, so its login alone never clears the cause, and
 * authorship is not extended. Kept apart from `packaging/work-gate.test.ts`, whose imports reach `host-units.ts` and so need `history`: this file
 * is one an acceptance job without a token or a checkout's history can run.
 *
 * POSITIVE CONTROL for every "is still named" assertion: the same fixture with ONE thing changed (the marker's role, the login, the head) clears it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { comparablePrFiles, pipelineCodeownerReviewMissing } from "./work-gate.ts";

const pipelinePr = (n: number, files: string[], extra: Record<string, unknown> = {}) =>
  ({ number: n, files: files.map((path) => ({ path })), changedFiles: files.length,
    author: { login: "a11ign-ai-workers" }, reviews: [], ...extra });

const PIPELINE_FILE = [".github/workflows/release.yml"];
const appReview = (login: string, role: string | null, extra: Record<string, unknown> = {}) =>
  ({ state: "APPROVED", author: { login },
    body: role === null ? "Approved." : `Approved.\n\n<!-- decided-by: ${role} run: 3e5f0f10-4a0e-4b86-9c1d-7f6d2c5b1a11 -->`, ...extra });
const missing = (pr: any) => pipelineCodeownerReviewMissing([pr], comparablePrFiles([pr])).map((m) => m.number);

test("#796 (a): the managers App's approval marked `decided-by: ceo` clears the cause, in each spelling of its login", () => {
  for (const login of ["a11ign-managers[bot]", "a11ign-managers", "app/a11ign-managers"]) {
    const pr = pipelinePr(30, PIPELINE_FILE, { reviews: [appReview(login, "ceo")] });
    assert.deepEqual(missing(pr), [], login);
  }
});

test("#796 (b) POSITIVE CONTROLS: the same App review marked `product-manager`, `orchestrator`, another role or nothing does NOT clear it", () => {
  assert.deepEqual(missing(pipelinePr(31, PIPELINE_FILE, { reviews: [appReview("a11ign-managers[bot]", "ceo")] })), [], "the control: ceo's clears");
  for (const role of ["product-manager", "orchestrator", "cEo", "ceo-2", null]) {
    const pr = pipelinePr(31, PIPELINE_FILE, { reviews: [appReview("a11ign-managers[bot]", role)] });
    assert.deepEqual(missing(pr), [31], String(role));
  }
});

test("#796 (c): the marker only speaks for the App's login -- `decided-by: ceo` on anyone else's review does not clear it", () => {
  for (const login of ["a11ign-ai-workers", "a11ign-workers[bot]", "a11ign-reviewer[bot]"]) {
    const pr = pipelinePr(32, PIPELINE_FILE, { reviews: [appReview(login, "ceo")] });
    assert.deepEqual(missing(pr), [32], login);
  }
});

test("#796 (d): the LAST marker names the seat -- a quoted `decided-by: ceo` earlier in a product-manager's body does not clear it", () => {
  const body = "> <!-- decided-by: ceo run: 1 -->\nApproved.\n\n<!-- decided-by: product-manager run: 2 -->";
  const pr = pipelinePr(33, PIPELINE_FILE, { reviews: [{ ...appReview("a11ign-managers[bot]", "ceo"), body }] });
  assert.deepEqual(missing(pr), [33]);
});

test("#796 (e): the App's review at an OLDER head does not clear it, and one at the current head does (the head rule is unchanged)", () => {
  const stale = pipelinePr(34, PIPELINE_FILE, { headRefOid: "bbbb", reviews: [appReview("a11ign-managers[bot]", "ceo", { commit: { oid: "aaaa" } })] });
  assert.deepEqual(missing(stale), [34]);
  const current = pipelinePr(34, PIPELINE_FILE, { headRefOid: "bbbb", reviews: [appReview("a11ign-managers[bot]", "ceo", { commit: { oid: "bbbb" } })] });
  assert.deepEqual(missing(current), []);
  const refusal = pipelinePr(34, PIPELINE_FILE, { headRefOid: "bbbb",
    reviews: [appReview("a11ign-managers[bot]", "ceo", { state: "CHANGES_REQUESTED", commit: { oid: "bbbb" } })] });
  assert.deepEqual(missing(refusal), [], "a refusal at the current head settles it, as the user account's does");
  const comment = pipelinePr(34, PIPELINE_FILE, { reviews: [appReview("a11ign-managers[bot]", "ceo", { state: "COMMENTED" })] });
  assert.deepEqual(missing(comment), [34], "a comment is not a review");
});

test("#796 (f): AUTHORSHIP IS NOT EXTENDED -- a PR the managers App authored is not the owner's own, so the cause fires on it", () => {
  // `ceo`'s ruling item 2: the App authors for every manager. GitHub will not take the App's approval of its OWN pull request, so no review the
  // App gives settles this one; only `a11ign-ai-leads`'s review does (the second assertion), and a human review is what that account needs.
  for (const login of ["a11ign-managers[bot]", "a11ign-managers", "app/a11ign-managers"]) {
    assert.deepEqual(missing(pipelinePr(35, PIPELINE_FILE, { author: { login } })), [35], login);
  }
  const settled = pipelinePr(35, PIPELINE_FILE, { author: { login: "app/a11ign-managers" },
    reviews: [{ state: "APPROVED", author: { login: "a11ign-ai-leads" } }] });
  assert.deepEqual(missing(settled), [], "the owner's own account still settles an App-authored PR");
});
