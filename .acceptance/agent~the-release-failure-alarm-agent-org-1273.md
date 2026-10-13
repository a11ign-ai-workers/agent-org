A `status` run's success no longer clears the release-failure streak. `newestReleaseVerdict` and `failureStreak` (`src/org-health.ts`, signal `release-run-failed`) now count a run as a verdict only when it is a failure, a `push` success, or a `workflow_dispatch` success whose `release` job published. A `status` success is a promotion, not a release, so two failed pushes followed by a promotion read as a streak of 2, not zero. A dispatch that only promoted an existing tag (its `release` job was skipped) does not clear the streak either. The publish check is `releaseJobPublished`, one `gh api .../actions/runs/<id>/jobs` call made only for a dispatch that concluded success.

Acceptance: `node --test src/release-failure-alarm.test.ts`, run from the worktree.

Measured: the acceptance command gives 25 of 25 pass. `src/org-health-release-failed.test.ts` gives 15 of 15 pass, so 40 of 40 across the two release test files.

Fail before, pass after, and mutation, with `src/org-health.ts` restored byte-identical each time (`cmp` against a scratch copy):
- the old any-success rule restored (a `status` success clears again): 5 tests fail.
- the incident-or-order gate's `<` changed to `<=`: 3 tests fail.

Typecheck: `pnpm run typecheck` exits 0. This repository has no `lint` or `test:org` script, so neither was run.

Dependents: the 76 test files that import `src/org-health.ts` give 1489 tests, 1486 pass, 3 fail. None of the 3 is in a file that this change touches or that imports the changed reader:
- `src/packaging/live-tree-independence.test.ts`, two `#3233` tests (the positive control and the converted-files check): `Cannot find module 'tsx/package.json'`. `tsx` is not in `package.json`'s devDependencies or in this worktree's `node_modules`. The same missing package is named in the 1262 note.
- `src/trace/triage-sample.test.ts`: `SyntaxError: ... does not provide an export named 'Figures'` at file load (`triage-sample.ts` declares `type Figures` without exporting it). That file does not import `org-health`. I did not re-run it on a clean HEAD, so its cause on `main` is unconfirmed.

Live reading (done-when 3): not yet taken. It runs at the merge commit over the `a11ign/a11ign` `release.yml` runs, read-only, and the output is pasted on the row.
