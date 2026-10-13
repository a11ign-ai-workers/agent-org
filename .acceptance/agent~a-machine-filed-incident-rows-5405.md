`recordIncident` (`src/ci-failure-class.ts`) files each `ci-shared-failure` incident row with a bare `gh issue create`, so the row never reaches Project 1 and `row-off-board` orders product-manager to board a row with no Region or Acceptance (a11ign/a11ign#5405). The row is now boarded as it is filed: the card on Project 1, Status `Backlog`, then the `out-of-release` and `backlog` labels last, the same calls `row-file --board` makes. A refused board step leaves the row NOT filed, so the next tick joins the open row and boards it, because it does not yet carry `out-of-release`. The body says it is a SIGNAL for `orchestrator` and carries no claimable work.

Acceptance:

```bash
cd ~/repos/agent-org && node --test src/ci-failure-class-boards.test.ts
```

Closes a11ign/a11ign#5405

Measured: the command above printed `pass 3, fail 0` at this head (rebased onto the fetched main tip b7bf31ac). `pnpm exec rstest run` over `src/ci-failure-class-boards.test.ts`, `src/ci-failure-class.test.ts` and `src/packaging/gh-call-ratchet.test.ts` printed `VERDICT pass: 40 tests in 3 files`. Mutations, each run and reverted to the committed file: (A) the filed row is not boarded -- the card-then-Backlog test and the refused-board test fail; (B) the next tick never boards the row it joins -- the refused-board test fails; (C) a row already carrying `out-of-release` is boarded again -- the already-boarded test fails.

Outside-Region: docs/gh-call-baseline.json — `src/ci-failure-class.ts` calls 13 -> 16. The three board calls are the rise; `gh-call-ratchet.test.ts` refuses a file holding more call shapes than its entry, and the ratchet's documented route for a plain rise is this edit. Moving those calls behind `src/ticket-port/` is a follow-up, not this row.
Outside-Region: src/ci-failure-class.test.ts — the existing `ghFake` answered every `issue edit` as a body write, so the label-only edit now in `recordIncident` wrote `issue` into the fake row body. The fake now takes a body only from an edit that carries `--body`; no assertion changed.

Not verified here: the board write on the live Project 1 (done-when 1 holds once the merged gate has run). The first shared-failure incident filed after merge is the live reading. The full `pnpm test` shows 5 failures in 4 files (`host-install-agent-org-launcher`, `live-tree-independence`, `multi-board-gate`, `release-tag-on-merge`); the same five fail on `origin/main` in a clean worktree, so they are not caused by this change.

platform: Project 1 `item-add` and `item-edit` through `gh project`, the calls `row-file --board` already makes; nothing built beside them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
