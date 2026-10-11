Receiver for GitHub deliveries (`src/event-receiver.ts`): verifies `X-Hub-Signature-256` over the raw body, drops a repeated delivery id, appends accepted events to a local queue, loopback only, with a heartbeat file.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/event-receiver.test.ts
git grep -q "NEGATIVE CONTROL" -- src/event-receiver.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/event-receiver.test.ts
```
