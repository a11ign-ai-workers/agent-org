A refused issue read in the claim records WHY `gh` failed (a11ign/a11ign#5282, class `claim-refused`; agent-org#1246). `fetchLabels` and `fetchClaimComments` in `src/row-claim.ts` put gh's first stderr line on the refusal's first line, as `(gh said: …)`, and the failure ledger keeps that first line, so a rate limit, a missing issue and a 401 no longer read the same. With gh silent, the refusal and the ledger line read exactly as before.

Note on the row's own Acceptance: the row says `cd ~/repos/agent-org && node --test …`, which is the primary clone and would test `main`. The command below is run from the checkout the PR is in.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/row-claim-refusal-cause.test.ts
git grep -q "NEGATIVE CONTROL" -- src/row-claim-refusal-cause.test.ts
node --test src/row-claim-refusal-cause.test.ts
```

Closes a11ign/agent-org#1246

Measured, at this branch's base 890366a4 plus this change:
- Before the change, `node --test src/row-claim-refusal-cause.test.ts`: the two POSITIVE CONTROL tests fail (the refusal's first line has no `rate limit`, and the ledger line has none), the NEGATIVE CONTROL passes. `tests 3, pass 1, fail 2`.
- After the change: `tests 3, pass 3, fail 0`.
- Mutation A, the cause removed (`ghSaid` returns ""): both POSITIVE CONTROL tests go red, NEGATIVE stays green.
- Mutation B, the cause added when gh is silent (`(gh said: none)`): NEGATIVE CONTROL goes red, POSITIVE stays green.
- Each mutation was run on a copy and the file restored byte-identical (`diff` empty).
- `pnpm run typecheck` (`tsc --noEmit`): exit 0.
- `pnpm test` (full rstest suite): 650 files, 11,011 tests, 4 failed. The same 4 fail with the original `src/row-claim.ts` (checked by swapping in the HEAD copy and restoring): `host-install-agent-org-launcher` (a placeholder `@@eventsPort@@`), two in `live-tree-independence` (`Cannot find module 'tsx/package.json'` in this worktree), and `release-tag-on-merge` (lockfile presence). They predate this change and are not in its Region.

Correction to the row's premise: `execFileSync` already puts a failed child's stderr on the thrown error (`.stderr`) and as the message's second line. Nothing was missing from the error. The ledger dropped it, because `recordClaimRefusal` keeps only the first line. `defaultRun` is unchanged.

Outside-Region: `.changeset/a-refused-issue-read-says-why-gh-failed-1246.md` (the changeset check requires one).

platform: `execFileSync`'s own error (`.stderr`), which already carries gh's text; nothing new is captured.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
