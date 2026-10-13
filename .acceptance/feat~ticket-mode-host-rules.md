Ticket mode reads `tickets.brief`, a markdown file joined to every worker's brief, and `tickets.deny`, Bash commands its hook refuses with a reason (`src/ticket-mode/settings.ts`, `worker-files.ts`, `hook.ts`, `pool.ts`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- two optional host keys; a host that declares neither is unchanged.
