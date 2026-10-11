A pull request whose owner session ENDED and which names no row (`Closes: none`) resolves to `product-manager` with source `owner-gone`, and its order says the owner ended and that the PR closes no row. Before this change `rowsNobodyHolds` returned no flag for a PR that names no row, so the owner-gone rung never saw it and the PR fell to `ceo` as owner-unresolved and was recorded (a11ign/a11ign#5115, eighth occurrence).

`rowsNobodyHolds` now returns `closingRowsNone` when the open-rows read is non-empty and the PR names no row. `ownerOfPr` takes that flag at the owner-gone rung, and `deadOwnerRowClause` words it as "it closes no row". An empty open-rows read still returns no flag, so a refused read stays `ceo` and is not flagged.

Controls, each in `src/packaging/pr-owner-gone.test.ts`: the same PR with a live label keeps `label`; an open row held by a live session keeps `closing-row`; a PR with no label stays `ceo` and is recorded; an empty rows read stays `ceo` and is not flagged.

Mutation: two, each turns its own tests red and each restore was byte-identical (`cmp` against a copy in the session scratchpad, never `git checkout --`). A no-row PR returns `{}` again: 3 tests red, all #5115. An empty rows read returns `closingRowsNone`: 2 tests red, both CONTROL empty-read tests.

Evidence: the two #5115 owner tests were red before the change and are green after. `node --test src/packaging/pr-owner-gone.test.ts`: 18 of 18 pass. `tsc --noEmit -p tsconfig.json` exits 0. Full `pnpm test` (rstest): 11 of 10255 tests fail, all in six files, none of them in the owner ladder (live-tree-independence, org-health-queued-lab-jobs, release-tag-on-merge, wait-condition, work-gate-other-scopes-concurrent, worker-stop-hook). The same six files give "11 of 70 tests failed" with the change and with it reverted, and the failing test names are identical in both runs.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1020 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/packaging/pr-owner-gone.test.ts'`

Closes a11ign/agent-org#1020

🤖 Generated with [Claude Code](https://claude.com/claude-code)
