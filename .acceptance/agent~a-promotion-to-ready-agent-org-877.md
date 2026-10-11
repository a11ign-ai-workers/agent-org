Promoting a backlog row whose `## Region` names a directory its repository lacks is refused through `promoteRefusalReason`, naming the directory and the repository that holds it; a keyed Region token is read by `regionPathTokens` in `src/region-paths.ts`, and `src/row-file.ts` holds no second reader.

Closes a11ign/agent-org#877

## What changes, and why

`promoteRefusalReason` never asked whether a Region's top-level directories exist in the row's repository, so a row promoted from backlog skipped the refusal #855 added at `--ready` filing. It now calls `absentRegionTopDirReason` (with `act: "promote"`, so the wording says "promote") after the template-field and filing checks pass. `promoteRefusalReason` takes an optional third argument carrying the injected seams.

The keyed-token regex and its loop move out of `row-file.ts` into `regionPathTokens(body)` in `src/region-paths.ts`, the one reader; `absentRegionTopDirReason` uses it. A keyed entry whose clone is not declared on the host is still not checked (#2623).

## How you verified it

- `AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/ready-region-repo-promote.test.ts`: 5 of 5 pass.
- `node --test src/ready-region-repo.test.ts` (the #855 filing tests, unchanged): pass.
- `pnpm run typecheck`: exit 0. `node -e "import('./src/row-file.ts')"`: imports.
- `src/packaging/row-file.test.ts` and `src/packaging/row-file-bare-rstest-run.test.ts`: 8 failures here and 8 on a clean `origin/main` worktree (measured, same two files), so none is introduced by this change.

Acceptance: `git grep -q "POSITIVE CONTROL" -- src/ready-region-repo-promote.test.ts && node --test src/ready-region-repo-promote.test.ts`

Mutation: `const absent = absentRegionTopDirReason(body ?? "", { ...absentDeps, act: "promote" });` replaced by `const absent = null;` turns 3 of 5 tests red (the POSITIVE CONTROL, the keyed refusal, the unreadable-origin refusal); the 2 acceptance cases stay green. Restored byte-identical (diffed).

## Anything a reviewer should be sceptical of

- The gate half (`incompleteRowOrders`) is not touched, as the row says.
- Promotion reads `origin/main` of the local clone, as filing does; an unfetched clone can refuse a directory main just added.
