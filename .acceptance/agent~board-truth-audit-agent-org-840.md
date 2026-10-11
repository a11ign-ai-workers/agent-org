The board-truth audit's epic question honours an unmet wait on the epic (a11ign/agent-org#840). `epicsDone` flags an open epic whose sub-issues are all closed; it now does not flag one whose body carries a `Not-before:` date still ahead or a `Waiting-for:` condition not yet true, and flags it again once that wait comes true. An epic with no such line, one whose wait is already true or whose date has passed, and one whose condition cannot be read (no facts, or a reference the facts do not hold) still flag, so an unknown condition is never silence.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/board-truth-audit.test.ts`

Mutation: five, each red and each restore byte-identical (copy in the scratchpad and `cmp`): the wait never holding (the condition replaced by `false`, 1 red); `=== false` read as `!== true`, so an unread reference counts as held (1); the `Not-before:` date check removed (1); its comparison reversed, so a passed date counts as held (1); the held check removed from the filter (1).

Evidence: `src/board-truth-audit.test.ts` 47 of 47, including the new test (1b), which asserts the held epic is not found and that each control (the wait come true, a passed date, no line, a `null` condition, and a reference missing from the facts) is found. `npx tsc --noEmit` exits 0. The affected set, `rstest run --changed=origin/main`, reports 53 of 5436 failing across nine files (`engineer-route.test.ts` 24, `packaging/row-file.test.ts` 8, `packaging/milestone-clock.test.ts` 7, `packaging/tick-heartbeat-is-written.test.ts` 5, `packaging/milestone-clock-exact-start.test.ts` 4, `packaging/auto-arm-token.test.ts` 2, `packaging/row-file-refuses-duplicate-title.test.ts` 1, `packaging/wake-engineer-brief.test.ts` 1, `work-gate-other-scopes-concurrent.test.ts` 1). None is `board-truth-audit`. The same nine files fail with the same counts when the two changed files are at their `HEAD` versions, and this branch's base is `origin/main` at the same commit (`6fa14182`), so those failures are on main and are not caused by this change. `pnpm run verify` is therefore not green at this head for reasons outside this change. `package.json` has no `lint` script.

Assumptions: a `Waiting-for:` condition that cannot be read is not held and still flags; a `Not-before:` date is read as held while it is after now, using the same reader as `waiting-condition.ts`.

Closes: #840

Outside-Region: none

platform: n/a (the wait line is read by the existing `wait-condition.ts` parser and the `Not-before:` reader in `waiting-condition.ts`; the held check mirrors `waitsTrueOf`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
