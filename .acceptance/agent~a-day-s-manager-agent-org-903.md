`trace manager-spend --day <YYYY-MM-DD>` prints a UTC day's manager spend, wakes, wakes served by a run, read through `readStore` and de-duplicated by event id (a11ign/agent-org#903, Move 0/4 measure of a11ign/a11ign#4505). New: `src/trace/manager-spend.ts` (`managerSpendReading`, `renderReading`, the target band $60 to $80 and the $109 baseline as constants) and its test; `trace.ts` gains the import and one dispatch line.

- Spend is `costBy(..., "session")`'s at both prices (PRICES, and cache reads at $0.20/M); wakes are split `wrote` / `no-op` / `escalated` / outcome unknown (`null` or absent, never `no-op`).
- `servedBy: "run"` is counted; a wake with no `servedBy` is counted in its own `lacking` figure and is neither run nor seat. The field is not on `TraceEvent` yet (the cutover-seam row adds it), so it is read off the event without touching `store.ts`.
- An empty day renders `**0 manager wakes**` and a table of zeros.

Mutation: three, each red, each restore byte-identical (`diff` clean): de-duplication removed (1 red: the twice-written event); the day's upper bound removed (2: positive control, the outside-the-day case); an absent `servedBy` counted as run (3).

Evidence: `src/trace/manager-spend.test.ts` 8 of 8; `src/trace/trace.test.ts` 77 of 77; `tsc --noEmit` clean. MEASURED from the real store at `~/.cache/a11ign/trace/events.ndjson`, read through `readStore`, 2026-10-10 UTC: 428 manager wakes (ceo 99, product-manager 210, orchestrator 119), 376 wrote, 19 no-op, 33 outcome unknown; **$122.63** at the primary price and $167.81 at cache reads of $0.20/M, against the $109 baseline and the $60 to $80 band; 0 of 428 served by a run, and all 428 lack `servedBy` (the field does not exist in the store yet, so that is absence, not seat).

Acceptance: `bash -c 'git grep -q "POSITIVE CONTROL" -- src/trace/manager-spend.test.ts && git grep -q "NEGATIVE CONTROL" -- src/trace/manager-spend.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/trace/manager-spend.test.ts'`

Closes: a11ign/agent-org#903

platform: n/a (a pure function over the existing store reader; no GitHub, pnpm, systemd or git feature applies)

Deviation: the row's third command is `cd ~/repos/agent-org && npx rstest ...`. That directory is a detached v0.155.9 checkout that cannot hold this branch's file, so the same rstest command runs from the branch's own checkout.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
