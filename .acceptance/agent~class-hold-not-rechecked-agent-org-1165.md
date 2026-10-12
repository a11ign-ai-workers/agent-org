The work gate's shared-file ordering (`src/work-gate/shared-file-orders.ts`) re-checks a hold against the current files, and puts an approved, green pull request ahead of an unapproved one that opened earlier. Both behaviours and a DIRTY-against-`main` rebase order sit behind `holds.recheck`, shipped OFF; with the flag off the ordering is today's, pinned by a digest taken from HEAD over the same four fixtures.

Acceptance: `node --test src/work-gate/shared-file-orders-recheck.test.ts`

Mutation: four mutants of `shared-file-orders.ts`, each caught by the test for its own behaviour; the source was restored byte-identical after each (`diff` against a copy).

Measured: `node --test src/work-gate/shared-file-orders-recheck.test.ts`: 10 tests, 10 pass. `node --test src/work-gate-shared-file-orders.test.ts` (the existing suite, unchanged): 17 pass. `pnpm run typecheck`: exit 0. Full `pnpm test`: 5 of 10778 tests fail in 628 files, the same five that fail on HEAD's source (`host-install-agent-org-launcher` test 3, `live-tree-independence` two tests, `release-tag-on-merge` lockfile check, and `org-health` "THE GATE AS A PROCESS", which also now lists `holds.recheck` in its flag-without-a-switch digest; that line needs a switch row, outside this Region).

Not here, and named: `pnpm run verify` and `pnpm run lint` do not exist in this repository, so the role's "verify green" gate was not run as written; `typecheck` and the full `test` stand in for it. The flag is not yet wired into `perPullRequestOrders` (`src/work-gate/pr-orders.ts`) or `tick.ts`, both outside the Region, so the default-off call path is the only one that runs.

platform: reuses `reviewStateOf` and `mergeCandidates` from `src/work-gate/pr-state.ts`; no new GitHub read and no new machinery.
