A lab pull request whose `checks (cross-repo)` leg fails on a test file the newest trunk run passed is not armed unless its body declares `Cross-repo-red: <row>` naming an OPEN row (a11ign/agent-org#992, class `main-red`, lab#81 put `main` red on 2026-10-11).

Closes a11ign/agent-org#992

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/cross-repo-red-refusal.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/cross-repo-red-refusal.test.ts
bash -c 'cd /home/agent/repos/wt-agent-org-992 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/cross-repo-red-refusal.test.ts'
```

The row's third command says `cd ~/repos/agent-org`, the host's checkout (detached at the last release), which does not hold this branch; it is run in this branch's worktree, as a11ign/agent-org#620's and #955's were. Printed `VERDICT pass: 20 tests in 1 file`.

Mutation:
Each applied to a copy of the one line, the test file run, the file restored from the copy and compared byte-identical.
- Never fires, the empty difference assumed (`if (added.length === 0)` made `if (true)`): 13 of 20 red, every case that expects a refusal, through both doors; every NEGATIVE CONTROL stays green.
- Always fires, the trunk's red not subtracted (`const added = own.files`): 3 of 20 red, the INHERITED, SOME-OF-trunk's-files and arm-pr's door control; the POSITIVE CONTROL stays green.
- A CLOSED row read as a declaration: 2 red (the decider's refusal table, and arm-pr's closed-row control).
- The declaration not read (no line needed): 2 red.
- An unreadable PR log answered `clear`: 2 red. An unreadable trunk answered `clear`: 1 red (the `cannot-ask` table).
- The primary asked about too (`declared.key === ""` guard dropped): 2 red, the zero-call control and the guard on the declared set.
- A leg of any conclusion judged (the `conclusion !== "failure"` exit dropped): 2 red.
- The leg-name rule loosened to `/cross-repo/`: 1 red, the parity test that drives `readTrunkRed` with the same job names.
- The marker without the files: 2 red (a changed set is not said afresh).
- arm-pr's door not asking: 4 red, all arm-pr cases; the sweep's cases stay green. The sweep's decider not asking: 3 red; arm-pr's stay green. The sweep's `main` announcing only `open-blocker`: 2 red (the process cases that look for the comment).

Judgement calls:
- **The leg-name rule is copied, not imported.** `CROSS_REPO_LEG` is a private constant of `src/trunk-red.ts`, which is not this row's Region, so `src/cross-repo-red.ts` holds a copy and a test drives `readTrunkRed` with the same eight job names and compares which it reads as the leg. The loosened-rule mutant above is that test's. Exporting the constant from `trunk-red.ts` and deleting the copy is a one-line follow-up for whoever next holds that file.
- **The log fixture's escapes are the two characters `^[`.** The lab#81 merge run's failed log, read through the host's `gh`, arrived with each ESC byte printed as `^[`; the reader strips both forms, and the test also runs the fixture with the raw byte. The fixture is the log's lines verbatim (job, step and timestamp columns included), not a retyped one.
- **The pull request's own workflow run id is a stand-in** (`38150000001`): the row names the check run (114504845032), not the run. Nothing reads it but the fake `gh`.
- **A PR leg that failed with no `FAIL` line in its log is `cannot-ask`**, per done-when 3 (the log could not be read): a leg that failed on a setup step names no file, and a refusal that says so is better than an arm. On the sweep that is a `could not arm` line and exit 1 each tick for as long as that head stands.
- **The CI reads live in `src/ticket-port/ci-reads.ts`, a file the row's Region does not list.** `gh-call-ratchet.test.ts` (#826) fails a new file outside `src/ticket-port/` that holds a `gh` call shape ("a new file that calls the tracker's CLI (spawns 0, calls 6) and has no entry in docs/gh-call-baseline.json ... do not raise the baseline"), and the first version of `cross-repo-red.ts` held six. The six reads (head, check runs, workflow runs, jobs, failed log, row state) are therefore one function each in the port directory, which the ratchet exempts by path, and `cross-repo-red.ts` holds the decision and no call shape. `pr:open` refuses a diff outside the Region, so this needs `product-manager` to add `agent-org:src/ticket-port/ci-reads.ts` to the row's Region (or to rule otherwise); the alternative, a baseline entry, is a rise the ratchet's own message forbids.
- **`src/packaging/sweep-wait-override.test.ts` lists the files that name `SWEEP_WAIT_ENV`**, so the new test does not name it and has no process-level case that arms (a merge there waits for the read-back); the arming controls are driven through `runArmPr` and `refusalBeforeArming`, and the process cases are the refusal, the once-only marker and the changed set.
- **`work-gate.ts` (line 5028) also calls `blockerVerdict` for its own "why is this unarmed" reading and is not touched**: it is outside the Region. A lab PR refused here therefore reads in the gate as unarmed for no stated reason until that reader is given the same call; the refusal itself is on the PR.

Population (done-when 6), MEASURED from the host's `failure-ledger` (`~/.cache/a11ign/failure-ledger`, newest 13 `main-red` lines, 2026-10-10T13:35Z to 2026-10-11T20:56Z) and each ref's run jobs and failed log, each log read with `failingFilesFromRstestLog`, each run compared with the newest push or schedule verdict run before it:
- 13 refs: 11 are lab runs of `ci.yml` (10 `push`, 1 `schedule`), 2 are agent-org `push` runs whose `suite` job failed and which have no cross-repo job.
- **6 of the 13 would have been refused**: lab#62 (24 files the previous run passed), lab#67, lab#69 and lab#68 (1 each), lab#81 (2) and lab#84 (1). None of those six bodies carries a `Cross-repo-red:` line (read with `gh pr view`).
- 4 of the 13 are INHERITED reds the rule clears (lab#63, #64, #66, #70: every failing file was already failing on the run before).
- 1 is a `schedule` run, which has no pull request to hold, and 2 are the agent-org `suite` reds, a different cause; the rule says nothing about either.
- This is INFERRED for the pull requests' own heads, not measured on them: each merge's push run stands for its head leg (the merge result of an up-to-date branch). lab#81's own head `e929f712` was measured directly on the row and agrees (2 files, newest trunk run green).

`pnpm test` over this repository (rstest, 581 files, 10253 tests): 13 failed in 8 files. Eleven fail identically on a clean `origin/main` worktree (run for exactly those files: `live-tree-independence` x2, `org-health-queued-lab-jobs` x4, `release-tag-on-merge`, `wait-condition` x2, `work-gate-other-scopes-concurrent`, `worker-stop-hook`: a missing `tsx` in this worktree's `node_modules`, `copies-drifted@src/lib/git-env.ts` read from the host's tree, a `pnpm-lock.yaml` that now exists, a declared-repository count and an unset `AGENT_ORG_HOST` in a child process: none reaches this diff). The other two were this diff's (`gh-call-ratchet.test.ts`, `sweep-wait-override.test.ts`), are fixed as the two judgement calls above say, and pass with the new test, `ticket-port.test.ts` and `gh-call-inventory.test.ts`: `VERDICT pass: 89 tests in 6 files`. `pnpm run typecheck`: no output beyond the command. `node -e "import('./src/cross-repo-red.ts')"`: import ok. No live run is this row's (done-when 7): the first lab pull request after this merges is the reading, and a VERIFY row is filed then.

platform: n/a (no GitHub feature refuses an arm on a `continue-on-error` job's conclusion; the leg is read from the PR head's check runs and the trunk's runs by REST, as `readTrunkRed` reads them).
