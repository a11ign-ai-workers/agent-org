The ticket board's Board tab lists runs with a status each (`runStatus`, `statusCounts`, `runsShown` in `src/ticket-mode/board-view.ts`, drawn by `ui.html`), and a run turns Completed once the tracker completes its ticket (`stateTypes` in `source.ts`/`linear.ts`, `recordTrackerStates`/`unsettledKeys` in `queue.ts`, `refreshTracker` in `pool.ts`, scheduled by `server.ts`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- a page change and one optional `TicketSource` read; a source without it never marks a run completed.
