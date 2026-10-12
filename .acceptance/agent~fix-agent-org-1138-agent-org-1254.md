Closes a11ign/agent-org#1254

## What changed

Fixes a11ign/agent-org#1138. Behind the existing flag `workers.ceoOneShot` (default OFF; OFF stays byte-identical).

- **Path rows only (`src/ceo-one-shot.ts`, `isPathRow`, `withCeoOneShot`).** A ready `lane:ceo` order is converted to a one-shot run only when its row is a PATH row: `declaredRegionFiles` names at least one file and `declaresNoCommit` is false. A DECISION row (no Region, an empty Region, or a Region saying its deliverable is not a commit) keeps the gate's order for the standing ceo seat. The filter fails closed: no row reader, no row, or a row whose body cannot be read keeps the gate's order.
- **One factory (`oneShotFactory` in `src/ceo-one-shot.ts`).** The ceo and orchestrator one-shot lanes are built from it. The duplicate module body is removed from `src/orchestrator-one-shot.ts`, which is now bindings over the factory. Its exports and error messages are unchanged.
- **Wiring (`src/wake.ts`).** `withCeoOneShot` receives `rowOf: rowRefOfOrder` and `readRow: readRowForTier`, so the filter has a row to read.

## Acceptance

```
node --test src/ceo-one-shot.test.ts
```

15/15 pass. The new tests pin: a PATH row converts and a DECISION row keeps the gate's order, with the body as the only difference; the filter fails closed and the flag-OFF array is the same array; both lanes build from one factory, and a fixture copy of the duplicate body fails the check. Mutation controls: removing the path filter turns the decision assertions red, and restoring it turns them green again.

Also run: `node --test src/orchestrator-one-shot.test.ts` 12/12; the 48 suites that import `wake.ts` 767/767; `pnpm run typecheck` exits 0.

Not run: the full `pnpm test` (rstest) suite. This package has no `lint` or `verify` script.

## Outside the Region

These paths belong in this PR; each is named here with its reason.

Outside-Region: src/wake.ts — the filter needs its row reader wired in at the one call site that builds the ceo's orders (`withCeoOneShot(..., { rowOf: rowRefOfOrder, readRow: readRowForTier })`); without it the filter fails closed and the ceo lane is a no-op.
Outside-Region: src/orchestrator-one-shot.ts — Change 2 requires its duplicate body to go; the module now binds the shared `oneShotFactory` and re-exports the same names.

The changeset `.changeset/the-ceo-one-shot-converts-only-a-path-row.md` is exempt (a changeset is not Region).

## Open

- The path rule uses the project checkout's tracked top-level directories (`region-paths.ts`, `pathInProse`), so a `src/…` Region is recognised only where that directory is tracked. This is the parser's existing behaviour and is unchanged here.
- With the flag ON, a matching order costs two `gh` reads per tick, uncached.
- The orchestrator's hold does not count the ceo's stand-in records, and the reverse.
- Parent a11ign/agent-org#1138 could not be read with `gh` ("Could not resolve to an Issue"), so it is not closed by this PR.

## Machinery

Flag: workers.ceoOneShot (existing; this PR does not add or change a flag)
Health-signals: claims-refused, wakes-held
Revert: `agent-org machinery:flag off workers.ceoOneShot`; reverting this PR also removes the code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
