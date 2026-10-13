Ticket mode's queue starts paused, with Start workers and Pause on the Board (`queue.ts` `paused`/`setPaused`, `POST /api/paused`, `ui.html`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- no new setting; the queue file gains `paused`, read as paused when absent.
