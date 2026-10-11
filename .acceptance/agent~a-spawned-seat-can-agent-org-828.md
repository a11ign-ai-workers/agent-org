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
npx rstest run --config scripts/rstest/rstest.config.ts src/spawn-role-brief.test.ts src/packaging/wake-engineer-brief.test.ts --testNamePattern '^(?!packages/lab/CLAUDE\.md: the addition names the paths it governs)'
```

The row's command, with two differences, both because the row's form cannot pass here and not because of this change:
- No `cd ~/repos/agent-org`: that directory is the tool's release checkout (v0.152.3, `node_modules/.../rstest.js` absent), so it neither holds these files nor can run rstest. The command runs in this checkout.
- One test is excluded by name: `packages/lab/CLAUDE.md: the addition names the paths it governs in its first lines` in `wake-engineer-brief.test.ts`. It asserts `existsSync(<a11ign checkout>/packages/lab/src/training/corpus-settled.mjs)`, and a11ign `main` (8a374757a, a11ign#4927 `.mjs` to `.ts`) no longer has that path. It fails the same on an untouched `origin/main`, and `wake-engineer-brief.test.ts` is outside this row's Region, so it is not fixed here. It wants its own row.

## Evidence
Run from this worktree with `AGENT_ORG_HOST` set to the a11ign host file:
- `src/spawn-role-brief.test.ts`: 6 of 6 pass (default equals `briefRole: "engineer"` and the pinned origin/main literal, asserted over 100 bytes; orchestrator names `orchestrator.md` and not `engineer.md` with the default as negative control; the four refused names each throw naming the role; absent brief throws naming the path, with the present file as positive control; standing seat byte-identical with and without the option; `SPAWN_CAUSES` and `spawnableRole`'s `engineers` test read from the source text, with a fixture copy that adds a cause failing).
- `src/packaging/wake-engineer-brief.test.ts`: 15 of 16 pass; the 16th is the stale-path test excluded above, red before any edit of mine.
- `wake-order-shape`, `wake-spare-family`, `wake-followup-header`, `wake-one-row`: 49 pass. `tsc --noEmit`: clean.

Mutation: three mutants of the change, each run against `src/spawn-role-brief.test.ts`. (1) role validation disabled: the refusal test went red. (2) the sentence's tail altered: the byte-for-byte and absent-brief tests went red. (3) `addressed` ignoring `briefRole`: the orchestrator and refusal tests went red. Each restored byte-identical; the six pass after.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
