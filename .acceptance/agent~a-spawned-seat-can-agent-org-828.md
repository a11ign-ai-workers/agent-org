Closes a11ign/agent-org#828

## Change
Phase 1b of a11ign/a11ign#4505, capability only. A spawned seat can be briefed with a named role brief; the default is the engineer's and unchanged.

- `src/spawn-role-brief.ts` (new): `SPAWN_BRIEF_ROLES` (frozen `["engineer", "orchestrator"]`) and `briefRoleSentence(role = "engineer", root?)`. The engineer's sentence moved here unchanged (`ENGINEER_BRIEF_SENTENCE`); `orchestrator` returns the same shape naming `orchestrator.md`. Any other name (`ceo`, `reviewer`, `""`, `"../engineer"`) throws naming the role and the allowed list; a listed role whose brief file is absent throws naming the path.
- `src/wake.ts`: `addressed` takes an optional `briefRole` (default `"engineer"`), read on the `spawned` branch only; the standing-seat branch is untouched. `wake.ts` imports the sentence, so `engineerBriefLine` keeps working. The default role takes the engineer constant directly, as before (no new file read on the spawn path).
- No caller passes `briefRole`; no order carries it; `SPAWN_CAUSES`, `spawnableRole`, `laneReason`, `fleetOrLabAcceptance` and `FLEET_LAB_PATTERNS` are not touched.

## Engineer sentence, byte length
Before (`origin/main` 5b68f561, `wake.ts` `ENGINEER_BRIEF_SENTENCE`): **167 bytes**. After (`spawn-role-brief.ts`): **167 bytes**, `===` the old text, evaluated from `git show origin/main:src/wake.ts` lines 3604-3605.

## What the cutover row must still add
1. The order field that carries the role (nothing on an order names a `briefRole` today).
2. The `spawnableRole` addressee: it still refuses any order not addressed to `engineers`, so an orchestrator one-shot cannot be asked for.
3. The one-run-at-a-time guard while a fleet or lab command is in the Acceptance (the fleet ban does not lift; the orchestrator role is exempt, so two concurrent runs would collide on the shared resources).

## Acceptance
```bash
bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/spawn-role-brief.test.ts src/packaging/wake-engineer-brief.test.ts'
```

## Evidence
Run from this worktree with `AGENT_ORG_HOST` set to the a11ign host file:
- `src/spawn-role-brief.test.ts`: 6 of 6 pass (default equals `briefRole: "engineer"` and the pinned origin/main literal, asserted over 100 bytes; orchestrator names `orchestrator.md` and not `engineer.md` with the default as negative control; the four refused names each throw naming the role; absent brief throws naming the path, with the present file as positive control; standing seat byte-identical with and without the option; `SPAWN_CAUSES` and `spawnableRole`'s `engineers` test read from the source text, with a fixture copy that adds a cause failing).
- `src/packaging/wake-engineer-brief.test.ts`: 15 of 16 pass. The one failure, `packages/lab/CLAUDE.md: the addition names the paths it governs in its first lines`, fails identically on the unmodified branch (checked before the first edit) and reads the a11ign checkout's lab file, not this change.
- `wake-order-shape`, `wake-spare-family`, `wake-followup-header`, `wake-one-row`: 49 pass. `tsc --noEmit`: clean.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
