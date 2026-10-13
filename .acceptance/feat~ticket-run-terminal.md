A ticket-mode run that hands its ticket back is parked with its workspace and pane (`park`, `markResumed`, `unpark`, `isParked` in `src/ticket-mode/queue.ts`; `end`, `watchParked`, `resume`, `close` and `reconcile` in `pool.ts`), the board closes one through `POST /api/queue/<key>/close` (`server.ts`), and a live or parked run links its terminal from `tickets.terminal` (`settings.ts`, `terminalLink` and `runActions` in `board-view.ts`, drawn by `ui.html`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- an optional host key and a new board action; a machine without `tickets.terminal` shows no link, and parking changes only runs that hand their ticket back.
