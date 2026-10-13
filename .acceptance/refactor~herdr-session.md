The herdr calls that open a workspace, start an agent and close a workspace move from `wake.ts` into `herdr-agents.ts`, each taking an optional `{ session }` that defaults to `org`. No behaviour change: the tick names `--session org` exactly as before.

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/herdr-agents-session.test.ts src/wake-reviewer-instance.test.ts src/wake-spawn-refusal-reason.test.ts
```

Consumer-declaration: none -- nothing a consumer sets changes.
