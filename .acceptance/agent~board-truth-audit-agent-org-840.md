The board-truth audit's epic question honours an unmet wait on the epic (a11ign/agent-org#840). `epicsDone` flags an open epic whose sub-issues are all closed; it now does not flag one whose body carries a `Not-before:` date still ahead or a `Waiting-for:` condition not yet true, and flags it again once that wait comes true. An epic with no such line, one whose wait is already true or whose date has passed, and one whose condition cannot be read (no facts, or a reference the facts do not hold) still flag, so an unknown condition is never silence.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/board-truth-audit.test.ts`

Mutation: five, each red and each restore byte-identical (copy in the scratchpad and `cmp`): the wait never holding (the condition replaced by `false`, 1 red); `=== false` read as `!== true`, so an unread reference counts as held (1); the `Not-before:` date check removed (1); its comparison reversed, so a passed date counts as held (1); the held check removed from the filter (1).

Evidence: `src/board-truth-audit.test.ts` 47 of 47, including the new test (1b), which asserts the held epic is not found and that each control (the wait come true, a passed date, no line, a `null` condition, and a reference missing from the facts) is found. Typecheck: `npx tsc --noEmit` exits 2 in this worktree, for reasons outside this change. The worktree's `node_modules/@types` is a symlink to a directory the main checkout does not have, so `tsc` stops with TS2688 (`Cannot find type definition file for 'node'`). With `--typeRoots` pointed at a sibling checkout's `@types`, it reports 64 errors, 35 of them TS2307 missing modules (`typescript` among them), and none in `board-truth-audit.ts` or its test. The affected nine (`engineer-route.test.ts`, `packaging/row-file.test.ts`, `packaging/milestone-clock.test.ts`, `packaging/tick-heartbeat-is-written.test.ts`, `packaging/milestone-clock-exact-start.test.ts`, `packaging/auto-arm-token.test.ts`, `packaging/row-file-refuses-duplicate-title.test.ts`, `packaging/wake-engineer-brief.test.ts`, `work-gate-other-scopes-concurrent.test.ts`) report 52 of 329 failing both with this head and with the two changed files at their merge-base (`6fa14182`) versions, so those failures predate this change. `agent-org`'s `package.json` defines no `verify` or `lint` script; the gate is this row's Acceptance and CI.

Assumptions: a `Waiting-for:` condition that cannot be read is not held and still flags; a `Not-before:` date is read as held while it is after now, using the same reader as `waiting-condition.ts`.

Closes a11ign/agent-org#840

Outside-Region: none

platform: n/a (the wait line is read by the existing `wait-condition.ts` parser and the `Not-before:` reader in `waiting-condition.ts`; the held check mirrors `waitsTrueOf`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
