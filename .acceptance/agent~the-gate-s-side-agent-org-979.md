The gate's side of the event queue (`src/event-queue.ts`): events are read after a byte-offset cursor that moves only on `ackThrough`, a half-written last line is left for the next read, and each event maps to the pull request, issue, commit or merge group it names.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/event-queue.test.ts
git grep -q "NEGATIVE CONTROL" -- src/event-queue.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/event-queue.test.ts
```
