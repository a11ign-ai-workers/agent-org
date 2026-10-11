A comment the holder posts on its own row is a move on the claim when it carries the holder's own `decided-by: <session>` marker, whatever account the claim record was written under. `commentMove` takes the holder's session; `decidedBy` (new, exported) reads the wrapper's last marker line. Three tests are added to `src/work-gate-claim-stalled.test.ts` and the existing `commentMove` calls pass the session; nothing else changes.

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-claim-stalled.test.ts'`

Mutation: (each restored with `cp` from a copy, `diff` clean) the marker never counting (`if (!ownAccount) continue`) failed 2 of 126, #913 (1) and (3); any marker counting, whoever it names, failed 2 of 126, #913 (2) and (3); the FIRST marker in a body read instead of the last failed 1 of 126, #913 (2). The first mutation is the pre-change behaviour (the account test alone), so the old code fails the same two tests; the head itself cannot be run against the new tests, since `decidedBy` does not exist there.

Measured: `VERDICT pass: 126 tests in 1 file` for the acceptance command. `pnpm run typecheck` prints nothing. `pnpm test` over the whole suite: `fail: 5 of 9923 tests failed in 559 files`, the same five (`live-tree-independence` x2, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`) that fail with `src/claim-stall.ts` reverted to `HEAD` (`fail: 5 of 29 tests failed in 4 files` on those four files), so none is this change's.

Decision, stated: a comment by the claim record's own account still counts with or without a marker, and a marker naming another seat is NOT subtracted from that. The marker's role is a herdr workspace label and need not equal the session's name, so subtracting it could read the holder's own comment as silence, which fires the nudge earlier; the account rule's known limit (more movement read than there is) is the direction `STALL_INTERVAL_MS` already chose.

Closes a11ign/agent-org#913

platform: GitHub has no per-session author on a comment and the scheduler and workers share no account; the `decided-by` line `host/gh` already appends (agent-org#486) is the only attribution there is, so this reads it and adds no state and no command.

Net lines: positive (about 30 in `src/claim-stall.ts`, mostly the comment naming why the marker is read and what it does not subtract).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
