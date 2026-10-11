The agent-org copies `src/lib/cli-flags.ts` and `src/lib/git-env.ts` carry their a11ign originals' comment lines at `cc4dd7e09`, and their headers name that commit and no longer name the deleted `agent-org-outward-edges.test.ts` (a11ign/agent-org#1049).

- `cli-flags.ts`: one comment line, `packages/worker-fleet/` becomes `the fleet's laid directory`. Header: `at cc4dd7e09`.
- `git-env.ts`: four comment lines (the three the a11ign commit changed, plus `packages/lab` becoming `a11ign/lab`, which an earlier a11ign commit had already changed and this copy had not carried). Header: `at cc4dd7e09`.
- Both headers replace `agent-org-outward-edges.test.ts` with `copies-drifted` in `src/org-health.ts`.
- Files: the two copies, `.changeset/copies-follow-cc4dd7e09.md`, and this file.

Acceptance:
```bash
cd /home/agent/repos/wt-agent-org-1049 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/org-health-fleet-and-copies.test.ts
```

This command passes before the change too (the row's Open-check says so), so it does not discriminate. The measure that does is the drift reading, taken with `readDeclaredCopies({ root: <a11ign checkout>, toolRoot })` then `copyDriftReading({ pairs })`, at a11ign `54947391e` (`origin/main`, which contains `cc4dd7e09`):

Before (agent-org HEAD, `6947aff0`):
```
"signal":"copies-drifted","status":"tripped",
"detail":"2 declared copies drifted from the original: src/lib/cli-flags.ts against scripts/cli-flags.ts: 1 line(s) only in the copy, 1 only in the original, and its header names 0; src/lib/git-env.ts against packages/guards/src/git-env.ts: 4 line(s) only in the copy, 4 only in the original, and its header names 0"
```

After (this branch):
```
"signal":"copies-drifted","status":"clear","detail":""
```

Body identity: the copies' lines after the header are byte-identical to `git show cc4dd7e09:<original>` (checked by `diff`, empty).

Other checks, as run here:
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- The row's command: `VERDICT pass: 22 tests in 1 file`.

Mutation: not applicable. The change is in comments and headers. The guard that matters is `copyDriftReading`, and its before and after readings above are the discriminating check.
