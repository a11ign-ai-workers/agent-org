// no-token: gh -- pure parsing, and git injected
import { test } from "node:test";
import assert from "node:assert/strict";
import { discoverPackages, resolveScope, titleScope } from "./scope.ts";
import type { Git } from "./worktree.ts";

const PACKAGES = { "nbl-ui-netbox": ["ui-netbox", "ui-visual-explorer"], "nbl-ui-platform": ["ui-settings", "ui-shell"], "nbl-ui-agent-platform": [] };

test("a conventional title's scope is read, with or without a breaking-change mark, and a title without one has none", () => {
  assert.equal(titleScope("fix(nbl-ui-netbox): pagination resets"), "nbl-ui-netbox");
  assert.equal(titleScope("feat(ui-settings)!: rotate tokens"), "ui-settings");
  assert.equal(titleScope("  refactor( shared-utils ): x"), "shared-utils");
  assert.equal(titleScope("fix: no scope"), null);
  assert.equal(titleScope("Visual Explorer UI - Fit to View does nothing"), null);
});

test("a scope resolves to a repository by name, or to the repository holding a package of that name", () => {
  assert.deepEqual(resolveScope("fix(nbl-ui-agent-platform): x", PACKAGES), { repo: "nbl-ui-agent-platform", package: null });
  assert.deepEqual(resolveScope("fix(ui-visual-explorer): x", PACKAGES), { repo: "nbl-ui-netbox", package: "ui-visual-explorer" });
  assert.deepEqual(resolveScope("feat(ui-shell): x", PACKAGES), { repo: "nbl-ui-platform", package: "ui-shell" });
  assert.equal(resolveScope("fix(ci): x", PACKAGES), null, "a scope that is neither is not guessed at");
  assert.equal(resolveScope("Visual Explorer UI - x", PACKAGES), null);
});

test("packages are read from each clone's remote default branch, and a clone that cannot be read has none", async () => {
  const calls: string[] = [];
  const git: Git = async (cwd, args) => {
    calls.push(`${cwd} ${args.join(" ")}`);
    if (cwd === "/broken") throw new Error("not a repository");
    if (args[0] === "ls-remote") return "ref: refs/heads/develop\tHEAD\n";
    return "packages/ui-settings\npackages/ui-shell\n";
  };
  assert.deepEqual(await discoverPackages({ "nbl-ui-platform": "/clones/platform", gone: "/broken" }, git), { "nbl-ui-platform": ["ui-settings", "ui-shell"], gone: [] });
  assert.ok(calls.includes("/clones/platform ls-tree -d --name-only origin/develop packages/"), "the default branch the remote names, not the checkout");
});
