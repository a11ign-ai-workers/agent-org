The ticket board's status sections start collapsed, toggle from their whole header, keep it pinned while their list scrolls, and open or close together with Expand all / Collapse all (`src/ticket-mode/ui.html`, tested by `src/ticket-mode/ui.test.ts`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- a page change; the remembered view setting is renamed from `ticket-mode.folded` to `ticket-mode.open`, so a browser forgets which sections it had folded once.
