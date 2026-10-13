Ticket mode's Pick tab: project filters, foldable status groups and a clearer "Work in" repositories bar (`src/ticket-mode/ui.html`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode/server.test.ts
```

Consumer-declaration: none -- the page only; no setting or API changes.
