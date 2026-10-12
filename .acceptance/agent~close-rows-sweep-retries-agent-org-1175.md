close-rows-sweep reads the merged-PR list once, so a GitHub 502 on that read exited `CANNOT ASK` (2) and `trunk`'s `closeRows` job went red. The read is now retried on a transient 5xx (`HTTP 5xx` in the error text), at most 3 attempts with a 1 s then 2 s pause, and a 4xx is never retried. The retry sits behind `sweep.retryTransient`, shipped OFF: with the switch OFF the sweep makes exactly one read, as before. The switch is the environment variable `SWEEP_RETRY_TRANSIENT=1` (only `1` turns it on), because the machinery flag store needs a state directory that CI runners do not have. Setting that variable in `trunk.yml` is the follow-up the row names.

Acceptance: `node --test src/close-rows-sweep-retry.test.ts`

Mutation: each mutation was applied to `src/close-rows-sweep.ts`, the test file was run, and the file was restored and checked with `cmp` against a saved copy each time.
- retry never fires (`TRANSIENT_5XX` matches nothing): 4 tests failed (done-when 1 unit and end to end; done-when 2 unit and end to end).
- retry always fires (`/HTTP/`, a 4xx retried too): 2 tests failed (the 4xx unit and end to end).
- attempt cap 4 instead of 3: 3 tests failed (done-when 1 end to end; done-when 2 unit and end to end).
- switch never on (`retryTransientOn` returns `false`): 3 tests failed (done-when 1 end to end; done-when 2 end to end; the switch test).
- switch always on (`retryTransientOn` returns `true`): 2 tests failed (the OFF control; the switch test).

Old code, run directly: the HEAD version of `src/close-rows-sweep.ts`, with a fake `gh` that answers HTTP 502 on the first merged-list read and an empty list on the second, exits 2 (`CANNOT ASK: listing merged PRs failed`) after 1 read. The new code with `SWEEP_RETRY_TRANSIENT=1` on the same fake exits 0 after 2 reads.

Measured: `node --test src/close-rows-sweep-retry.test.ts` gives `pass 9, fail 0`. `pnpm run typecheck` exits 0. `pnpm exec rstest run --config scripts/rstest/rstest.config.ts --changed=origin/main` exits 0 with `VERDICT pass: 64 tests in 5 files`. No lint script or eslint config exists in this repository, so no lint was run.

Not here, and named: the switch is an environment variable, not `sweep.retryTransient` in the machinery flag store, and nothing sets it in CI, so the shipped behaviour is unchanged until that follow-up lands. No changeset: the fix ships OFF, so no pinned project sees a behaviour change.

Closes a11ign/agent-org#1175

platform: the retry reads `gh`'s error text for `HTTP 5xx`; no GitHub API schema is relied on beyond the merged-PR connection already read.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
