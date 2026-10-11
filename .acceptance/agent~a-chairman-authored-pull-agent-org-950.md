`ownerOfPr` has a `chairman-author` rung: a chairman-authored pull request with no label and a branch naming no row names `ceo` with source `chairman-author` and is absent from `unresolvedOwnerEvents`; the same pull request authored by the worker account is still `ceo` source `ceo` and IS recorded; a chairman pull request carrying a live `session:<s>` label still names `<s>`.

Acceptance:

```bash
git grep -q "CONTROL: the same pull request authored by the worker account" -- src/packaging/pr-owner-chairman-author.test.ts
git grep -q "CONTROL: a chairman's pull request carrying a live session label" -- src/packaging/pr-owner-chairman-author.test.ts
bash -c 'cd ~/repos/wt-agent-org-950 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.t[s] src/packaging/pr-owner-chairman-author.test.ts src/packaging/pr-owner-gone.test.ts src/packaging/pr-owner-total.test.ts'
```

Mutation: `isChairmanAuthoredPr` made to return `false` fails four tests, all in the new file (the rung, the red-PR wording, the shared-file wording, and the positive control that the chairman's login is read); made to return `true` fails 10 of the 34 tests in the four files named above (the worker-account and lookalike controls, and existing `ceo`-rung tests that expect "NOBODY COULD BE NAMED"). Each run and reverted byte-identical (`cmp` against a scratchpad copy).
