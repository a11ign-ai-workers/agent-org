Ticket mode (`src/ticket-mode/`): a local board where a person picks Linear tickets and a pool of Claude workers turns each into draft pull requests.

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- optional host keys; a host that declares neither `clones` nor `tickets` is unchanged, and no existing command reads them.
