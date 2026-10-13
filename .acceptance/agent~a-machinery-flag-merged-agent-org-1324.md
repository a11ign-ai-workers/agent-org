A machinery flag that is merged and absent from `machinery-canary.json` for more than two hours, with no open `ready` or `in-progress` row naming its key, is a `flag-without-a-switch` finding (`canaryAbsent` in `readFlagLedger`). A present flag, on or off, is decided. A row within two hours is not yet owed. An unreadable canary state, a merge date git could not give, or open rows that were not read (for a flag past its window) makes the answer UNKNOWN, never a clean list. `gate.graphqlPacing` is the flag this covers.

Acceptance: `node --test src/packaging/flag-switch-ledger.test.ts src/packaging/org-health.test.ts`

Measured: `node --test src/packaging/flag-switch-ledger.test.ts` reports 19 pass, 0 fail, including the seven `(7) agent-org#1324` cases (positive control, the named-row cases, the two-hour window, and the unknown cases). `node --test src/packaging/org-health.test.ts` reports 34 pass, 0 fail. `pnpm run typecheck` is clean.
