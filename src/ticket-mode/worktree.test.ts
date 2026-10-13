// no-token: gh -- real git, in disposable repositories `withGitSandbox` builds; nothing reaches a network remote
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import { sandboxGitEnv, withGitSandbox } from "@a11ign/toolchain/lib/git-sandbox";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { addWorktree, excludeFromGit, parseDefaultBranch, worktreePath, type Git } from "./worktree.ts";

const git: Git = (cwd, args) => execFileSync("git", args, { cwd, env: sandboxGitEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

test("the default branch is the one the remote's HEAD names", () => {
  assert.equal(parseDefaultBranch("ref: refs/heads/develop\tHEAD\n4e9bed32\tHEAD\n"), "develop");
  assert.throws(() => parseDefaultBranch("4e9bed32\tHEAD\n"), /named no default branch/);
});

/** A remote whose default is `develop` (with a stale `main` beside it), and a clone of it made while its HEAD was still `main`. */
function remoteAndClone(sandbox: { dir: string; run: (args: string[]) => string; commit: (message: string, extra?: string[]) => string }) {
  sandbox.run(["symbolic-ref", "HEAD", "refs/heads/main"]);
  sandbox.commit("on main", ["--allow-empty"]);
  const scratch = realpathSync(tmpDir("ticket-worktree-"));
  const clone = join(scratch, "clone");
  execFileSync("git", ["clone", "-q", sandbox.dir, clone], { env: sandboxGitEnv() });
  sandbox.run(["checkout", "-q", "-b", "develop"]);
  sandbox.commit("on develop", ["--allow-empty"]);
  return { clone, root: join(scratch, "worktrees") };
}

test("a worktree is made on the ticket's branch from the remote's live default, not the clone's stale `origin/HEAD`", () => {
  withGitSandbox((sandbox) => {
    const { clone, root } = remoteAndClone(sandbox);
    assert.equal(git(clone, ["symbolic-ref", "refs/remotes/origin/HEAD"]).trim(), "refs/remotes/origin/main", "POSITIVE CONTROL: the clone's own HEAD is stale");
    const path = worktreePath(root, "NBF-1", "repo-a");
    const made = addWorktree({ repo: "repo-a", clone, path, branch: "nbf-1-fix" }, git);
    assert.equal(made.base, "develop");
    assert.equal(git(path, ["rev-parse", "--abbrev-ref", "HEAD"]).trim(), "nbf-1-fix");
    assert.equal(git(path, ["log", "-1", "--format=%s"]).trim(), "on develop");
  });
});

test("an existing branch or path is refused, and nothing is created for it", () => {
  withGitSandbox((sandbox) => {
    const { clone, root } = remoteAndClone(sandbox);
    git(clone, ["branch", "nbf-2-fix"]);
    assert.throws(() => addWorktree({ repo: "repo-a", clone, path: worktreePath(root, "NBF-2", "repo-a"), branch: "nbf-2-fix" }, git), /already exists/);
    assert.equal(git(clone, ["worktree", "list"]).trim().split("\n").length, 1, "no worktree was added");
    const path = worktreePath(root, "NBF-3", "repo-a");
    addWorktree({ repo: "repo-a", clone, path, branch: "nbf-3-fix" }, git);
    assert.throws(() => addWorktree({ repo: "repo-a", clone, path, branch: "nbf-3-other" }, git), /already exists/);
  });
});

test("a generated file is excluded once through the clone's shared exclude, and an ignored one is left alone", () => {
  // A name no global gitignore holds: `.claude/settings.local.json` is in many people's (this author's included), which is the second half below.
  const generated = ".ticket-mode-generated";
  withGitSandbox((sandbox) => {
    const { clone, root } = remoteAndClone(sandbox);
    const path = worktreePath(root, "NBF-4", "repo-a");
    addWorktree({ repo: "repo-a", clone, path, branch: "nbf-4-fix" }, git);
    excludeFromGit(path, generated, { git });
    excludeFromGit(path, generated, { git });
    const exclude = readFileSync(join(clone, ".git", "info", "exclude"), "utf8");
    assert.equal(exclude.split("\n").filter((line) => line === generated).length, 1);
    const appended: string[] = [];
    excludeFromGit(path, generated, { git, append: (_p, line) => appended.push(line) });
    assert.deepEqual(appended, [], "already ignored, so nothing is appended");
  });
});
