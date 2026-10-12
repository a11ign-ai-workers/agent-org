The Haiku veto threshold is a project setting, `routing.sonnetVetoMinP` (absent = 0.7), so a11ign can require P >= 0.85 before Jev keeps a Tests-first row on Sonnet (a11ign/a11ign#5208).

**What changes.**
- `project-config.ts`: `RoutingDeclaration` gains `sonnetVetoMinP`; `ABSENT_ROUTING` carries 0.7; `readVetoThreshold` refuses any value outside 0.5 to 0.99 naming `routing.sonnetVetoMinP`.
- `engineer-route.ts`: the constant `SONNET_VETO_MIN_P` is gone. `haikuDefaultVerdict` takes the bar from the routing block, and its decision line names the threshold it used.
- **Assumption, said so:** the row's Region names `agent-org:src/...` and this PR is in `a11ign/agent-org`, so the work is there, not in the a11y-witness worktree. A changeset is added because CI requires one for any change under `src/`.

**Open-check.** Before: `git grep -c "sonnetVetoMinP" origin/main -- src` is 0. After: non-zero in `project-config.ts`, `engineer-route.ts` and their tests.

Mutation (each run, then restored byte-identical from a scratchpad copy and `cmp`ed):
- veto compares against a hard 0.7 instead of the key: 1 of 85 red (the new #5208 test, expected `haiku/high`).
- range admits 1 (`value <= 1` instead of `0.99`): 1 of 85 red (the refusal test).

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/engineer-route.test.ts src/project-config.test.ts'`

Closes a11ign/a11ign#5208. Done-when 2 (the a11ign switch row un-parks) is that row's, not this PR's.

Outside-Region: `.changeset/haiku-veto-threshold-is-a-project-setting.md` (CI requires a changeset for any change under `src/`).

platform: n/a (a key in the project declaration's existing `routing` block; nothing built beside it)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
