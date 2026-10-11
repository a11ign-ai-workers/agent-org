The board-truth audit reports a closed non-build child of an open epic whose children are all closed, when the child has no `Chairman-ruling: <url>` line whose URL is a comment by `DanBeckDev`. A child is non-build when its title starts `SPIKE`, `Decision` or `Measure`, or its Region lies wholly under `docs/`. The finding is `outcome-closed-by-non-build-row` and names the epic, the child and the missing field, with chairman-brief lines for `product-manager` to post; the audit posts nothing to the chairman. `readEpicChildren` makes one GraphQL read of the sub-issues per all-closed open epic, and one REST read of the author per non-build ruling URL. A refused, cut-short or failed read makes the whole question UNREAD (`epicChildren === null`), never agreement.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-881 && git grep -q "POSITIVE CONTROL" -- src/board-truth-audit.test.ts && git grep -q "outcome-closed-by-non-build-row" -- src/board-truth-audit.ts && AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/board-truth-audit.test.ts'`

Controls: POSITIVE CONTROL (a SPIKE child and a docs child, no ruling) gives one finding each. NEGATIVE CONTROLS: a ruling line present gives none; an all-build epic gives none; a ruling URL not by `DanBeckDev` still finds.

Mutation A: the `Chairman-ruling:` line ignored (`rulingHolds` always false) failed tests (2a), (2b) and (6). Mutation B: every docs child flagged each turn failed test (2b) only. `src/board-truth-audit.ts` restored byte-identical each time with `cp` from a scratch copy, proved by `diff`.

Measured: `node --test src/board-truth-audit.test.ts` gives 55 pass, 0 fail. Full `pnpm test` on this branch: 62 of 9633 failing; the same suite at HEAD of this branch: 60 of 9625 failing. The two extra are `src/packaging/gh-call-ratchet.test.ts` and `src/packaging/gh-call-inventory.test.ts`, which this change turns red (two counted gh call shapes in `src/board-truth-audit.ts`, calls 12 against baseline 10); the other 60 failing names are identical on both. `pnpm run lint` has no script in this repository (`ERR_PNPM_NO_SCRIPT`), so no lint was run. `pnpm run typecheck` exits 0.

Held: agent-org#840 is OPEN and declares the same two files, so the gate holds this row until #840 merges.

Closes a11ign/agent-org#881

platform: the audit reads GitHub's sub-issues API and comment authors through the injected `gh` runner; no new tracker is read.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
