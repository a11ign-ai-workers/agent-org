A worktree the claim makes is provisioned from the committed lockfile: `row-claim claim --branch --worktree` runs `npm ci --ignore-scripts` in the new tree when it has a `package-lock.json` and no `node_modules`, and says `installed` or `install failed: <first error line>` in its line (a11ign/agent-org#851, a11ign#4957 cause 2).

Closes a11ign/agent-org#851

## What changes, and why

A fresh worker's Acceptance (`node --test`, `rstest`) found no `node_modules` in the tree the claim made and exited 1 before it tested anything; agent-org#816 stopped on exactly that. The repository committed no lockfile, so there was no source of truth for what to install.

- **`package-lock.json`**: generated with `npm install --package-lock-only --ignore-scripts` from `package.json` alone (34 packages; `@a11ign/toolchain` 0.7.1, the version `ci.yml` pins by name). `npm ci --dry-run` accepts it.
- **`src/row-claim.ts`**: `claimWithWorktree` takes an `exec` (default `npm` run with a `cwd`, which `run` cannot say). After the claim is RECORDED, `installLockedDependencies` runs `npm ci --ignore-scripts` in the tree when it has a `package-lock.json` and no `node_modules`, and the result carries `install`. `claimLineFor` appends `/ installed` or `/ install failed: <line>`, and the CLI hands it the result's `install`. It never throws: a failed install is a word in the line, not a reason to take the row back. A repository with no lockfile, a tree with `node_modules` and an adopted tree (which holds somebody's work) are untouched.
- **`src/row-claim-installs-worktree.test.ts`**: seven cases over real scratch repositories and a real `git worktree add`, `npm` replaced by a recorder.
- **Not touched, as the row says**: `.github/workflows/ci.yml` (a workflows Region derives `lane:ceo`). The lockfile and the by-name pin are two places until a follow-up joins them.

Outside-Region: package-lock.json — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign), and this tree is a11ign/agent-org (`--repo a11ign/agent-org`); the file IS in the row's Region
Outside-Region: src/row-claim.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign), and this tree is a11ign/agent-org (`--repo a11ign/agent-org`); the file IS in the row's Region
Outside-Region: src/row-claim-installs-worktree.test.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign), and this tree is a11ign/agent-org (`--repo a11ign/agent-org`); the file IS in the row's Region
Outside-Region: .changeset/an-agent-org-worktree-is-provisioned-from-a-lockfile.md — the changeset every change to this package carries; not in the row's Region

## How you verified it

Measured on this host, at this head, with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json`.

- The Acceptance, as written: `git grep -q "POSITIVE CONTROL"` exits 0; `node --test` prints `tests 7, pass 7, fail 0`.
- **Real install, not only the recorder**: a scratch repository committing this `package.json` and `package-lock.json`, claimed through `claimWithWorktree` with no `exec` injected, returned `"install":"installed"` and the new tree held `node_modules/yaml` and `node_modules/.bin/rstest`.
- Neighbours: `row-claim.test.ts`, `row-claim-writes.test.ts`, `row-claim-reads-together.test.ts`, `packaging/row-claim-merged-branch.test.ts`, `packaging/multi-board-claim.test.ts`, `work-gate-claim-stalled.test.ts`: 213 of 213.
- `tsc --noEmit -p tsconfig.json`: no errors.
- **Not measured: the live reading.** A worker's first claim after this merges and the host's checkout runs it; this row's own tree was provisioned by hand.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/row-claim-installs-worktree.test.ts
node --test src/row-claim-installs-worktree.test.ts
```

Mutation: the install skipped (`installLockedDependencies` returns null) -> 3 red (the positive control and both failing-install cases), the 4 others green; installed with no lockfile -> 1 red (the no-lockfile case); installed over an existing `node_modules` -> 1 red (the modules case); a failed install thrown out of the claim -> 2 red (both failing-install cases). Each restored from a copy taken before and `diff` showed it byte-identical.
