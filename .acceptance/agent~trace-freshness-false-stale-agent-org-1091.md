The trace freshness unit reads `now` once, before the ingest spawn, and both `sessionsWorking` and `storeFreshness` use that reading (agent-org#1091). The ingest holds a message back against its own start; the check took `now` after the ingest returned, so a message 4:58 old at the start was 5:18 old at the check and counted as owed a turn, a false STALE. The ordering is now `ingestThenCheck` (exported, with an injectable `clock` and `ingest`), which `main` calls.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import=./src/lib/crash-exit.ts --test src/trace/freshness.test.ts'`

Mutation: the clock read moved after the ingest (the pre-fix order) failed only the new 4:58 case (1 of 29); `working` forced `false` failed only the new 5:02 positive control (1 of 29); `working` forced `true` failed only the 4:58 case (1 of 29). `src/trace/freshness.ts` restored from a `cp` backup in the scratchpad after each, `diff` clean.

Measured: the acceptance command prints `pass 29, fail 0` at this head. `src/trace/freshness.test.ts`, `src/trace/freshness-healthy-schedules.test.ts`, `src/packaging/host-units.test.ts` and `src/packaging/trace-store-readers.test.ts` together: `VERDICT pass: 413 tests in 4 files`. `pnpm run typecheck` exits 0. `lint`, `verify` and `test:org` are not scripts of this repository.

Not covered, and named: `main()` itself (the spawn of `trace.ts`) is not run by the new cases; they drive `ingestThenCheck` with a stand-in ingest that moves the clock, and the hold-back itself is `store.ts`'s and is tested there. A long ingest makes the reading as of its start, so the next run (five minutes on) reads again.

Closes a11ign/agent-org#1091

platform: n/a (an ordering inside the unit's own script; no platform feature reads a clock for it)
