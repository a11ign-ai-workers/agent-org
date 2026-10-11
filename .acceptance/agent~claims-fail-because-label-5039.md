The claim path reads who holds what WITHOUT SEARCH (a11ign#5039, narrowed by the chairman's session at 13:12Z to the claim path). **The incident:** at 12:28Z on 2026-10-11 every claim was refused `B4 COULD NOT BE ASKED which rows are already claimed` (18 times in 30 minutes) because `lookupClaimedRegions` ran `gh issue list --label in-progress`, which `gh` sends as a GitHub SEARCH, and the scheduler App's installation had spent its search allowance with 3,948 GraphQL points left.

**What changes.**
- `src/ticket-port/rows-by-label.ts` reads `repository.issues(states:, labels:[$label])` over `gh api graphql`, a connection charged to the GraphQL points, and pages it. `lookupClaimedRegions` (B4), the sweep freeze's second look (`sweep-window.ts`), `lookupOtherHeldIssues` (B2, the session's rows are told apart by their `session:` label after the one read), `lookupChairmanRows` and the shared-failure incident rows (`ci-failure-class.ts`) all read through it. A failed read is still `null` (INCONCLUSIVE), never `[]`; a list that is not whole is refused.
- A read refused for a rate limit is remembered for the process (the tick) and not asked again; the line it leaves names the resource, from the refused response's own `X-Ratelimit-Resource` or one follow-up read of the GraphQL pool.
- `ci-failure-class.ts`'s read used to answer `[]` on a failure, which a tick read as "no incident row yet" and filed a second row for the same failure; it throws now, and the tick's own catch sends the orders as before.
- `readsOnce` in `row-claim.ts` folds the new read as it folded the old `issue list`, so the claimed rows are one read per claim.
- `src/packaging/no-search-reads.test.ts` is the guard.

**Not in this change (the narrowing, and the row says it finishes at its merge: its VERIFY row is filed by the pipeline).** The gate's own label reads in `work-gate.ts` (13 `"--label"`/`"--search"` arguments at `d34be138`), the per-tick volume cut with per-caller counts from the host ledger, and the scheduler's return to its App (a11ign#5044 step 3) are the follow-up row, after #5032 merges.

Mutation (four, run in a scratch copy of the tree, each restore `diff`-identical to a backup):
1. `--label` put back into `lookupClaimedRegions`: 10 red -- in `no-search-reads.test.ts` the POSITIVE CONTROL (the fake refuses the search), the NEGATIVE CONTROL and the source guard's NEGATIVE CONTROL (source); in `claimed-region-overlap.test.ts` its seven cases that read the claimed rows.
2. The refusal memory never set: 1 red, "a read refused for a limit is asked ONCE in a tick".
3. The source guard made to never fire: 1 red, its POSITIVE CONTROL (source), the fixture it must see.
4. The source guard made to always fire: 2 red, its NEGATIVE CONTROL (source) and the POSITIVE CONTROL (source), whose second half asserts a clean fixture passes.

Acceptance: `bash -c 'git grep -q "POSITIVE CONTROL" -- src/packaging/no-search-reads.test.ts && git grep -q "NEGATIVE CONTROL" -- src/packaging/no-search-reads.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/no-search-reads.test.ts src/claimed-region-overlap.test.ts src/packaging/row-claim-file-overlap-rule.test.ts'`
