`releaseHoldViaModule` (`src/work-gate/org-health.ts`) forgets the work gate's read memo once its child process `pr-hold.ts --release` has returned, whether the release exited `0` or not. The child's `gh` writes are invisible to the memo, which forgets only the writes `defaultRun` makes itself, so a read of the same pull request later in the tick was answered from before the release. The memo's `forgetReads` is the one agent-org#1095 exported.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import=./src/lib/crash-exit.ts --test src/work-gate-release-forgets-reads.test.ts'`

Mutation: the `forgetReads();` line after the child's `spawnSync` removed from `src/work-gate/org-health.ts`, copied first and restored byte-identical (`diff`) after the run. The file then fails both tests: the success-path test (`AssertionError: the read after the release is asked of GitHub, not answered from before it`, actual 1, expected 2) and the non-zero-exit test (`the read after a failed release is asked of GitHub too`). With the line in place both pass. The control inside the success-path test (two reads with no release between them make one call) is what makes the second count meaningful.

Measured: the acceptance command prints `ℹ pass 2` and `ℹ fail 0`. `pnpm run typecheck` exits 0. `src/work-gate-read-memo.test.ts`, `src/packaging/pr-hold-any-declared-repository.test.ts` and the new file together print `ℹ tests 35`, `ℹ pass 35`, `ℹ fail 0`; `src/work-gate/org-health.test.ts` and `src/work-gate/org-health-suppression.test.ts` print `ℹ pass 17`, `ℹ fail 0`.

Closes a11ign/agent-org#1145
