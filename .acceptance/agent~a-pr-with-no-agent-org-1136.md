A PR with no label on a branch naming an open unheld row is owned by `product-manager` (`owner-gone`), not recorded `owner-unresolved` (a11ign/a11ign#5201, the tenth occurrence).

**What changes.**
- `pr-owners.ts`: `withClosingRowOwners` calls `rowsNobodyHolds` for any PR no row rung answered, labelled or not. `closingRowsNone` is set only for an ENDED label on a PR that closes no row, so an unlabelled PR that names no row (no closing reference, no suffix) still falls to `ceo` and is recorded.
- `pr-orders.ts`: the owner-gone order says `it carries no session: label, and the row it names is open and no session holds it` for an unlabelled PR, never `ENDED`.
- `pr-owner-gone.test.ts`: #5201 positive case, held-row control, no-row control and order-wording test.
- `pr-owner-total.test.ts`: outside the listed Region. The grid oracle pinned the old rule, so an unlabelled PR with a named row that nobody holds is now `product-manager` in the grid too.
- `work-gate-unlabelled-pr-owner.test.ts` and `work-gate-cross-repo-pr-owner.test.ts`: outside the listed Region. They pinned unlabelled PRs naming unheld rows to `ceo`; those now go to `product-manager`. The no-row and unread-rows controls stay `ceo`.

**Assumptions, said so:**
- An unlabelled PR whose named row is CLOSED (absent from the open list) is also owner-gone. The shared `rowsNobodyHolds` makes no distinction, and it matches a dead owner's closed row (#4626). The row's done-when names only open-and-unheld; a reviewer who wants closed-row unlabelled PRs to stay `ceo` should say so.
- The five full-suite failures in `live-tree-independence`, `release-tag-on-merge`, `work-gate-other-scopes-concurrent` and `worker-stop-hook` fail identically on a clean checkout of the base commit (pre-existing, not this change).

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-1136 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/pr-owner-gone.test.ts'`

Done when:
1. The Acceptance passes and the PR is merged.
2. In `pr-owner-gone.test.ts`, an unlabelled PR on branch `agent/<slug>-<n>` with row n open and unheld is `{session:"product-manager", source:"owner-gone"}`; the control with row n held by a live session gives that session; the control whose branch names no row (the `fix-typo` shape, which closes no row) stays `ceo`.
3. The order sentence for the unlabelled shape does not contain "ENDED".

Closes a11ign/agent-org#1136 (a11ign/a11ign#5201).

Flag: none -- a fix to which row an unlabelled PR is routed by, covered by the row's tests; no separate switch in the row's Region
Health-signals: claims-refused, wakes-held
Revert: revert this PR

platform: n/a (routing in the work gate's owner ladder; no platform feature)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
