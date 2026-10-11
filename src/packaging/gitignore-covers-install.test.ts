// no-token: gh
//
// Nothing here reaches `gh` or the network: each case builds a scratch project in a temporary directory and runs `git` in it.

/**
 * #931: EVERY TAG FROM v0.155.5 CARRIED 2,278 TRACKED `node_modules/` FILES, BECAUSE THIS REPOSITORY HAD NO `.gitignore`.
 *
 * The release commit is staged with `git add -A`, so whatever is installed in the checkout is staged with it. The fix is the ignore rule, and this
 * file pins it: the scratch project gets a copy of the repository's `.gitignore`, an installed `node_modules/` and one source file, and the staging
 * that a release does must take the source file and leave the installed directory.
 *
 * THE SCRATCH PROJECT, NOT THIS CHECKOUT. `git check-ignore` run in a linked worktree is also answered by the clone's `.git/info/exclude`, which
 * ignores `node_modules` on this machine whether or not `.gitignore` does, so a check run here stays green with the rule deleted. The scratch
 * repository has its own (empty) exclude file, and the global excludes file is pointed at `/dev/null`, so only the copied `.gitignore` can answer.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxGitEnv } from "../lib/git-env.ts";

const TOOL_ROOT = fileURLToPath(new URL("../..", import.meta.url));
/** The two paths every case uses: the installed dependency a release must not carry, and the source it must. */
const INSTALLED = join("node_modules", "left-pad", "index.js");
const SOURCE = join("src", "x.ts");
/** git's own flags for the scratch repository: no global excludes, so only the copied `.gitignore` can ignore anything. */
const GIT = ["-c", "core.excludesFile=/dev/null"];

/**
 * A scratch project holding the repository's `.gitignore`, one installed file and one source file, under `git init`. `run` receives its path and
 * the directory is removed afterwards whatever the case does.
 */
function withScratchProject(run: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "gitignore-covers-install-"));
  try {
    copyFileSync(join(TOOL_ROOT, ".gitignore"), join(dir, ".gitignore"));
    mkdirSync(join(dir, "node_modules", "left-pad"), { recursive: true });
    writeFileSync(join(dir, INSTALLED), "module.exports = () => {};\n");
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, SOURCE), "export const x = 1;\n");
    execFileSync("git", [...GIT, "init", "-q"], { cwd: dir, env: sandboxGitEnv() });
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `git check-ignore` status for `path`: 0 ignored, 1 not ignored. Anything else is an error, and an error is not an answer. */
function ignoreStatus(dir: string, path: string): number {
  const result = spawnSync("git", [...GIT, "check-ignore", "-q", path], { cwd: dir, env: sandboxGitEnv() });
  assert.ok(result.status === 0 || result.status === 1, `git check-ignore ${path} failed: ${result.stderr?.toString()}`);
  return result.status;
}

test("POSITIVE CONTROL: the repository's .gitignore ignores an installed node_modules/ file", () => {
  withScratchProject((dir) => {
    assert.equal(ignoreStatus(dir, INSTALLED), 0, `${INSTALLED} is not ignored by the copied .gitignore`);
  });
});

test("NEGATIVE CONTROL: the same .gitignore does not ignore a source file under src/", () => {
  withScratchProject((dir) => {
    assert.equal(ignoreStatus(dir, SOURCE), 1, `${SOURCE} is ignored by the copied .gitignore`);
  });
});

test("a release-style `git add -A` in the scratch project stages the source and not node_modules/", () => {
  withScratchProject((dir) => {
    execFileSync("git", [...GIT, "add", "-A"], { cwd: dir, env: sandboxGitEnv() });
    const staged = execFileSync("git", [...GIT, "ls-files"], { cwd: dir, encoding: "utf8", env: sandboxGitEnv() })
      .split("\n")
      .filter(Boolean)
      .sort();
    assert.deepEqual(staged, [".gitignore", SOURCE]);
  });
});
