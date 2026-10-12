The other-tracker un-park pass (#5177, reopened) names a refused read instead of skipping it. `unparkOtherTrackers` used to `continue` past a tracker whose open-row list was `null` (a failed `gh` list) with no line in the tick's log, though the pass's own doc promises a failed read is named; it now writes `rows were not read; its parked rows stay parked this tick` for that tracker and skips it as before. The flag's one home is stated in the comments: `rows.autoUnpark` is read only from the record in `machinery-canary.json`, and a `rows.autoUnpark` key in a project's `project.json` is never read. Nothing is turned on here; the flag is host state and turning it on is `ceo`'s.

Why the live pass did not fire (#905's shape): the unit logic is not the miss. Test (10), #905's shape with `Waiting-for: closed #902` and `Waits-on-done-when: 902.1`, is un-parked on `origin/main`, so it is kept as a control. The live miss that remains is that the flag is OFF on the host, where `machinery-canary.json` has `flags: {}`.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/rows-unpark.test.ts`

Mutation: test (11) is the one that fails before the change. The `origin/main` version of `src/unpark-satisfied.ts` was copied over the change, the file was run against the new test file, and the change was restored from a copy and verified with `cmp`: `VERDICT fail: 1 of 12 tests failed in 1 file`, and the failure is (11). The restored file was run again and passes.

Measured: `VERDICT pass: 12 tests in 1 file` for the acceptance file. With `src/unpark-satisfied.test.ts`: `VERDICT pass: 34 tests in 2 files`. `pnpm run typecheck` exits 0.

Not here, and named: the live reading (done-when 5, the next parked other-tracker row once the flag is on) is out of scope under the resource ban. `rows.autoUnpark: true` in a11y-witness `.agent-org/project.json` (#5194, #5195) is a dead key; removing it is an a11y-witness config change outside this row's Region and is named for `ceo`. `readWaitRef` still swallows errors to `null`; `MAX_WAIT_READS = 30` with PRs-first ordering can starve later references.

Flag: rows.autoUnpark
Health-signals: claims-refused, wakes-held
Revert: turn `rows.autoUnpark` off in `machinery-canary.json` (it ships OFF), or revert this PR
