A refusal that is the claim guard working is now `claim-guard-held`, not `claim-refused`. `claimRefusalKind` (`src/row-claim.ts`) matches the refusal text against four guard texts: the worktree cap (`live worktrees, at or over the cap of`), a tree or branch that already exists (`ALREADY EXISTS`), a B4 overlap (`overlaps #N` / `overlaps the Region of #N`), and a read the rate limit refused (`rate limit`). Those are written under the new kind `CLAIM_GUARD_HELD_KIND` (`src/failure-ledger.ts`). The four failures of the claim path (an unreadable read, B4 not askable, a rule copy behind the release, an unknown tracker key) stay `claim-refused`. Anything not named is a failure, so a new guard refusal counts until it is named.

`class-repeat.ts` leaves `claim-guard-held` out of `groupByClass`, as it leaves out `UNCLASSIFIED_KIND`, so the guard working is no class and no repeat. `readClaimRefusals` (`src/org-health.ts`, signal 26) reads both kinds, so the storm count still sees every refusal. The ref of each line is unchanged: the refusal's first line, with tabs spaced, as today.

Acceptance: `node --test src/row-claim-refusal-kind.test.ts`, run from the worktree (`~/repos/agent-org` is the primary checkout).

Measured: the acceptance command above, 5 of 5 pass.

Fail before, pass after, and mutation, in both directions, with `src/row-claim.ts` restored byte-identical each time (`diff` against a scratch copy):
- classifier always `claim-refused` (the split forced off): 2 of 5 fail, both guard-held controls (the positive control and the negative control), as they should.
- classifier always `claim-guard-held`: 2 of 5 fail, both failure controls (the positive control and the negative control).

Affected suites, `node --test` from the worktree: `row-claim-refusal-cause`, `row-claim-refusal-record`, `claim-refusal-storm`, `class-repeat`, `failure-ledger`, `row-claim-refusal-kind`: 69 of 69 pass. `row-claim-worktree-cap`: 4 of 4 pass. `pnpm run typecheck` exits 0. This repository has no `lint` or `test:org` script. The full rstest run (`npx rstest run --config scripts/rstest/rstest.config.ts`) gives 11070 of 11076 tests passing in 657 files, with 4 failing in 3 files, none of which imports a changed module: `host-install-agent-org-launcher` (an `@@eventsPort@@` placeholder in the host config), `live-tree-independence` (a missing `tsx` package in this worktree's `node_modules`), and `release-tag-on-merge` (it expects no `pnpm-lock.yaml`, and one is in the tree). Those are the environment and repo state, not this change, and I did not run them on `main` to confirm.

Named, not changed here: `.agent-org/failure-classes.json` in `a11y-witness` still says a `claim-refused` refusal is the claim guard working. That file lives in another repository and the row says read it only, so its guardNote is left as it is.
