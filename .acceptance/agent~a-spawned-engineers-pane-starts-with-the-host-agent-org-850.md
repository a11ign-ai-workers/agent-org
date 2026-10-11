A spawned engineer's pane starts with `AGENT_ORG_HOST` and is sent its brief by an absolute path (a11ign/agent-org#850; chairman a11ign#4957, cause 1).

**The incident:** twelve agent-org workers sat idle for up to ten hours. `AGENT_ORG_HOST` was unset in every worker pane, so `pr:open`, `worker:state` and the tests refused in an agent-org worktree (no `.agent-org/project.json` of its own), and the start order named the brief as `.agent-org/roles/engineer.md`, relative to a worktree that has no such directory.

## What changes

- `spawnEnvironment` (`src/wake.ts`) lays `AGENT_ORG_HOST` over the spawn's environment with `hostConfigPath()`'s value, the file the gate itself resolved, whether or not the gate's own environment had the variable. A caller's `override` still wins.
- The brief sentence (`src/spawn-role-brief.ts`) names the brief by its absolute path in the home project: `engineerBriefSentence` resolves a relative brief against the home checkout, `briefRoleSentence` reads `roleBriefPath(...).absolute`. The standing-seat line uses the same constant, so a later order to a spawned instance names the same path.
- `ceo`'s addition 1 (row comment): `spawnWorker` refuses, before the claim, when the environment it was handed names an `AGENT_ORG_HOST` that is not a file (`whyNoHost`). **Read narrowly on purpose:** the gate's own environment lacking the variable is not a refusal, because the row's Done-when 1 has the control spawn with the variable ABSENT and still get it (the fallback is the declaration in the checkout the tool runs from).
- `ceo`'s addition 2 (the brief file absent at its absolute path refuses the spawn) is NOT in this PR: 30 existing spawn tests use a fixture project with no `engineer.md`, and the row's Region does not reach them. Filed as its own row.

## How it was verified

Run with `AGENT_ORG_HOST` set to a checkout holding `.agent-org/project.json` (this worktree has none; `main`'s own spawn tests need it too).

Mutation: three, each red and each restore byte-identical (`cp` and `diff`): the host key dropped from `spawnEnvironment` (4 of 7 red, including the MUTATION test's own real-text check); the sentence leaving the brief relative (1 red, the absolute-path test); the source-text fixtures for an override losing to the host and for the refusal moved after the claim are named by their own problem in the MUTATION test.

Evidence, measured: `src/wake-spawn-host-env.test.ts` 7 of 7. The 119 test files that import `wake.ts` or `spawn-role-brief.ts`: 2444 pass, 30 fail, and the same 30 fail on a clean `origin/main` (2437 pass, 30 fail there; the 7 more are this file's). `tsc --noEmit` is clean.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json bash -c 'git grep -q "POSITIVE CONTROL" -- src/wake-spawn-host-env.test.ts && node --test src/wake-spawn-host-env.test.ts'`

Closes a11ign/agent-org#850

Outside-Region: src/spawn-role-brief.test.ts — pinned the sentence with a RELATIVE path, byte for byte; it now pins the absolute one under the home checkout.
Outside-Region: src/packaging/wake.test.ts — two assertions list the exact `--env` arguments of `workspace create`; the pane now carries `AGENT_ORG_HOST` too.
Outside-Region: src/packaging/wake-spare-teardown.test.ts — `#2323 (4)` pins `spawnEnvironment()`'s whole value and the `workspace create` line.
Outside-Region: src/work-gate-engineer-order-paths.test.ts — counts the host paths a standing engineer's order names; the brief's own absolute path is one that names no worktree.
Outside-Region: .changeset/a-spawned-engineers-pane-starts-with-the-host-850.md — the entry a project that pins a tag reads.

platform: n/a (no GitHub, pnpm, systemd or git feature does this; `hostConfigPath` is reused, not retyped)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
