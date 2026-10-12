The work gate decides once whether this process is the gate: `src/work-gate/tick.ts` loses its private copy `runningAsGate` and imports `isGateProcess` from `src/work-gate/reads.ts`, the copy that already held the same test (both compared `realpathSync(process.argv[1])` with `../work-gate.ts`). The two `realpathSync`/`pathToFileURL` imports that only the copy used go with it.

Acceptance: `bash -c '! git grep -q "function runningAsGate" -- src/work-gate/tick.ts && pnpm run typecheck && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import=./src/lib/crash-exit.ts --test src/work-gate-read-memo.test.ts'`

Measured: before the change, `git grep -c -E "function (runningAsGate|isGateProcess)" origin/main -- src/work-gate` printed one match in each of `reads.ts` and `tick.ts` (two); after it, one (`reads.ts`). The acceptance command exits 0: `pnpm run typecheck` exits 0, and the memo test prints `ℹ pass 14` and `ℹ fail 0`, including the test that imports `reads.ts` as the gate's own process and as a CLI, which exercises `isGateProcess` itself. The `tick.ts` call site runs at import, and the tests that import `tick.ts` (`src/gh-conditional.test.ts`, `src/packaging/keyed-chairman-row-spawn-slot.test.ts`) pass in the run below. `pnpm exec rstest run` over the 56 work-gate and tick-importing test files prints `VERDICT pass: 680 tests in 56 files` on the branch rebased onto `origin/main` at `b27e1c92`. Before the rebase, that run failed one test, `src/work-gate-other-scopes-concurrent.test.ts` (14 calls against 16 expected), which also failed with `src/work-gate/tick.ts` restored from the older `origin/main` (measured by swapping the file and restoring it byte-identical); the rebase brought in #1160 (agent-org#1147), whose commit `8dd4cd20` edits that test file.

Net: `tick.ts` 2 insertions, 18 deletions (16 lines fewer).

Closes a11ign/agent-org#1146

platform: n/a (a deletion of a duplicate; no platform feature decides whether a Node process is the script it was started as)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
