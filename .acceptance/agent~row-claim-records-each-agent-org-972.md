Row-claim records each refused claim in the failure ledger, so the claim-refusal storm signal has something to read (a11ign/agent-org#889's reader, #972's writer).

**What changes.**
- `row-claim.ts`: `recordClaimRefusal(refusal)` appends one `claim-refused` line to the failure ledger (`stateEntryPath(FAILURE_LEDGER_FILE)`), with the refusal's first line as the reason (tabs spaced, the whole field kept non-empty). It is called at every refusal exit that prints `NOT CLAIMED:` or `COULD NOT DETERMINE:`: the status read's unfound and thrown exits, `decline` and `conflict`, the tracker, clone and claim refusals of `dispatch`/`claim`, the claim's thrown exit (except a partial write, exit 4), and the stale-rule guard in `main`. The verdict and exit code are written before the call and do not change.
- A ledger that cannot be written is reported on stderr by `recordFailure` (`failure-ledger: NOT RECORDED claim-refused ...`), and the claim still stands. The recorder itself never throws into the claim.
- `failure-ledger.ts`: `CLAIM_REFUSED_KIND` moves here, so the recorder and the reader name the kind from the same leaf. `org-health.ts` re-exports it, so `claim-refusal-storm.test.ts` is unchanged.
- **Assumptions, said so:** a claim that LANDS writes no line. Only the refusal exits call the recorder, and a test that lands a claim would need `gh`, which this suite does not call. The subprocess test sets `A11Y_POLICY_LAUNCH_REASON` so it does not depend on whether the checkout is a linked worktree.

**Mutation.** Copies made in the scratchpad, each restored byte-identical (sha256 checked against the original):
- recorder writes nothing: 4 of 4 red;
- reason is the whole refusal rather than its first line: 1 red (the multi-line reason test);
- recorder throws into the claim: 4 of 4 red.

**Evidence.**
- `npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim-refusal-record.test.ts src/claim-refusal-storm.test.ts`: 17 of 17 pass (4 new, 13 existing storm tests), run in this worktree.
- `pnpm run typecheck`: passes.
- `pnpm test` (the full suite): 11 tests fail in 6 files; a clean `HEAD` export fails the same number in each of the same files: `live-tree-independence` 2, `org-health-queued-lab-jobs` 4, `release-tag-on-merge` 1, `wait-condition` 2, `work-gate-other-scopes-concurrent` 1, `worker-stop-hook` 1. None is in the files this change touches or adds.
- Not run: `pnpm run lint`, `pnpm run test:org`, `pnpm run verify`. This repository's `package.json` has no such scripts (`pnpm` reports `Missing script`), and no linter is configured.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim-refusal-record.test.ts src/claim-refusal-storm.test.ts`

Closes a11ign/agent-org#972.

Outside-Region: .changeset/row-claim-records-each-refusal-in-the-failure-ledger.md, the patch entry for a project that pins a tag.

platform: n/a (a ledger line written by an existing CLI; no platform feature)
