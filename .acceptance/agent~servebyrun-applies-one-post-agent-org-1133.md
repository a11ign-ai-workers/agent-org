`serveByRun` applies every post the class named, not only one. `applicable` takes the class's actions with the rows the class named (the served item, plus whatever `namedItems` names), and returns one plan per post row, each with at most one change on that row. Every plan is checked before the first row is written, and each is applied through `applyDecision`. A post on a row that was not named, two posts on one row, or a change on a row with no post is refused with `no-action` and nothing is written. A row that comes back non-applied part-way stops the batch and falls back with `apply:<outcome>, <n> of <total> written`, so the seat is prompted knowing which rows already carry a decision.

The named rows are a seam: `ServeByRunDeps.namedItems` is absent in production, so only the served item is named and `ready-queue-empty` keeps its seat behaviour until its class declares the rows it examined. That declaration is a follow-up outside this Region.

Mutation: two, each turns at least one test red and each restore was byte-identical (`diff` of a copy in the scratchpad, never `git checkout --`): the named-row check removed from `applicable` (1 red: the unnamed-row control); the stale handling forced to continue past a non-applied row (2 red: both stale controls).

Evidence: `src/serve-by-run-many-rows.test.ts` 7 of 7 and `src/serve-by-run.test.ts` 16 of 16 pass in the worktree (23 of 23). The file it adds failed 4 of 7 before the implementation. `pnpm run typecheck` exits 0. The full `pnpm run test` has 5 failures in 620 files, in `src/packaging/live-tree-independence.test.ts` (2: `tsx/package.json` not found), `src/packaging/release-tag-on-merge.test.ts` (a `pnpm-lock.yaml` assertion), `src/work-gate-other-scopes-concurrent.test.ts` and `src/worker-stop-hook.test.ts`; none of them imports `serve-by-run`, and the diff touches only `src/serve-by-run.ts` and the new test. These were not re-run on a clean base in this session.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1133 && npx rstest run --config scripts/rstest/rstest.config.ts src/serve-by-run-many-rows.test.ts src/serve-by-run.test.ts'`

Closes a11ign/agent-org#1133

Outside-Region: none. `src/serve-by-run.test.ts` is unchanged; its "another item" and single-post controls stay green as written.

platform: the Acceptance was run in the worktree `wt-agent-org-1133`, where the branch is checked out, not in `~/repos/agent-org`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
