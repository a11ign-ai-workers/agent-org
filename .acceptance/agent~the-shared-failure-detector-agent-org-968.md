The shared-failure detector reads the `gate` roll-up's own step as no cause in both of its spellings: `Every job ran, and ran clean` and `Every job that ran, ran clean` (agent-org#968). `src/ci-failure-class.ts`: `AGGREGATOR_STEP` now matches `every job (?:that )?ran`. The rest of the roll-up exclusion (by check name, by the line its script prints, and `causes()`) landed earlier in a2f98dae (#5098), and the packaging test built from the real control#53 and control#58 logs already pins the pair from the row.

Acceptance:

```bash
bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/ci-failure-class.test.ts'
```

Closes a11ign/agent-org#968

Measured: `src/ci-failure-class.test.ts` at this head printed `VERDICT pass: 24 tests in 1 file`. The new assertion (`the other spelling of the roll-up step`) fails on the unchanged code (`line: 'boom'` returned where `null` is required) and passes after the one-line change. `src/packaging/work-gate-shared-failure.test.ts` prints `VERDICT pass: 8 tests in 1 file`; with `src/ci-failure-class.ts` swapped for the pre-#5098 file (`git show 209a56cb:src/ci-failure-class.ts`) it prints `VERDICT fail: 7 of 8 tests failed`, the same as the #5098 evidence. The file was restored byte-identical after each swap.

Mutation: disabling the roll-up skip (`causes()` not filtering, and both `AGGREGATOR_*` patterns disabled) is NOT caught by the packaging test, because the `checks` leg of each PR still keeps the pair apart: the incident needs the `checks` leg read as shared too, which is what the pre-#5098 swap reproduces. Recorded as a finding, not as a passing negative control.

Platform: GitHub's job steps (`steps[].name`) and the job log; no state kept beside them.
