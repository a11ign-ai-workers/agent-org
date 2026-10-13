// no-token: gh -- the read is a fake `run`; a real `sh` child stands in for `gh`, and no GitHub call is made.
/**
 * `src/row-claim.ts`, agent-org#1246 (a11ign/a11ign#5282, class `claim-refused`): a refused issue read records WHY `gh` failed, on the refusal's first line and so in the
 * failure ledger line. Before this, every refused read read "could not read issue #N" with the cause on the second line, which the ledger never kept.
 *
 * POSITIVE CONTROL: a child process writes gh's rate-limit text to stderr and exits 1, through the same `execFileSync` shape `defaultRun` uses, and both the refusal's
 * first line and the ledger line carry "rate limit".
 * NEGATIVE CONTROL: with gh silent, the refusal and the ledger line read exactly as they did before this change, and carry no "gh said".
 *
 * MUTATIONS, each run by hand and the file restored byte-identical from a copy: the cause removed (the POSITIVE CONTROL tests go red, the NEGATIVE CONTROL stays green);
 * the cause added with stderr empty (the NEGATIVE CONTROL goes red).
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchLabels, recordClaimRefusal } from "./row-claim.ts";

const SCRATCH = mkdtempSync(join(tmpdir(), "row-claim-refusal-cause-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
const NOW = Date.UTC(2026, 9, 12, 22, 0);
const REPO = "a11ign/agent-org";
const RATE = "GraphQL: API rate limit already exceeded";

/** A `run` that does what `defaultRun` does when `gh` fails: `execFileSync` throws, carrying the child's stderr. `sh` stands in for `gh`. The text comes in by environment, not argv: argv is echoed into the error's "Command failed:" line, and that would make the control pass without the change. */
const ghThatRefuses = (stderr: string) => (): string => execFileSync("sh",
  ["-c", '[ -n "$GH_STDERR" ] && printf \'%s\\n\' "$GH_STDERR" >&2; exit 1'],
  { encoding: "utf8", env: { ...process.env, GH_STDERR: stderr } });

/** The message a refused read throws, which is the refusal the claim prints. */
function refusalOf(run: () => string): string {
  try {
    fetchLabels(1246, { run, repo: REPO });
  } catch (error) {
    return (error as Error).message;
  }
  assert.fail("a refused read must throw, not guess");
}

/** A ledger path of the test's own, so each test reads back only the line it wrote. */
const ledgerFor = (name: string): string => join(SCRATCH, `${name}.ledger`);

test("POSITIVE CONTROL: a refused read says what gh said, on the refusal's first line", () => {
  const refusal = refusalOf(ghThatRefuses(RATE));
  const first = refusal.split("\n")[0];
  assert.match(first, /rate limit/, refusal);
  assert.match(first, /gh said: GraphQL: API rate limit already exceeded/, refusal);
});

test("POSITIVE CONTROL: the failure ledger line carries the cause", () => {
  const logPath = ledgerFor("rate-limit");
  recordClaimRefusal(refusalOf(ghThatRefuses(RATE)), { logPath, now: NOW });
  const lines = readFileSync(logPath, "utf8").split("\n").filter((line) => line !== "");
  assert.equal(lines.length, 1, "one refusal, one ledger line");
  assert.match(lines[0], /claim-guard-held/, "a rate-limited read is one outage, the guard working (agent-org#1262)");
  assert.match(lines[0], /rate limit/, lines[0]);
});

test("NEGATIVE CONTROL: with gh silent, the refusal and the ledger line read as they did before", () => {
  const refusal = refusalOf(ghThatRefuses(""));
  const first = refusal.split("\n")[0];
  assert.ok(
    first.startsWith("row-claim: could not read issue #1246 from a11ign/agent-org -- refusing to guess whether it is claimed. Command failed: "),
    first,
  );
  assert.doesNotMatch(first, /gh said/);
  const logPath = ledgerFor("silent");
  recordClaimRefusal(refusal, { logPath, now: NOW });
  const line = readFileSync(logPath, "utf8").split("\n").find((l) => l !== "") ?? "";
  assert.doesNotMatch(line, /gh said/);
  assert.match(line, /could not read issue #1246 from a11ign\/agent-org -- refusing to guess whether it is claimed\. Command failed: /);
});
