Closes a11ign/agent-org#1172

The count the daily reading needs for #5153 item 5: hand-filed pin or bump rows in the last 7 days, and per repository the open Renovate PRs older than 60 min and those with a red last check. `src/pin-bump-measure.ts` is a pure leaf that the caller feeds; a refused read is `unknown`, never 0.

**What changes.**
- `src/pin-bump-measure.ts`: `handFiledPinRowCount` (bot authors excluded, an undatable row makes the count `null`), `renovateCountOf` (`app/renovate`, `renovate[bot]` and plain `renovate`; red is `isBrokenRed` from `red-pr.ts`), `pinBumpMeasure` and `pinBumpLine`, the line the reading posts on #928.
- `src/pin-bump-measure.test.ts`: the positive control (one hand-filed pin row reads 1, none reads 0), the pattern, the bot and window exclusions, the strict age threshold, and the unknown paths.

**Not in this PR (outside the Region, left on the row):** the machinery flag in `FLAG_REGISTRY` (`src/machinery-flag.ts`) and `FLAGS_WITH_ANOTHER_HOME` (`src/flag-switch-ledger.ts`), and the wiring into `src/org-health.ts` that puts the line on #928. Done-when 2 is open until those are in a Region.

**Assumptions, said so:** "hand-filed" is read as "not filed by a bot account"; "stuck" is open more than 60 min, and "failed" is a red last check, reported as two figures and not merged.

Mutation: never count a pin row (positive control and the pattern test red); always count (positive control and the unrelated-row test red); count bot-authored rows (bot test red); threshold non-strict (threshold test red); red ignores the checks (the red test and the line test red). Each restored byte-identical against a copy in the scratchpad (`cmp`).

Evidence: the Acceptance command below passes, 10 of 10, at this head. `pnpm run typecheck` exits 0. The full rstest run (`pnpm run test`, 11004 tests in 649 files) lists my 10 tests as passing and 4 failing elsewhere (host-install launcher, live-tree-independence x2, release-tag-on-merge): none imports this module, and the release-tag failure is about `pnpm-lock.yaml`, which `origin/main` tracks.

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-1172 && node --import=./src/lib/crash-exit.ts --test src/pin-bump-measure.test.ts'`

platform: n/a (a count over tracker rows and PRs; no platform feature computes a weekly pin count)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
