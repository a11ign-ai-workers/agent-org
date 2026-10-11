A worktree the claim makes is provisioned from the committed pnpm lockfile: `row-claim claim --branch --worktree` runs `pnpm install --frozen-lockfile --ignore-scripts` in the new tree when it has a `pnpm-lock.yaml` and no `node_modules`, probes it, and says `installed`, `install failed: <first error line>` or `not ready: <what failed>` in its line (a11ign/agent-org#871, replaces #851; a11ign#4957 cause 2).

Closes a11ign/agent-org#871

## What changes, and why

A fresh worker's Acceptance (`node --test`, `rstest`) found no `node_modules` in the tree the claim made and exited 1 before it tested anything; agent-org#816 stopped on exactly that. #851 prescribed an `npm ci` from a `package-lock.json`, which the pnpm ruling (a11ign#2889) forbids and `no-npm-spawn.test.ts` and `remedies-say-pnpm.test.ts` pin; this is the pnpm form, and neither guard is edited.

- **`pnpm-lock.yaml`**: `pnpm install --lockfile-only --ignore-scripts` run in a clean scratch directory holding only `package.json` (34 packages). `pnpm install --frozen-lockfile` accepts it, and the primary checkout joins it through `update-primary.ts`.
- **`src/row-claim.ts`**: `claimWithWorktree` takes an `exec` (a command run with a `cwd`, which `run` cannot say). After the claim is RECORDED, `installLockedDependencies` runs `pnpm install --frozen-lockfile --ignore-scripts` (through `pnpmCliInvocation`) in the tree when it has a `pnpm-lock.yaml` and no `node_modules`, then the readiness probe: `node_modules/.bin/rstest` exists and a trivial `node --test` file (written in a scratch directory, never in the tree) runs. The result carries `install`, which `claimLineFor` appends. It never throws: a failure is a word in the line, not a reason to take the row back. A repository with no lockfile, a tree with `node_modules` and an adopted tree are untouched. The probe uses `node --test`, not `tsx`, which is not a dependency.
- **`src/row-claim-installs-worktree.test.ts`**: eight cases over real scratch repositories and a real `git worktree add`, with a recording `exec`.
- **Not touched, as the row says**: `.github/workflows/ci.yml`; the lockfile and its by-name install are two places until a follow-up joins them.

Outside-Region: .changeset/an-agent-org-worktree-is-provisioned-from-a-lockfile-871.md — the changeset every change to this package carries; not in the row's Region
Outside-Region: .acceptance/agent~an-agent-org-worktree-agent-org-871.md — the PR's own acceptance file (ADR 0044); not in the row's Region
Outside-Region: pnpm-lock.yaml — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository, and this tree is a11ign/agent-org (`--repo a11ign/agent-org`); the file IS in the row's Region
Outside-Region: src/row-claim.ts — same: unkeyed in the row's Region; the file IS in it
Outside-Region: src/row-claim-installs-worktree.test.ts — same: unkeyed in the row's Region; the file IS in it

## How you verified it

Measured on this host, at this head, with `AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json`.

- The Acceptance, as written: `git grep -q "POSITIVE CONTROL"` exits 0; `node --test` prints `tests 8, pass 8, fail 0`.
- `pnpm install --frozen-lockfile --ignore-scripts` accepted the lockfile in this worktree and produced `node_modules/.bin/rstest`.
- `tsc --noEmit -p tsconfig.json`: no errors.
- Whole suite (`rstest run --config scripts/rstest/rstest.config.ts`): 60 of 9291 tests fail in 13 files; the same 13 files fail the same 60 tests on `origin/main` (measured in a clean worktree of it), so they are not this change's. `no-npm-spawn.test.ts` and `remedies-say-pnpm.test.ts` are green and unedited.
- **Not measured: the live reading.** A worker's first claim after this merges runs it; this row's own tree was provisioned by hand.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/row-claim-installs-worktree.test.ts
AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/row-claim-installs-worktree.test.ts
```

Mutation: the install skipped (`installLockedDependencies` returns null first) -> 4 red (the positive control, the failing install, the `not ready` case, the no-stderr case), the other 4 green. Restored from a copy taken before; `diff` showed it byte-identical.
