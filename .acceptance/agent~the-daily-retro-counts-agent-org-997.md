The daily retro counts two things nothing counted before: red PRs the gate held as a shared failure and then released (from the tick journal's `ci-shared-failure: holding …` and `ci-shared-failure: released …` lines), and `ci-shared-failure` incident rows closed as "not the same failure". Each count above 0 files an incident through `recordFailures` in `dailyRetrospective`. A count nobody could read renders as `unknown`, never 0. `src/org-retro.ts` gains the reads, the report fields, the rendered lines and the two ledger kinds; `src/org-retro-shared-failure.test.ts` pins the counts by hand against fixtures.

Acceptance:

```bash
grep -c "held-then-released" src/org-retro.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/org-retro-shared-failure.test.ts'
```

Closes a11ign/agent-org#997

Measured: the test command above printed `VERDICT pass: 10 tests in 1 file` in the worktree, and the grep printed `1`. Mutations, each run and reverted byte-identical: all six were caught by the tests.

Choices: the count reads the gate's existing log lines, so `src/ci-failure-class.ts` is unchanged, and a source test pins the words it reads. "Not the same failure" is matched on the closing comment's words, because no code writes that sentence. The closed-row read is capped at 500 rows, and a row with more comments than its first page of 100 refuses the whole read (its closing comment may be past the page); either way the count is `unknown`. `src/packaging/org-retro-tick-budget.test.ts` pinned the retro's class count at 14; the new class makes it 15 and the test's intent is unchanged.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
