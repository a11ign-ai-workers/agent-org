`src/due-index.ts` (new, nothing calls it yet): `writeDueIndex` replaces one repository's due instants and keeps the others, `readDueIndex` returns an empty index for a missing file and `null` (with a reason) for a corrupt one and never throws, and `dueRepos` names the repositories with an instant in (`afterMs`, `nowMs`], distinct and sorted. An instant that passed between two ticks names its repository as due.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/due-index.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/due-index.test.ts
bash -c 'cd ~/repos/wt-agent-org-994 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/due-index.test.ts'
```

Mutation: `<= nowMs` to `< nowMs` fails the at-now test; `> afterMs` to `>= afterMs` fails the at-previous-tick test; dropping the `nowMs` bound fails three tests; appending instead of replacing fails the replace test; dropping the sort fails the sorted test. Each run and reverted byte-identical.
