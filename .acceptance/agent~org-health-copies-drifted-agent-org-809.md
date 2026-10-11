org-health's `copies-drifted` no longer reads UNKNOWN for the two copies whose original a11ign#4718 moved to `@a11ign/toolchain/lib` (agent-org#809).

Closes a11ign/agent-org#809

Class: detector-pages-managers — any declared copy whose original moves (or is deleted) makes the signal read UNKNOWN every tick; guard: `org-health-fleet-and-copies.test.ts` pins that a moved original is read where it is installed and that every missing one, or a comparison no test makes, still reads `unknown`.

## What changes, and why

- **The two headers** (`src/lib/local-import-closure.ts`, `src/lib/worktree-resolution.ts`) name `@a11ign/toolchain/lib/<stem>` at 0.7.1 as their original, and `COMPARED IN` the test that compares them by names and behaviour (`bootstrap-copies-match-toolchain.test.ts`, agent-org#715). They stay copies: the tick runs before any install (agent-org#522).
- **`readDeclaredCopies`** (`src/org-health.ts`) reads an original named by package specifier through the installed package's `exports` map under `<root>/node_modules`, and records the named comparing test as `comparedIn` only when that file is readable and still carries the stem as a probe key.
- **`judgePair`**: an installed original is compared (clear) only with a `comparedIn`. The package ships compiled `.mjs`, so a line comparison would read every such copy as drifted.

## How you verified it

Done-when 1: the row's command, with the import taken from this tree (`./src/org-health.ts`), exits 0 against `/home/agent/repos/a11y-witness` (7 pairs, `clear`; before the change `7 unknown`). `src/packaging/org-health-fleet-and-copies.test.ts` carries the control: a moved original that is not installed, not exported, not shipped, unparseable, with no named comparer, with a gone comparer and with a comparer that no longer probes the stem each read `unknown`, and a gone original beside a clear moved pair keeps the reading `unknown`. Done-when 2 is the tick journal an hour after release, the claimant's to quote.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --input-type=module -e 'import { readDeclaredCopies, copyDriftReading } from "./src/org-health.ts"; const pairs = readDeclaredCopies({ root: "/home/agent/repos/a11y-witness" }); const reading = copyDriftReading({ pairs }); if (pairs.length < 7 || reading.status !== "clear") { console.error(pairs.length, reading.status, reading.detail); process.exit(1); }'` && `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/packaging/org-health-fleet-and-copies.test.ts src/packaging/bootstrap-copies-match-toolchain.test.ts`

Mutation: four mutants in `src/org-health.ts`, each killed by named tests of `org-health-fleet-and-copies.test.ts`: the comparison never required (the control test fails), a missing exported file read as present (the control fails), an installed original never recognised (the control, the moved-original test and the real-copies test fail), the comparing test not read for the stem (the control fails). Source restored with `cp` and `diff`ed identical.

## Anything a reviewer should be sceptical of

- **`rstest` and `pnpm run verify` could not run in this worktree** (its install has no `rstest` or `@types/node`): the tests above ran under `node --test` with a hybrid `node_modules` linking the primary's `@a11ign/toolchain`, 46 of 46 passing. `tsc` with `@types/node` borrowed from a11y-witness reports 63 errors, none in a file this change touches; that is not a green `typecheck`.
- **"Compared" is a delegation**, not a comparison done here: the copies are clear because a named test probes them, and the reading goes `unknown` the moment that test stops doing so. A copy the test no longer reaches by the tick's closure is not noticed by this check, only by that test's own derivation.
