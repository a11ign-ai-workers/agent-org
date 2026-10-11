A test file's `tmpDirForFile` directory is removed when the removal meets a failure or the fork exits before `after`, and a removal that still fails is that file's own failure, named by path.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/private-tmp.test.ts src/dora-budget-spent-is-not-a-timeout.test.ts'`

Mutation (each restored from a copy in the session scratchpad, `diff` identical; `rstest run` on the dora file, 12 tests): the `process.once("exit")` fallback not registered turned 1 red (the exit test); the first failure rethrown instead of collected turned 1 red (the others-still-tried test); the failure list never thrown turned 1 red (the named-failure test).

Measured: `VERDICT pass: 26 tests in 2 files` for the two files of the Acceptance; `npx tsc --noEmit -p tsconfig.json` reports nothing.

Not measured: the intermittent leak was NOT reproduced. Ten runs of the file (six at once) and a racing-writer script left nothing. The cause is inferred from the CI log, not reproduced: the leaked directory held `bin`, `full`, `no-tags` and one more entry, and `calls.log` (sorted before `full`) was missing, so the removal had begun and stopped; what stopped it is not known. The fix covers both candidate paths (a failure mid-removal, a fork that exits first), not a named one. `pnpm run verify` does not exist in this package; the full `test:org` suite was not run.

Closes a11ign/agent-org#987

platform: `rmSync`'s own `maxRetries`/`retryDelay` and the process's `exit` event; nothing else in node, pnpm or git removes a test's directory.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
