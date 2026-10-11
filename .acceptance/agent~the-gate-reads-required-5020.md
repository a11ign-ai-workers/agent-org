The gate and the queue table read the required checks from the rulesets (a11ign/a11ign#5020). `readRequiredContexts` in `src/work-gate.ts` is the one reader: it unions the contexts of every `required_status_checks` rule in `repos/{repo}/rules/branches/main`, falls back to `branches/main`'s classic list only when the rulesets give none, and answers `null` (unknown, fail open) when neither does. `requiredCheckNames` (`work-gate.ts`) and `requiredContexts` (`queue-table.ts`) both call it.

Acceptance:

```bash
git grep -q "requiredContexts reads the RULESETS when classic protection is gone" -- src/packaging/queue-table.test.ts
bash -c 'cd ~/repos/agent-org-wt-5020 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/queue-table.test.ts'
```

Closes a11ign/a11ign#5020

Measured: the rstest command above (`queue-table.test.ts`, which drives the shared reader through a fake `gh` that routes by endpoint) is the one CI's job can run, because `work-gate.test.ts` calls `shippedUnits` and needs git history. Run locally with `work-gate.test.ts` beside it, at this head: `VERDICT pass: 533 tests in 4 files` (with the two gh-call tests). Mutations, each run and restored byte-identical (`diff` empty): (1) the ruleset source never answers -- the ruleset-only, union and `requiredContexts` tests fail; (2) the classic fallback never answers -- the classic-only and the two #2331 read-through tests fail; (3) an empty list is accepted as usable -- the neither-source and fail-open controls fail (7 tests); (4) rules of every type are read, not only `required_status_checks` -- only the union test fails.

Outside-Region: `docs/gh-call-inventory.json`, regenerated with `node src/packaging/gh-call-inventory.ts` (`api rest` call sites 145 -> 144: `queue-table.ts` lost its private read, and `work-gate.ts` keeps one call site for both sources so `gh-call-baseline.json` is unchanged). `.changeset/the-gate-reads-required-checks-from-rulesets.md`.

Not done: the live reading (done-when 2, no `CANNOT READ the required checks` line in the tick journal after deploy) waits for the deploy. Not rerun here: the full suite has 4 failures that also fail on unmodified `origin/main` at e1b851b2 (`live-tree-independence` x2, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`), measured by running those files in a clean worktree of it.

platform: GitHub's own `rules/branches/main`, which merges every ruleset that applies to the branch; nothing built beside it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
