Ticket mode reads each ticket's repository from its title scope (`src/ticket-mode/scope.ts`), and its Pick tab gains project filters and foldable status groups (`src/ticket-mode/ui.html`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode/server.test.ts src/ticket-mode/scope.test.ts src/ticket-mode/ui.test.ts
```

Consumer-declaration: none -- the page only; no setting or API changes.
