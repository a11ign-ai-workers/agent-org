A `priority:chairman` row of a keyed tracker takes the spawn slot ahead of plain home rows: `scopeTick` reads the tracker's verified chairman rows and passes them to `decide` as `offerHierarchy`, so the chairman's row is offered first and carries `startFresh: true`. The labeller still decides (`CHAIRMAN_LOGINS`).

Acceptance:

```bash
cd /home/agent/repos/wt-agent-org-1085 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/keyed-chairman-row-spawn-slot.test.ts
```

Closes a11ign/agent-org#1085

Measured: the new file printed `VERDICT pass: 2 tests in 1 file`. Before the source change the first test failed for the reason the row names (the plain row 10 offered ahead of the chairman's row 20), and the control passed.

Mutation: dropping `offerHierarchy` from `decide` fails the chairman test (1 of 2). Ignoring the labeller in `readChairmanPriority` (any labeller counts) fails the control (1 of 2). Each restored and confirmed byte-identical with `diff`.

Not covered by the acceptance file: the wiring line in `trackerReadings` (`src/work-gate.ts`) is replaced by the test's own tracker stub, so a mutation there is not caught by this file.

platform: n/a (gate)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
