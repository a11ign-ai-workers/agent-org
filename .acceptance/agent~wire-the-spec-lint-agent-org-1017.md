Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/spec-lint-promotion.test.ts'` prints `VERDICT pass: 22 tests in 1 file`: three blocks, one per wiring, each refusal beside the twin that repairs the one thing that causes it.

**What changes.** Behind `rows.specLint` (absent is OFF), `row-file.ts` asks the lint at promotion, Jev reads a promoted spec, and each refusal is logged.
- `row-file.ts`, wiring 1: `promoteRefusalReason` takes a fourth argument and asks `specLintRefusalReason(body, n, deps, { requireBlock })`. `requireBlock` is `requiresSpecBlock(body)`: a Region naming a non-test source file AND a `Tests-first:` or `spec` marker. `specLintDeps()` is `machineDeps` with ONE change: a file is looked for on `origin/main` (as `absentRegionTopDirReason` does), so a stale checkout never refuses a file that exists; a prefix with no checkout is `null`.
- `row-file.ts`, wiring 3: `recordSpecLintRefusals` writes one `spec-lint-refused` failure-ledger line per finding (`#<row> <field> <rule>`), the `claim-refused` shape. The act sites pass it; a bare verdict records nothing.
- `row-file.ts` + `decision-provider.ts`, wiring 2: `DECISION_USES` gains `spec-review`. `promoteAndReviewRow` (what `main` runs for `--promote=`) promotes, and on exit 0 `reviewPromotedSpec` asks Jev through `decide`. A warn writes one comment that asks `product-manager`, then ONE label set (`spec:review` and `answer:product-manager`), and never changes the exit code. A row already carrying `spec:review` is not commented on again.
- `row-file.ts` stays at its `gh` baseline (spawns 18, calls 17): the label write and the adapter's runner are each one helper, `writeLabelSet` and `ghRunner`, and the comment goes through the ticket port.

**Mutation** (23, each applied to one file with the original copied to the scratchpad and restored by `cp`, proven byte-identical by `diff`; the Acceptance command run after each; `git status` clean at the end). Every one turned the Acceptance red, and the failing test names are the wiring's own:
1. `1a` flag ignored (the lint always runs): 3 red, the two flag-off twins and the record test. `1b` flag inverted (never lints when on): 9 red.
2. `1c` requireBlock never: 2 red. `1d` requireBlock always: 1 red (the exemption twins). `1e` source-file half dropped: 1 red. `1f` marker half dropped: 1 red.
3. `1g` an unrooted prefix is a refusal (`false`) instead of `null`: 1 red. `1h` the working tree read instead of `origin/main`: 1 red. `1i` the lint never asked: 8 red.
4. `3a` `record` never told: 2 red. `3b` the rule dropped from the ledger ref: 2 red. `3c` the act site does not pass the default `record`: 1 red.
5. `2a` `spec-review` not in `DECISION_USES`: 5 red. `2b` warn on every reading: 1 red (score 3 and 5 twin). `2c` idempotence guard dropped: 1 red. `2d` wake label never added: 2 red. `2e` review label never added: 2 red. `2f` warning inverted: 6 red. `2g` review runs with the flag off: 1 red. `2h` wrong decision use asked: 4 red. `2i` a failing write thrown instead of said: 1 red. `2j` a refused promotion still read: 1 red. `2k` `main` runs the bare `promoteRow`: 1 red (a source pin, because `main` reads `process.argv` and cannot be injected).

**Measured, and how.**
- The Acceptance command printed `VERDICT pass: 22 tests in 1 file` on this branch after rebasing onto `origin/main` (85cb7504). The file did not exist at the parent head, so there is no "before" run of it.
- The neighbouring suites each printed pass after the change: `src/packaging/gh-call-ratchet.test.ts` 8, `src/decision-provider.test.ts` 20, `src/packaging/row-file.test.ts` 184, `src/spec-lint.test.ts` 37, `src/row-claim-refusal-record.test.ts` 5. The ratchet failed once on the first version (spawns 20 against a baseline of 18) and is why `writeLabelSet` and `ghRunner` exist.
- `pnpm run typecheck` exits 0. This package has no `lint` or `verify` script, so neither was run.
- `rstest run --config scripts/rstest/rstest.config.ts --changed=origin/main` on this branch after the rebase printed `VERDICT fail: 8 of 6769 tests failed in 383 files`. The 8 are `org-health-queued-lab-jobs.test.ts` (4), `wait-condition.test.ts` (2), `work-gate-other-scopes-concurrent.test.ts` (1) and `worker-stop-hook.test.ts` (1), and the same 8 fail when those four files are run in a clean detached worktree of `origin/main` (measured with the same command, `AGENT_ORG_HOST` set): they do not come from this change. An earlier run on this branch before the rebase also failed 2 tests of `row-claim-refusal-record.test.ts`, because the branch was one commit behind the release the host runs; they pass on the rebased head.

**Not done here, and filed.** The retro's "Rows refused by the spec lint (24h)" line and the kind's move into `failure-ledger.ts` lie outside this row's Region (`org-retro.ts`, `failure-ledger.ts`): a11ign/agent-org#1056. Item 4 (declaring `rows.specLint: true` in a11ign's `.agent-org/project.json`) waits for a release that contains this PR, so it is filed with that wait and not made here.

**Open risk, not verified.** The failure ledger's repeat pass keys on a class key with two distinct refs; a row refused twice for the same field is the same ref, so it is not a repeat, but two rows refused for the same field are. Whether that should file a class row for `spec-lint-refused` is the ledger's owner's call, and is noted in a comment on #1056.

Closes a11ign/agent-org#1017

platform: n/a (a flag-gated check in the existing promote act; no platform feature lints a row's spec)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
