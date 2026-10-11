`pr-open create --draft` is refused unless the body carries a `Draft-because: <reason>` line with a non-empty reason. The refusal is a pure step, `draftRefusal`, chained after `declarationRefusal` in `main`, so it comes before the Acceptance runs and before anything is sent (`EXIT_NOTHING_SENT`), and its message names both remedies: drop `--draft`, or add the line. A create without `--draft`, and any `edit`, are never refused for it. This is the first half of a11ign/a11ign#5036; the engineer brief's half is a11ign/a11ign's pull request.

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts'`.

Mutation: `draftRefusal` made to return `null` always turned the refusal test and the reason test red (`VERDICT fail: 2 of 19`); made to refuse every create and edit it turned the NEGATIVE CONTROL red (`1 of 19`); the reason made optional (`/^Draft-because:/`, so an empty label passes) turned the reason test red (`1 of 19`). `src/pr-open.ts` restored from a copy in the session scratchpad, `diff` identical.

Measured: `src/pr-open.test.ts` is `19 passed` in the worktree `~/repos/agent-org-wt-5036` (`node_modules/.bin/rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts`), three of them new. The one existing test that passes `--draft` to `main` (the #923 Region POSITIVE CONTROL) gained a `Draft-because:` line, since it tests the Region check and not the draft.

Not here, and named: `tsc --noEmit` cannot load `@types/node` in this worktree (`node_modules` is a link to the primary checkout's, which has no `@types`), so CI is the first typecheck of this change; run with `--typeRoots` at a11y-witness's `@types` it reported nothing in `pr-open`. `eslint` is not installed in the worktree.

Closes: none -- first half of a11ign/a11ign#5036 (the pr-open refusal); the engineer brief's half, in a11ign/a11ign, carries the Closes

platform: nothing in GitHub refuses `--draft` at create time; a branch-protection or ruleset rule cannot see the flag, only the draft state afterwards.
