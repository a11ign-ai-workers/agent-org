`claimOrdersIn` strips NUL bytes from a claim-orders line before it parses it, so an entry written whole after a torn-write run of NULs is read and counted, and a line that is only padding is skipped without the "skipped an unreadable line" warning the work-tick repeated on every tick (agent-org#1065). A line that still does not parse once its padding is removed warns, as before.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1065 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/claim-orders-nul.test.ts'`

History: full

Mutation: the `replaceAll` strip removed (the line parsed raw) failed 2 of 3 tests (the NUL-prefixed entry and the pure-padding line); `if (true) continue;` in place of the padding check failed 3 of 3 (the torn-JSON control included). Each file restored byte-identical (`diff` against a copy).

Measured: the new file `VERDICT pass: 3 tests in 1 file`, and before the change it failed 2 of 3 (the torn-JSON control passed, as it should). `wake-calm-arm`, `wake-round-trips-arm` and `engineer-escalation`: `VERDICT pass: 53 tests in 3 files`. `pnpm run typecheck` exit 0. Full `pnpm test`: `VERDICT fail: 19 of 10398 tests failed in 590 files`; the same 19 fail with the original `src/wake.ts` restored (`VERDICT fail: 19 of 182 tests failed in 11 files`, the same ids: org-health, live-tree-independence, release-tag-on-merge, wait-condition, release-behind-main, work-gate-other-scopes-concurrent, worker-stop-hook), so they are not this change's. Not checked: that they also fail on `origin/main` itself, which was not run here. Read-only against the real `/home/agent/.cache/a11ign/claim-orders`: one unparseable line (1378), 329 claims, 0 warnings after the change (1 before). Line 1378 is NOT all NUL: it is a 353-byte NUL run in front of one complete `arm` record, so the row's "all `\x00`" premise did not hold, and the strip is what silences it.

Not here, and named: the repeating-line digest is the gate's, read on the next ticks after merge and not measured in this worktree.

Closes a11ign/agent-org#1065

platform: none checked beyond `JSON.parse` on the record; the fix is one line of string handling in the existing reader.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
