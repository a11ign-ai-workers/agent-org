// no-token: gh -- `gh` is never reached: every claim is handed a fake `claim`, and git runs over scratch repositories.
/**
 * agent-org#871 (a11ign#4957 cause 2; replaces #851): A WORKTREE THE CLAIM MAKES IS PROVISIONED FROM THE COMMITTED PNPM LOCKFILE.
 *
 * `row-claim claim --branch --worktree` ran `git worktree add` and nothing else, so a fresh worker's Acceptance (`node --test`, `rstest`) found no
 * `node_modules` and exited 1 before it tested anything (agent-org#816 stopped on exactly that). What is pinned, each over a REAL scratch repository
 * and a real `git worktree add`, with the install and the probe's `node` replaced by a recording `exec`:
 *   - POSITIVE CONTROL: a repository that commits `pnpm-lock.yaml` is installed in -- ONE `pnpm install --frozen-lockfile --ignore-scripts`, run in
 *     the tree the claim made, after the claim was recorded -- then probed, and the claim's line says `installed`. A mutation that skips the install
 *     turns this red;
 *   - the same install that leaves no `node_modules/.bin/rstest` (the lock removed from what it installed) is `not ready: ...` BY NAME;
 *   - a repository with no lockfile is claimed exactly as before: no install, no `install` on the result, the line unchanged;
 *   - a tree that already has `node_modules` is not installed over;
 *   - a failing install leaves the claim made and says so, with the first error line, in the claim's line;
 *   - a claim that is refused installs nothing, and an adopted tree (which holds somebody's work) is not installed in;
 *   - the CLI hands the result's `install` to `claimLineFor`, so the word reaches the worker.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxGitEnv } from "./lib/git-env.ts";
import { claimLineFor, claimWithWorktree } from "./row-claim.ts";

const ROW = 871;
const SESSION = "worker-agent-org-871";
const BRANCH = "agent/an-agent-org-worktree-is-provisioned-871";

const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", env: sandboxGitEnv(), stdio: ["ignore", "pipe", "pipe"] });

/** A checkout with a bare origin holding `main`, committing `pnpm-lock.yaml` only when `lockfile` is true. */
function repository(lockfile: boolean) {
  const dir = mkdtempSync(resolve(tmpdir(), "row-claim-installs-"));
  const origin = resolve(dir, "origin.git");
  const checkout = resolve(dir, "checkout");
  git(dir, "init", "--quiet", "--bare", "--initial-branch=main", origin);
  git(dir, "clone", "--quiet", origin, checkout);
  for (const [key, value] of [["user.name", "probe"], ["user.email", "probe@example.invalid"], ["commit.gpgsign", "false"], ["gc.auto", "0"]]) git(checkout, "config", key, value);
  writeFileSync(resolve(checkout, "package.json"), "{\"name\":\"probe\",\"version\":\"0.0.0\"}\n");
  git(checkout, "add", "package.json");
  if (lockfile) {
    writeFileSync(resolve(checkout, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
    git(checkout, "add", "pnpm-lock.yaml");
  }
  git(checkout, "commit", "--quiet", "-m", "probe");
  git(checkout, "push", "--quiet", "origin", "main");
  return { dir, checkout, tree: resolve(dir, "wt-871") };
}

type Exec = NonNullable<Parameters<typeof claimWithWorktree>[2]["exec"]>;

/** Claims row 871 in `fx`'s checkout, the way the CLI does (`clone` + a relative worktree), with the claim and `npm` replaced by recorders. */
function claimIn(fx: ReturnType<typeof repository>, { exec, claimed = true, order = [] as string[], adopt, stamp }: {
  exec: Exec; claimed?: boolean; order?: string[]; adopt?: string; stamp?: (worktree: string, session: string) => void;
}) {
  const claim = ((_n: number, _s: string, deps: { worktree?: string }) => {
    order.push("claim");
    return claimed ? { claimed: true, statusMoved: true, seen: deps.worktree } : { claimed: false, reason: "lost the race" };
  }) as never;
  return claimWithWorktree(ROW, SESSION, { branch: BRANCH, worktree: "../wt-871", clone: fx.checkout, claim, stamp: stamp ?? (() => {}), exec, adopt,
    owner: () => adopt ?? null });
}

/**
 * A fake `exec`: the install is the call whose argv names `install`, the probe is the one that runs `node --test`. A successful install makes
 * `node_modules/.bin/rstest` in the tree (as the real one does) unless `bin` is false; the probe's `node` is never really run.
 */
const recorder = (calls: { cmd: string; args: string[]; cwd: string }[], order: string[] = [], { fail, bin = true }: { fail?: Error; bin?: boolean } = {}): Exec =>
  (cmd, args, { cwd }) => {
    const isInstall = args.includes("install");
    order.push(isInstall ? "install" : "probe");
    calls.push({ cmd, args, cwd });
    if (isInstall && fail) throw fail;
    if (isInstall && bin) {
      mkdirSync(resolve(cwd, "node_modules", ".bin"), { recursive: true });
      writeFileSync(resolve(cwd, "node_modules", ".bin", "rstest"), "");
    }
    return "";
  };

test("POSITIVE CONTROL: a claim that makes a worktree of a repository with a lockfile runs `pnpm install --frozen-lockfile --ignore-scripts` IN that tree, after the claim, probes it and says `installed`", () => {
  const fx = repository(true);
  try {
    const calls: Parameters<typeof recorder>[0] = [];
    const order: string[] = [];
    const result = claimIn(fx, { exec: recorder(calls, order), order });
    assert.equal(result.claimed, true);
    const [install, probe] = calls;
    assert.equal(calls.length, 2, "the install, then the probe");
    assert.deepEqual(install.args.slice(-3), ["install", "--frozen-lockfile", "--ignore-scripts"], "ONE frozen install, ignoring scripts");
    assert.equal(install.cwd, fx.tree, "in the tree the claim made");
    assert.deepEqual(probe.args.slice(0, 1), ["--test"], "the probe is a `node --test` file");
    assert.equal(probe.cwd, fx.tree);
    assert.deepEqual(order, ["claim", "install", "probe"], "the install is after the claim, so a failure of it can never take the row back");
    assert.match(git(fx.checkout, "worktree", "list", "--porcelain"), new RegExp(`worktree ${fx.tree}\\n`), "the tree it ran in is the worktree the claim made");
    assert.equal((result as { install?: string }).install, "installed");
    const line = claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree, install: (result as { install?: string }).install });
    assert.match(line, / \/ worktree .* \/ installed$/, "and the claim's own line says so");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a repository with no lockfile is claimed exactly as before: no install, nothing on the result, the line unchanged", () => {
  const fx = repository(false);
  try {
    const calls: Parameters<typeof recorder>[0] = [];
    const result = claimIn(fx, { exec: recorder(calls) });
    assert.equal(result.claimed, true);
    assert.deepEqual(calls, []);
    assert.equal("install" in result, false);
    assert.equal(claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree }), claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree, install: undefined }));
    assert.doesNotMatch(claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree }), / \/ install(ed| failed)/);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a tree that already has `node_modules` is not installed over, ", () => {
  const fx = repository(true);
  try {
    const calls: Parameters<typeof recorder>[0] = [];
    // The stamp is the claim's last act on the tree before the install, so a `node_modules` made there is one the tree had when the install looked.
    const result = claimIn(fx, { exec: recorder(calls), stamp: (worktree) => mkdirSync(resolve(worktree, "node_modules")) });
    assert.equal(result.claimed, true);
    assert.deepEqual(calls, []);
    assert.equal("install" in result, false);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a FAILING install leaves the claim made and says so, with the first error line, in the claim's line", () => {
  const fx = repository(true);
  try {
    const failure = Object.assign(new Error("Command failed: pnpm install --frozen-lockfile --ignore-scripts"), {
      stderr: "WARN deprecated thing@1.0.0: old\n ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with \"frozen-lockfile\"\n",
    });
    const result = claimIn(fx, { exec: recorder([], [], { fail: failure }) });
    assert.equal(result.claimed, true, "the row is still the worker's");
    const install = (result as { install?: string }).install;
    assert.equal(install, "install failed: ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with \"frozen-lockfile\"", "the first ERROR line, not the warning before it");
    const line = claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree, install });
    assert.match(line, /^STARTED -- #871 is now in-progress \/ session:worker-agent-org-871 \/ started .* \/ install failed: ERR_PNPM_OUTDATED_LOCKFILE .*$/);
    assert.equal(line.split("\n").length, 1, "one line");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("an install that leaves no `rstest` binary is `not ready:` and names it; a probe that fails says so; the claim stands either way", () => {
  const fx = repository(true);
  try {
    const result = claimIn(fx, { exec: recorder([], [], { bin: false }) });
    assert.equal(result.claimed, true, "the row is still the worker's");
    assert.equal((result as { install?: string }).install, "not ready: node_modules/.bin/rstest is missing");
    assert.match(claimLineFor("claim", ROW, SESSION, { branch: BRANCH, worktree: fx.tree, install: "not ready: node_modules/.bin/rstest is missing" }), / \/ not ready: node_modules\/\.bin\/rstest is missing$/);
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
  const broken = repository(true);
  try {
    const base = recorder([], []);
    const exec: Exec = (cmd, args, where) => {
      base(cmd, args, where);
      if (!args.includes("install")) throw Object.assign(new Error("probe failed"), { stderr: "SyntaxError: boom\n" });
      return "";
    };
    const result = claimIn(broken, { exec });
    assert.equal(result.claimed, true);
    assert.equal((result as { install?: string }).install, "not ready: `node --test` did not run: SyntaxError: boom");
    assert.deepEqual(readdirSync(broken.tree).includes("ready.test.mjs"), false, "the probe file is never left in the tree");
  } finally {
    rmSync(broken.dir, { recursive: true, force: true });
  }
});

test("a failure with no stderr (a timeout, `pnpm` missing) is still a line: the message's first line", () => {
  const fx = repository(true);
  try {
    const result = claimIn(fx, { exec: recorder([], [], { fail: Object.assign(new Error("spawnSync pnpm ENOENT"), { code: "ENOENT" }) }) });
    assert.equal(result.claimed, true);
    assert.equal((result as { install?: string }).install, "install failed: spawnSync pnpm ENOENT");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
});

test("a claim that is REFUSED installs nothing, and an ADOPTED tree (somebody's work) is not installed in", () => {
  const fx = repository(true);
  try {
    const calls: Parameters<typeof recorder>[0] = [];
    const refused = claimIn(fx, { exec: recorder(calls), claimed: false });
    assert.equal(refused.claimed, false);
    assert.deepEqual(calls, [], "the tree was removed with the refusal; there is nothing to install in");
  } finally {
    rmSync(fx.dir, { recursive: true, force: true });
  }
  const adopted = repository(true);
  try {
    const calls: Parameters<typeof recorder>[0] = [];
    git(adopted.checkout, "worktree", "add", "--quiet", "-b", BRANCH, adopted.tree, "origin/main");
    writeFileSync(resolve(adopted.tree, ".claim-owner"), "worker-agent-org-850\n");
    claimWithWorktree(ROW, SESSION, { branch: BRANCH, worktree: adopted.tree, adopt: "worker-agent-org-850", clone: adopted.checkout,
      claim: (() => ({ claimed: true, statusMoved: true })) as never, stamp: () => {}, owner: () => "worker-agent-org-850", exec: recorder(calls) });
    assert.deepEqual(calls, []);
  } finally {
    rmSync(adopted.dir, { recursive: true, force: true });
  }
});

test("the CLI hands the claim's `install` to `claimLineFor`, so the word reaches the worker", () => {
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "row-claim.ts"), "utf8");
  const call = source.match(/claimLineFor\(mode, issueNumber, mySession, \{[\s\S]*?\}\);/)?.[0] ?? "";
  assert.ok(/install: \(result as \{ install\?: string \}\)\.install/.test(call), `claimLineFor's call in the CLI hands it the result's install: ${call.slice(0, 300)}`);
});
