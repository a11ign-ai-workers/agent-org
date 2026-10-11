Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/merge-guard-reason-kind.test.ts'` prints `VERDICT pass: 5 tests in 1 file`: the three existing tests and two new ones, one per TESTS-FIRST reason shape.

**What changes.**
- `src/merge-guard/reason-kind.ts`: two patterns added to `REASON_KINDS`. `^TESTS-FIRST: #\S+ changes ` maps to `TESTS_FIRST_TESTS_MOVED`, and `^TESTS-FIRST: the FIRST commit of ` maps to `TESTS_FIRST_NOT_IN_FIRST_COMMIT`. The number is any non-space run because `merge-guard.ts` falls back to `#?` when the PR number is unknown.
- `src/packaging/merge-guard-reason-kind.test.ts`: one test per pattern. Each takes its reason from `testsFirstEditReasons`'s own output, not from a hand-written string, and asserts the kind and that it is not `UNCLASSIFIED`. They are separate from the shared case list so a removed pattern turns only its own test red.

Mutation: each pattern removed in turn, by `grep -v` into the file, with the original backed up to the scratchpad and restored by `cp` and proven byte-identical by `diff`.
1. `TESTS_FIRST_TESTS_MOVED` removed: 1 of 5 red, the failing test is "a TESTS-FIRST reason that a PR moved its named tests", actual `UNCLASSIFIED`.
2. `TESTS_FIRST_NOT_IN_FIRST_COMMIT` removed: 1 of 5 red, the failing test is "a TESTS-FIRST reason that the first commit lacks the named tests", actual `UNCLASSIFIED`.
3. Unmutated: 5 of 5 pass.

Measured: the Acceptance command at the parent head, before the change, printed `VERDICT pass: 3 tests in 1 file`. After the change it prints `VERDICT pass: 5 tests in 1 file`. `pnpm run typecheck` exits 0. `rstest run --changed=origin/main` prints `VERDICT pass: 1918 tests in 104 files`, measured on this branch after fetching `origin/main`. This package has no `lint` or `verify` script, so neither was run.

Closes a11ign/agent-org#1009

platform: n/a (two regex rows in the existing classifier; no platform feature classifies verdict reasons)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
