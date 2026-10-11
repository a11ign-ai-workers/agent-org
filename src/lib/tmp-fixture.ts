// no-token: none -- makes and removes temporary directories; nothing here reaches `gh`, `herdr` or `git`
/**
 * (#3848) A TEST'S TEMPORARY DIRECTORY, REMOVED BY THE RUNNER'S OWN TEARDOWN.
 *
 * Measured 2026-10-06: `/tmp` held 121,411 entries, 6,448 of them `verify-stamp-test-*`, every one made by a test that called `mkdtempSync` and
 * never removed it. The cheapest `rmdir` is the one never needed (#3846's soft lockup was a `node` in `rmdir` over a 5.4 MB `/tmp`).
 *
 * `tmpDir` is `mkdtempSync` plus the removal, so a test cannot make one without registering it. The removal runs in `afterEach`, which is what
 * makes a killed run leave at most the directory in flight rather than every directory the file made. `tmpDirForFile` is for a directory made
 * at import time or in a `before`, which every test in the file shares: `afterEach` would take it from under the second test, so it goes in `after`.
 *
 * `afterEach` and `after` come from `node:test` as an ESM import, deliberately: under rstest the resolve hook redirects an ESM `node:test` to
 * rstest's hooks and does not redirect `require` (`walk-scope.ts` measured an `after` from `require("node:test")` never firing).
 *
 * NOT FOR A TEST THAT RUNS ITS CASES CONCURRENTLY: `afterEach` would remove a directory a sibling case is still using. No file here does; a
 * file that must takes its own `t.after`.
 */
import { after, afterEach } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const perTest = new Set<string>();
const perFile = new Set<string>();

/** `rmSync`'s own retries (it retries EBUSY, ENOTEMPTY and EPERM only): a late writer in the tree, such as a `git` the test spawned, is waited out rather than ending the removal. */
const RETRIES = { maxRetries: 5, retryDelay: 100 };

/** What removes one directory; a test passes its own to make a removal fail. */
type Remove = (dir: string) => void;

/**
 * (#987) EVERY DIRECTORY IS TRIED, AND A FAILURE IS THE FILE'S OWN RED. Measured in the merge-queue run 38150393779: a file passed all its cases and its
 * directory was left holding 4 of the 5 entries it was made with, so the removal had begun (one entry gone) and stopped, and nothing said so. A removal
 * that threw at the first failure took the remaining directories with it and, in `after`, ended the hook with the rest of the list untried. So each
 * directory is attempted whatever the one before did, a directory that could not be removed stays in `made` for the exit fallback below, and the failures
 * are thrown together, naming each path, so the leak is this file's failure and not the queue's.
 */
export function removeAll(made: Set<string>, remove?: Remove): void {
  const failures: string[] = [];
  for (const dir of made) {
    try {
      if (remove) remove(dir);
      else rmSync(dir, { recursive: true, force: true, ...RETRIES });
      made.delete(dir);
    } catch (error) {
      failures.push(`${dir}: ${(error as NodeJS.ErrnoException).code ?? String(error)}`);
    }
  }
  if (failures.length > 0) throw new Error(`tmp-fixture: could not remove ${failures.length} test director${failures.length === 1 ? "y" : "ies"}: ${failures.join("; ")}`);
}

function removeAllQuietly(made: Set<string>): void {
  try { removeAll(made); } catch { /* the exit fallback has nowhere to report to; the teardown names what is left */ }
}

afterEach(() => removeAll(perTest));
after(() => {
  const failures: unknown[] = [];
  for (const made of [perTest, perFile]) {
    try { removeAll(made); } catch (error) { failures.push(error); }
  }
  if (failures.length > 0) throw new Error(failures.map((error) => (error as Error).message).join("; "));
});

// The fallback for any path the runner takes after the last case that never reaches `after` (a fork that exits first): the process's own `exit`, which runs
// synchronously, removes whatever is still registered. A killed fork still leaves its directory, and the teardown names it.
process.once("exit", () => { removeAllQuietly(perTest); removeAllQuietly(perFile); });

/**
 * A fresh directory under the system temp directory, removed after the test that made it.
 * `prefix` is what a reader of `/tmp` sees if the removal ever fails; `parent` is a directory to make it in instead of the system's, such as one `tmpDirForFile` holds, removed with it either way.
 */
export function tmpDir(prefix: string, parent = tmpdir()): string {
  const dir = mkdtempSync(join(parent, prefix));
  perTest.add(dir);
  return dir;
}

/** A fresh directory removed once, when the file's last test is done: for one every test in the file shares. */
export function tmpDirForFile(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  perFile.add(dir);
  return dir;
}
