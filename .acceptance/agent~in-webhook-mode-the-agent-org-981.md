**In `webhook` mode the tick's snapshot is moved by the event queue, so a quiet tick makes no GitHub call, and a dead receiver falls back to the probes (agent-org#981, part of a11ign/a11ign#5043).** `refreshTickSnapshot` gains an optional `events` input `{ changed, healthy, reconcileEverySeconds }`; absent, it is the poll path as before. `work-tick.ts` builds it from the host's `events` declaration, the queue and the receiver's heartbeat.

**What changes.**
- `src/tick-snapshot.ts`: with `events.healthy` the probes are not run; a repository in `changed` (matched without regard to case) bumps its counter and `bumpedAt`, one that is not keeps its counter, `verified-at` moves for both, the held ETags are kept for a fallback tick, and `due` uses `reconcileEverySeconds` in place of `MAX_UNCHANGED_SECONDS`. A reconcile interval that is not a positive number throws (it would never re-read). Not healthy, the probes run exactly as before.
- `src/work-tick.ts`: `eventsForTick` (new, exported) reads the host declaration: `poll`, no block, or a declaration that cannot be read pass no `events` and never touch the queue. For `webhook` it reads the queue, takes `healthy` from the heartbeat file (`<queue>.alive`, an ISO time, younger than 120 s; absent, unparseable and future-dated are all NOT healthy), and `refreshSnapshotOrSay` acks the cursor (`<queue>.cursor`) only AFTER `refresh` returned. The line gains `; EVENTS <n> events, oldest event waited <s>s`, `; EVENTS no events`, or `; EVENTS UNHEALTHY (heartbeat <age>s | heartbeat absent | queue unreadable: ...), probes run`.
- `src/tick-snapshot-events.test.ts` (new): 13 tests through the real `refreshTickSnapshot` and `refreshSnapshotOrSay` with an injected `run` that records every call.

**Two decisions the row did not spell out, said so.**
1. An event that names no repository, or a queue line that did not parse, cannot say which repository moved, so it names every declared repository (fail towards reading); the row says "pass `changedRepos(events)`", which drops both.
2. The queue is read and the cursor acked on an UNHEALTHY tick too: the probes that tick cover everything received before them, and leaving a dead receiver's backlog unacked would only re-bump once the receiver returns. An ack that throws leaves the snapshot standing (the generations are written) and says the events are read again.

**The numbers it changes** (counted from `probePaths` over `a11y-witness/.agent-org/project.json`: 9 distinct declared repositories, tracker and code together, measured by a script at this head). The snapshot step's `gh` calls per tick, before: 2 x 9 = **18**, every tick, whatever the answer. After, in `webhook` mode with a live receiver: **0**, on a quiet tick and on a tick with events (the re-read an event causes goes through the wrapper's cache, as today). Unhealthy receiver, or `poll`: 18, unchanged. The baseline gate-account reading is the one a11ign/a11ign#5043 records from `gh-ledger.ts --per-hour`, **5,000-13,800 calls an hour on 2026-10-10/11**: quoted from there, NOT re-measured here, and this row does not move it until the VERIFY row flips a11ign to `webhook`. Reads made AFTER the snapshot (the wrapper's own misses, its 150 s age limit) are not touched by this row.

Mutation: sixteen mutants, each red in its own tests and each restore byte-identical (the file copied to the scratchpad, written back, compared): healthy still probes (7 red); an unhealthy receiver skips the probes (2); every repository bumped (5); no repository bumped (4); case-sensitive match (1); reconcile interval ignored (1); reconcile used by the poll path too (1); `verified-at` not moved (1); held tags overwritten (1); heartbeat never stale (2); heartbeat never fresh (5); heartbeat limit off by one (1); ack before the write (1); never ack (4); unnamed event ignored (1); a poll host treated as webhook (2). One mutant I wrote first ("poll path handed events") stayed green because it was never reached (a host with no block parses to `{ source: "poll" }`, not `undefined`); it was replaced by the last one, which is.

Evidence: `src/tick-snapshot-events.test.ts` and `src/packaging/tick-snapshot.test.ts` (the poll path's own, untouched) 18 of 18; `tsc --noEmit` clean. The whole suite at this head: 5 of 10,145 fail, in 4 files (`live-tree-independence`, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`); the same 5 fail in the same 4 files on a clean `origin/main` (`7f6a0488`, measured: those four files run there), so none is this change's.

Acceptance: `bash -c 'git grep -q "POSITIVE CONTROL" -- src/tick-snapshot-events.test.ts && git grep -q "NEGATIVE CONTROL" -- src/tick-snapshot-events.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/tick-snapshot-events.test.ts'`

Closes: a11ign/agent-org#981

Outside-Region: .changeset/webhook-mode-snapshot-from-the-event-queue.md — the entry a project that pins a tag reads.

No live flip: a11ign stays on `poll` until the VERIFY row that flips it after the receiver and unit are live. The revert is the one line `"source": "poll"` in `host.json`.

platform: n/a (the queue, its cursor and the receiver's heartbeat are agent-org#977-#980; GitHub's own conditional requests are what the poll path still uses)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
