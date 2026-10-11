The triage sampler draws a cause-restricted sample and the scorer reads a week-2 sheet against a stricter bar. `--cause <class>` (repeatable) restricts the draw to the named cause classes, and a name no manager wake in the window carries is refused rather than drawn as an empty sample. `--score <predictions.json> --labels <labels.json>` reads that labelled sheet against `WEEK2_BAR`: a class passes only with 20 labelled `wake` rows and no missed wake, and under 20 is "not testable this window", a result and not a failure. A missed wake fails whatever the count. With no `--labels` the frozen #4074 sheet is read against `BAR` exactly as before, and the existing 20 tests are unedited; seven tests are added. `--labels` without `--score`, and `--cause` with `--score`, are refused. `loadLabels` refuses a sheet that is not whole: no `definitions` and `rows`, a position labelled twice, a label outside wake | digest | drop, or a row with no cause.

Acceptance: `bash -c 'cd /home/agent/repos/agent-org-wt-4187 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/trace/triage-sample.test.ts'`

Mutation: the week-2 "not testable" line removed (`if (wakeRows < bar.minWakeRows) return ...`) failed 1 of 27 tests, the week-2 bar test, and nothing else. `triage-sample.ts` restored byte-identical (`cmp` against a copy).

Measured: `VERDICT pass: 27 tests in 1 file` for the acceptance file. `tsc --noEmit`: zero errors in `src/trace/`. The 64 errors elsewhere are module links missing from this worktree's hybrid `node_modules` (`typescript`, `yaml`, `@rstest/core`), in files this change does not touch. agent-org has no `lint` script, so no ESLint run is claimed here.

Not here, and named: the population counts and the drawn week-2 sheet (Done-when 2) are posted on a11ign/a11ign#4187 after the window closes and the store is read, not in this change. The labels are product-manager's and are not in this change; no model has run over them.

Closes a11ign/a11ign#4187

🤖 Generated with [Claude Code](https://claude.com/claude-code)
