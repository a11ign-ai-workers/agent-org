// no-token: gh -- every `gh` call is an injected `run`; nothing here reaches the network (a11ign/agent-org#1036)
/**
 * agent-org#1036: THE CLAIM-TIME CAP ON LIVE WORKTREES. A claim that would create a worktree is refused, before the fetch or any write, when the
 * checkout it runs in already holds `WORKTREE_CAP` or more worktrees (the main one included). What is pinned, each over a REAL scratch repository and
 * a real `git worktree add`, with `git worktree list` answering a fixture count instead of N real trees:
 *   - NEGATIVE CONTROL: a checkout one under the cap is claimed as before -- the tree is made and the claim runs. A cap that refused everything
 *     turns this red;
 *   - a checkout AT the cap (100) is refused by name, naming the count and the prune, with no tree made and no claim asked;
 *   - a checkout over the cap (356, the count #3850 measured on 2026-10-06) is refused and names 356;
 *   - a listing git cannot give is thrown, and no tree is made on a guess.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { sandboxGitEnv } from "./lib/git-env.ts";
import { WORKTREE_CAP, claimWithWorktree } from "./row-claim.ts";

const ROW = 1036;
const SESSION = "worker-agent-org-1036";
const BRANCH = "agent/the-claim-time-cap-agent-org-1036";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", env: sandboxGitEnv(), stdio: ["ignore", "pipe", "pipe"] });

/** A checkout with a bare origin holding `main`. */
function repository() {
  const dir = mkdtempSync(resolve(tmpdir(), "row-claim-cap-"));
  const origin = resolve(dir, "origin.git");
  const checkout = resolve(dir, "checkout");
  git(dir, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  git(dir, "clone", "--quiet", origin, checkout);
  for (const [key, value] of [["user.name", "probe"], ["user.email", "probe@example.invalid"], ["commit.gpgsign", "false"], ["gc.auto", "0"]]) git(checkout, "config", key, value);
  writeFileSync(resolve(checkout, "package.json"), "{\"name\":\"probe\",\"version\":\"0.0.0\"}\n");
  git(checkout, "add", "package.json");
  git(checkout, "commit", "--quiet", "-m", "probe");
  git(checkout, "push", "--quiet", "origin", "main");
  return { dir, checkout, tree: resolve(dir, "wt-1036") };
}

/** `git worktree list --porcelain` for `count` worktrees: one `worktree` entry each, the blank line between entries as git prints it. */
function listingOf(count: number): string {
  return Array.from({ length: count }, (_, i) => `worktree /scratch/wt-${i}\nHEAD ${"0".repeat(40)}\nbranch refs/heads/agent/x-${i}\n`).join("\n");
}

/** The real `git` of the scratch checkout, except that `git worktree list` answers `listing()` -- a fixture count, not N real trees. */
function runWithListing(listing: () => string) {
  return (cmd: string, args: string[]): string => {
    if (cmd === "git" && args.includes("worktree") && args.includes("list")) return listing();
    return execFileSync(cmd, args, { encoding: "utf8", env: sandboxGitEnv(), stdio: ["ignore", "pipe", "pipe"] });
  };
}

/** Claims row 1036 in `fx`'s checkout with `count` live worktrees; `order` records each call that would write. */
function claimIn(fx: ReturnType<typeof repository>, { count, order = [] as string[], listing }: { count?: number; order?: string[]; listing?: () => string }) {
  const claim = ((_n: number, _s: string, deps: { worktree?: string }) => {
    order.push("claim");
    return { claimed: true, statusMoved: true, seen: deps.worktree };
  }) as never;
  return claimWithWorktree(ROW, SESSION, {
    branch: BRANCH, worktree: fx.tree, clone: fx.checkout, claim,
    run: runWithListing(listing ?? (() => listingOf(count ?? 0))),
    exists: () => false, stamp: () => {}, exec: () => "",
  });
}

test("NEGATIVE CONTROL: a checkout one under the cap is claimed as before -- the tree is made and the claim runs", () => {
  const fx = repository();
  try {
    const order: string[] = [];
    const result = claimIn(fx, { count: WORKTREE_CAP - 1, order });
    assert.equal(result.claimed, true, `a claim under the cap is not refused: ${JSON.stringify(result)}`);
    assert.ok(existsSync(fx.tree), "the worktree the claim asked for is made");
    assert.deepEqual(order, ["claim"], "the claim is asked");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a checkout AT the cap is refused by name: the count, the cap and the prune, with no tree made and no claim asked", () => {
  const fx = repository();
  try {
    const order: string[] = [];
    const result = claimIn(fx, { count: WORKTREE_CAP, order });
    assert.equal(result.claimed, false);
    if (result.claimed) return;
    assert.match(result.reason, new RegExp(`holds ${WORKTREE_CAP} live worktrees, at or over the cap of ${WORKTREE_CAP}`));
    assert.match(result.reason, /pnpm run worktrees:prune -- --apply/);
    assert.equal(existsSync(fx.tree), false, "no tree is made");
    assert.deepEqual(order, [], "the claim is never asked");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a checkout over the cap is refused and names its count (356, the count #3850 measured on 2026-10-06)", () => {
  const fx = repository();
  try {
    const order: string[] = [];
    const result = claimIn(fx, { count: 356, order });
    assert.equal(result.claimed, false);
    if (result.claimed) return;
    assert.match(result.reason, /holds 356 live worktrees/);
    assert.equal(existsSync(fx.tree), false, "no tree is made");
    assert.deepEqual(order, [], "the claim is never asked");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a listing git cannot give is thrown, and no tree is made on a guess", () => {
  const fx = repository();
  try {
    const order: string[] = [];
    assert.throws(() => claimIn(fx, { order, listing: () => { throw new Error("fatal: not a git repository"); } }), /could not count the live worktrees/);
    assert.equal(existsSync(fx.tree), false, "no tree is made");
    assert.deepEqual(order, [], "the claim is never asked");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});
