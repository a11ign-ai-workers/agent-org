## Acceptance

```bash
node --test src/trace/freshness.test.ts
```

```bash
git grep -q "HELD BACK" -- src/trace/freshness.test.ts
```

The row's `cd /home/agent/repos/agent-org` is dropped: that is the primary checkout, which does not hold this change until it merges (as with agent-org#709's file).

## Mutation

The old working test, `newestMessageAt(path) >= since` in place of `newestMessageAt(path, now - QUIET_MS) ?? 0) >= since`: the HELD BACK timeline case goes red (its NEGATIVE CONTROL), and the positive control (one message between the turn and `now - 5 minutes`) stays green. The opposite, `return true;`: the negative controls go red.

Closes: a11ign/agent-org#836

platform: n/a (no GitHub, pnpm, systemd or git feature; the hold-back is `QUIET_MS` from `store.ts`, imported and not re-declared)
