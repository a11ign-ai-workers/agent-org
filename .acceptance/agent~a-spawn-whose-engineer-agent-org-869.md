A spawn whose engineer brief is not at its absolute path is refused, naming the path, before the claim (a11ign/agent-org#869; `ceo`'s addition 2 on #850).

## What changes

- `spawnWorker` (`src/wake.ts`) refuses, after the memory, claim and host prechecks and BEFORE the claim, when the engineer brief's absolute path (`roleBriefPath("engineer.md").absolute`, the file the spawned seat is told to read) does not exist: `no spawn: the engineer brief is not at <path>` (`whyNoBrief`, on the `isFile` seam #867 added: a directory at the path is not a brief). No row is claimed and no pane is opened.
- The two fixtures that spawn against a project with no brief gain a one-line `engineer.md`, written by the test itself: `src/wake-spawn-worktree.test.ts` (16 tests) and `src/packaging/wake-drain.test.ts` (5 tests).
- `src/engineer-escalation.test.ts` and `src/packaging/wake.test.ts`, named in the Region, spawn against the real home project, which holds its `engineer.md`, so they needed no change.

## Based on #867

This builds on a11ign/agent-org#867, now merged: `whyNoHost`, the `isFile` seam of `spawnWorker` and the absolute `ENGINEER_BRIEF_ABSOLUTE` are its. The first CI run failed with `exists is not defined` (`tsc`, and the three spawn tests that reach it) because this branch had been built on #867's head at the time (`0a6f0169`), whose seam was `exists`; #867 merged with it renamed to `isFile`. This branch is rebased onto `main` and uses `isFile`.

## How it was verified

Run with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json`, one `node --test` per file.

Measured, 124 test files that import `wake.ts` or `spawn-role-brief.ts`, before and after the check with no fixture change: exactly two files moved, `src/wake-spawn-worktree.test.ts` 0 to 16 failing and `src/packaging/wake-drain.test.ts` 0 to 5. After the fixtures gain their brief both are green (24 of 24 and 31 of 31). The 8 files that fail on this branch before the change (`engineer-route`, `bootstrap-copies-match-toolchain`, `git-reads-name-their-checkout`, `host-tool-install`, `standalone-roots`, `tick-heartbeat-is-written`, `wake-engineer-brief`, `spawn-memory-floor`) fail the same without the check, so those are not moved; `live-tree-independence` (2 of 4 failing, outside that set) fails the same on the base. `tsc --noEmit` is clean.

Mutation: three, each red (re-run after the rebase for the first and the inverted check: 2 and 4 red) and each restore byte-identical (`cp` and `diff`): the check dropped (the spawn test and the source-text test red), the check made to always fire (the spawn test red and every `wake-spawn-worktree` spawn that expects a pane), the check moved after the claim (the spawn test and the source-text test red).

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json bash -c 'git grep -q "POSITIVE CONTROL" -- src/wake-spawn-brief-absent.test.ts && node --test src/wake-spawn-brief-absent.test.ts'`

Closes a11ign/agent-org#869

Outside-Region: src/wake.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign) and this tree is a11ign/agent-org; the file IS in the row's Region
Outside-Region: src/wake-spawn-brief-absent.test.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign) and this tree is a11ign/agent-org; the file IS in the row's Region
Outside-Region: src/wake-spawn-worktree.test.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign) and this tree is a11ign/agent-org; the file IS in the row's Region
Outside-Region: src/packaging/wake-drain.test.ts — the row's Region lists it without the `agent-org:` key, so `pr:open` reads it as a path of the first declared repository (a11ign/a11ign) and this tree is a11ign/agent-org; the file IS in the row's Region
Outside-Region: .changeset/a-spawn-whose-engineer-brief-869.md — the entry a project that pins a tag reads.

platform: n/a (the existing `exists` seam and `roleBriefPath` are reused, not retyped)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
