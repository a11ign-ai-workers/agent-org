The daily reading on #928 quotes the hand-filed pin/bump row count and the stuck Renovate PR count, behind the machinery flag `retro.pinBump` (default OFF, agent-org#1245). The flag is registered in `FLAG_REGISTRY` (`src/machinery-flag.ts`) and listed in `FLAGS_WITH_ANOTHER_HOME` (`src/flag-switch-ledger.ts`). With the flag ON, `buildReport` reads the home repository's issues (a plain list, never a search, #5074) and each population repository's open PRs, and `renderReport` puts `pinBumpLine` after the red lines. With the flag OFF no pin read is made and the report is the same bytes as before.

Acceptance: `node --import=./src/lib/crash-exit.ts --test src/packaging/machinery-flag-switch.test.ts src/packaging/flag-switch-ledger.test.ts src/pin-bump-measure.test.ts src/org-retro-pin-bump.test.ts src/packaging/org-retro.test.ts`

Measured: `ℹ tests 77`, `ℹ pass 77`, `ℹ fail 0` for the file set above in this worktree. `pnpm run typecheck` exits 0. The flag-OFF report was compared with HEAD's on the three report fixtures and is byte-identical. The full `pnpm run test` run had 7 of 11,235 tests failing in 5 files (`host-install-agent-org-launcher`, `live-tree-independence` x2, `multi-board-gate`, `release-tag-on-merge`, `row-claim-refusal-record` x2). The same 7 tests fail at HEAD in those 5 files (7 of 35), so they predate this change.

Not run: a mutation pass for this change. The worktree has no `lint` or `verify` script, so no lint result is claimed.

Closes a11ign/agent-org#1245

platform: n/a (no GitHub, pnpm, systemd or git feature does this; the count is a pure leaf fed by the existing `gh` list and PR reads)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
