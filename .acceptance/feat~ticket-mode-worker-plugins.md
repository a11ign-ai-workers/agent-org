Ticket mode enables the host file's `tickets.plugins` in each worker's settings (`src/ticket-mode/settings.ts`, `worker-files.ts`, `pool.ts`), asks for screenshots of a visible change instead of saying a worker has no browser, and stops refusing a screenshot skill by name (`hook.ts`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- one optional host key; a host that declares none is unchanged.
