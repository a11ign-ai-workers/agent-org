With `workers.orchestratorOneShot` on, a ready `lane:orchestrator` row's order is addressed to `engineers` with a sibling cause and `briefRole: "orchestrator"`, so the spawn path starts the row's own seat, briefs it with `orchestrator.md`, writes a record of the spawn before the claim (`ceo`'s ruling B, #947) and holds a second fleet-or-lab row while one run is live. With the flag off (the default) the order, what `deliver` does with it and the record file are what they were.

Acceptance:

```bash
git grep -q "flag OFF: no record is written (the writer is not called)" -- src/orchestrator-one-shot.test.ts
bash -c 'cd ~/repos/wt-agent-org-832 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/orchestrator-one-shot.test.ts src/spawn-role-brief.test.ts src/packaging/wake-engineer-brief.test.ts src/wake-spawn-brief-absent.test.ts'
```

Mutation: each run and restored byte-identical (`diff` against a scratchpad copy). The record never written fails 3 of 12 (the record case, the refused-claim case and the flag-off control); the hold made never to fire fails 2 (the fleet-lab and `Fleet-hold-until` cases) and made always to fire fails 7; the flag ignored by the transform fails 2 (the byte-identical case and the flag-off control); the own-row-only offer dropped fails the idle-standing-engineer case alone; a standing address allowed for a one-shot fails the `spawnableRole` case alone; `briefRole` not handed to `addressed` fails the prompt case alone; the record not taken back after a refused claim fails that case alone.
