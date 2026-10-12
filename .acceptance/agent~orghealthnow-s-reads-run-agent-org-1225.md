Closes #1225

## What changed

`orgHealthNow`'s `gh` reads now go through `readWithFirstWaveTogether`, so they are asked together in one wave. The effects run after the wave, on the data it read, once each.

- The wave (`orgHealthTogether`, `src/work-gate/org-health.ts`) reads release runs, release failures, fleet-build incidents, team access, the latest merge and the board's reads. The herdr read happens once, outside the rehearsal.
- `src/work-gate.ts` calls `orgHealthTogether` in place of `orgHealthNow` for the org-health span.
- Effects stay effects and stay outside the wave: raising release incidents, the hold lifts, posting the board's truth, the class-repeat rows (files rows), and the release-behind cache.
- `src/packaging/tick-budget.test.ts` runs the org-health phase in a child process with a stub `gh` on its PATH, counts the spawns, and fails above the ceiling `phases["org-health"].spawns` in `docs/gh-call-baseline.json` (currently 7). A cut lowers that number by hand; a rise is refused.
- Source-text pins that named the old call-site wording now name the wave's thunks and `orgHealthTogether`. Each keeps what it guards.

No new wake class and no flag.

## Timings (not measured here)

Production timings cannot be measured in this environment. The org-health span's wall times are therefore **not** measured after this change.

| | wall p50 | wall p95 | gh reads |
|---|---|---|---|
| Before (quoted from the row) | 37.0 s | 53.6 s | 31 |
| After | not measured here | not measured here | not measured here |

The before figures are quoted from the row, not re-measured.

## Spawn count

The wave changes when the calls happen, not how many. The rehearsal makes no spawns, and the wave uses the same readers with the same `run`, so the count is the same as before. The row's "below baseline" wording is not something the wave alone achieves, and this PR does not claim it.

The only count measured here is the fixture count: 7 spawns for one org-health pass on the org-health fixture with no rows and no PRs, from the stub. I did not measure the same fixture on HEAD, so there is no before/after on the fixture. The 31 in the table is the production count from the row and is a different population.

## Ordering change (the one)

The board's gh reads (closed rows, merged PRs) now happen before the hold lifts, not after. The lifts change only holds, and the board's facts do not depend on them, so this should be harmless. Review this if you are not convinced.

## Acceptance

```
node --test src/packaging/tick-budget.test.ts
```

Passes (1 test, 0 failures). Also run: the related set of 13 test files (board-truth-audit, org-health-release-failed, release-failure-alarm, work-gate-runner-start-red, the org-health work-gate tests, gate-lifts-keyed-hold-at-labelling, gh-call-ratchet, and others): 155/155 pass. `pnpm run typecheck` exits 0.

## Full suite (`pnpm test`): four failures, not caused by this change as far as checked

- `src/packaging/host-install-agent-org-launcher.test.ts` ("an absent launcher") and `src/packaging/live-tree-independence.test.ts` (two "#3233" tests): `Cannot find module 'tsx/package.json'`. `node_modules/tsx` is absent in this worktree. Not verified on HEAD.
- `src/packaging/release-tag-on-merge.test.ts` ("the call names pnpm and changesets..."): expects no lockfile, but `pnpm-lock.yaml` is tracked (last changed in 53875027). Pre-existing staleness. Not verified on HEAD.

## Machinery

Flag: none -- the row asks for no flag; the change ships unflagged and is undone by reverting this PR.
Health-signals: wakes-held, release-failures
Revert: revert this PR (the wave and its effects are the only change; no state migrates).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
