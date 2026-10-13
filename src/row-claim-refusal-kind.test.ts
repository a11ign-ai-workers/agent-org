/**
 * `src/row-claim.ts`, agent-org#1262 (a11ign/a11ign#5282, class `claim-refused`): A REFUSAL THAT IS THE CLAIM GUARD WORKING IS NOT A FAILURE OF THE CLAIM PATH.
 * The worktree cap, a B4 overlap and a tree that already exists are written as `claim-guard-held`, which `class-repeat` does not count; the four failures (an unreadable
 * read, B4 not askable, a rule copy behind the release, an unknown tracker key) stay `claim-refused`. Both kinds are read by `readClaimRefusals`, so signal 26 still counts every refusal.
 *
 * THE REF of a failure stays the refusal's first line, which is what it is today (the cause), and is what the existing `row-claim-refusal-cause.test.ts` pins.
 *
 * POSITIVE CONTROLS: each failure writes `claim-refused` with its first line as the ref; each guard refusal writes `claim-guard-held`, and no `claim-refused` line.
 * NEGATIVE CONTROLS: a guard refusal is not a `claim-refused` line, and a failure is not a `claim-guard-held` line; `class-repeat` groups no guard-held repeat.
 *
 * MUTATIONS, each run by hand with the file copied to the scratchpad and restored byte-identical after: the classifier always answering `claim-refused` (the guard-held
 * POSITIVE CONTROLS go red); the classifier always answering `claim-guard-held` (the failure POSITIVE CONTROLS go red).
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordClaimRefusal } from "./row-claim.ts";
import { readClaimRefusals } from "./org-health.ts";
import { groupByClass } from "./class-repeat.ts";
import { CLAIM_GUARD_HELD_KIND, CLAIM_REFUSED_KIND } from "./failure-ledger.ts";

const SCRATCH = mkdtempSync(join(tmpdir(), "row-claim-refusal-kind-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
const NOW = Date.UTC(2026, 9, 13, 9, 0);

// THE GUARD WORKING: three refusals that name a guard, copied from the text each one prints.
const WORKTREE_CAP = "this checkout holds 356 live worktrees, at or over the cap of 100 (agent-org#1036). Refusing before any write: a claim creates a worktree, and the count falls only when the prune removes some.";
const TREE_EXISTS = "--worktree=../wt-15 ALREADY EXISTS, stamped by `worker-agent-org-1000`. Refusing before any write.";
const B4_OVERLAP = "overlaps #878 in a11ign/agent-org, which already touches: .github/workflows/ci.yml. B4: no two open pull requests touch the same file -- sequence with that PR's author, or narrow this row's region to what does not overlap.";

// THE FAILURE OF THE CLAIM PATH: four refusals, copied the same way.
const UNREADABLE_READ = "row-claim: could not read issue #15 from a11ign/agent-org -- refusing to guess whether it is claimed. Command failed: gh issue view 15";
const B4_NOT_ASKABLE = "B4 COULD NOT BE ASKED which rows are already claimed: that list could not be read, so this row's Region cannot be compared with theirs. INCONCLUSIVE, not clear -- retry the claim (the gate offers the row again by itself).";
const RULE_BEHIND = "THIS CHECKOUT'S COPY OF THE RULE IS 3 COMMIT(S) BEHIND THE RELEASE THE HOST RUNS (v0.183.3).";
const UNKNOWN_TRACKER = "no tracker with key `nope` is declared in .agent-org/project.json (declared: the empty key); nothing is defaulted to another tracker's row of the same number";

// A read the rate limit refused: one outage, the guard working (ceo's reading on the row).
const RATE_LIMITED_READ = "row-claim: could not read issue #15 from a11ign/agent-org -- refusing to guess whether it is claimed. Command failed: gh issue view 15\ngh said: GraphQL: API rate limit already exceeded for user ID 328832207.";

const GUARD_HELD = [WORKTREE_CAP, TREE_EXISTS, B4_OVERLAP];
const FAILURES = [UNREADABLE_READ, B4_NOT_ASKABLE, RULE_BEHIND, UNKNOWN_TRACKER];

/** Each refusal written, in order, one ledger line per call at a minute apart; returns the ledger's path, read back as lines. */
function ledgerOf(name: string, refusals: string[]): string[] {
  const logPath = join(SCRATCH, `${name}.ledger`);
  refusals.forEach((refusal, i) => recordClaimRefusal(refusal, { logPath, now: NOW + i * 60_000 }));
  return readFileSync(logPath, "utf8").split("\n").filter((line) => line !== "");
}

/** The ledger line a refusal's first line is written under, which is the line's ref. */
const firstLineOf = (refusal: string): string => refusal.split("\n")[0].trim();

test("POSITIVE CONTROL: each failure of the claim path writes claim-refused, with its first line as the ref", () => {
  const lines = ledgerOf("failures", FAILURES);
  assert.equal(lines.length, FAILURES.length, "one refusal, one ledger line");
  FAILURES.forEach((refusal, i) => {
    assert.equal(lines[i].split("\t")[0], CLAIM_REFUSED_KIND, refusal);
    assert.equal(lines[i].split("\t")[2], firstLineOf(refusal));
  });
});

test("POSITIVE CONTROL: each refusal that is the guard working writes claim-guard-held, and no claim-refused line", () => {
  const lines = ledgerOf("guard-held", [...GUARD_HELD, RATE_LIMITED_READ]);
  const kinds = lines.map((line) => line.split("\t")[0]);
  assert.deepEqual(kinds, [CLAIM_GUARD_HELD_KIND, CLAIM_GUARD_HELD_KIND, CLAIM_GUARD_HELD_KIND, CLAIM_GUARD_HELD_KIND]);
  assert.equal(lines[0].split("\t")[2], firstLineOf(WORKTREE_CAP));
  assert.equal(lines[1].split("\t")[2], firstLineOf(TREE_EXISTS));
  assert.equal(lines[2].split("\t")[2], firstLineOf(B4_OVERLAP));
});

test("NEGATIVE CONTROL: a guard refusal is not a claim-refused line, and a failure is not a claim-guard-held line", () => {
  const guard = ledgerOf("negative-guard", GUARD_HELD);
  assert.ok(guard.every((line) => !line.startsWith(`${CLAIM_REFUSED_KIND}\t`)), guard.join("\n"));
  const failed = ledgerOf("negative-failure", FAILURES);
  assert.ok(failed.every((line) => !line.startsWith(`${CLAIM_GUARD_HELD_KIND}\t`)), failed.join("\n"));
});

test("the guard-working refusals still reach signal 26's reading, beside the failures, through readClaimRefusals", () => {
  const all = [...GUARD_HELD, ...FAILURES, RATE_LIMITED_READ];
  const path = join(SCRATCH, "signal-26.ledger");
  all.forEach((refusal, i) => recordClaimRefusal(refusal, { logPath: path, now: NOW + i * 60_000 }));
  const reasons = readClaimRefusals({ path })?.map(({ reason }) => reason);
  assert.deepEqual(reasons, all.map(firstLineOf), "every refusal is counted, the guard's and the failure's alike");
});

test("class-repeat groups a repeat of claim-guard-held as no class, and a repeat of claim-refused as one", () => {
  const repeat = (classKey: string) => [{ classKey, refs: ["first", "second"], newestAt: NOW }];
  assert.deepEqual(groupByClass([], [], repeat(CLAIM_GUARD_HELD_KIND)), [], "a guard working is no class and no repeat");
  assert.deepEqual(groupByClass([], [], repeat(CLAIM_REFUSED_KIND)).map(({ id }) => id), [CLAIM_REFUSED_KIND], "a failure repeated is a class");
});
