`recordIncident` (`src/ci-failure-class.ts`) files each `ci-shared-failure` incident row with a bare `gh issue create`, so the row never reaches Project 1 and `row-off-board` orders product-manager to board a row with no Region or Acceptance (a11ign/a11ign#5405). The row is now boarded as it is filed: the card on Project 1, Status `Backlog`, then the `out-of-release` and `backlog` labels last, the same calls `row-file --board` makes. A refused board step leaves the row NOT filed, so the next tick joins the open row and boards it, because it does not yet carry `out-of-release`. The body says it is a SIGNAL for `orchestrator` and carries no claimable work.

Acceptance:

```bash
node --test src/ci-failure-class-boards.test.ts
```

Closes a11ign/a11ign#5405

Acceptance note: the row writes `cd ~/repos/agent-org && node --test ...`. A leading `cd` runs in the primary checkout (`~/repos/agent-org`, detached at v0.191.2), which does not hold this test until it merges, so the row's form cannot pass from this branch. The command above runs in this branch's own tree, which is what the PR's Acceptance means. Product-manager should correct the row's command.

Mutation: each run on this branch and reverted to the committed file. (A) the membership guard in `boardIncident` removed, so every retry adds the card: 2 of 6 fail. (B) `recordIncident` ignores a refused heal board: 1 of 6 fails. (C) the `out-of-release` guard in `healBoard` removed: 1 of 6 fails.

Measured: `node --test src/ci-failure-class-boards.test.ts` printed `pass 6, fail 0` at this head. Also run: `node --test src/ci-failure-class.test.ts` (29/29), `node --test src/row-file-board.test.ts` (33/33), `node --test src/event-drift.test.ts` (14/14), `node --test src/packaging/gh-call-ratchet.test.ts` (8/8), and `pnpm run typecheck` (exit 0). rstest is NOT the evidence here: it reports "No test suites found" for node:test files, so the earlier rstest count is withdrawn. At the port fix: `ticket-port.test.ts` with the board, `ci-failure-class`, `row-file-board`, the gh-call ratchet and event-drift files, 109/0; and the 66 test files that import the changed modules, 2162/0, with `pnpm run typecheck` exit 0.

Outside-Region: docs/gh-call-baseline.json — `src/ci-failure-class.ts` calls 13 -> 16. The three board calls are the rise; `gh-call-ratchet.test.ts` refuses a file holding more call shapes than its entry, and the ratchet's documented route for a plain rise is this edit. Moving those calls behind `src/ticket-port/` is a follow-up, not this row.
Outside-Region: src/ci-failure-class.test.ts — the existing `ghFake` answered every `issue edit` as a body write, so the label-only edit now in `recordIncident` wrote `issue` into the fake row body. The fake now takes a body only from an edit that carries `--body`, and answers the Project-membership read with no items; no assertion changed.
Outside-Region: src/packaging/work-gate-shared-failure.test.ts — its `fakeGh` answered the incident path's Project-membership read with an unparsable reply, so the joined-row board refused and the holds were released; the fake now answers that read with no items, as `ci-failure-class.test.ts` does. No assertion changed. On origin/main the file is 8/8; on this branch 4 of its 8 failed before the fake change and all 8 pass after it.
Outside-Region: src/row-file.ts — the Project-membership read (`projectItemsPage`, its paging, `PROJECT_ITEMS_PAGE`, `boardItemOf`, `isBoardOf`) moves unchanged to `src/ticket-port/project-membership.ts`, and `fetchIssueBoardStatus` keeps its shape, reading through `boardItemOf`. `row-file-board.test.ts` 33/33.
Outside-Region: src/ticket-port/project-membership.ts — new. The retry needs "is on the board at all" (`isIssueOnBoard`), which `fetchIssueBoardStatus`'s `null` cannot give: on the board with no Status reads the same as absent. It lives in the port and spawns nothing: the caller hands in the `gh` reader (`read`), because `ticket-port.test.ts` #484 refuses any port file other than the adapter that imports `child_process` or names `gh`, which the first version did and CI caught. It imports only `project-config.ts`: `ci-failure-class.ts` importing `row-file.ts` closed a cycle (`work-gate.ts` → `org-retro.ts` → `ci-failure-class.ts` → `row-file.ts` → `row-claim.ts` → `work-gate.ts`) that crashed `src/work-gate/claim-stall-tick.ts` at load, which broke the suite's `closes-mismatch-check` step.

Not verified here: the board write on the live Project 1 (done-when 1 holds once the merged gate has run). The first shared-failure incident filed after merge is the live reading. The full `pnpm test` shows 5 failures in 4 files (`host-install-agent-org-launcher`, `live-tree-independence`, `multi-board-gate`, `release-tag-on-merge`); the same five fail on `origin/main` in a clean worktree, so they are not caused by this change.

platform: Project 1 `item-add` and `item-edit` through `gh project`, the calls `row-file --board` already makes; nothing built beside them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
