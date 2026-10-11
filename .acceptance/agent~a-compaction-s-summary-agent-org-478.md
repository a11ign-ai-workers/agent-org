A compaction's summary call is in the trace store (a11ign/agent-org#478, chairman direction a11ign#4437 of 2026-10-09: "Compaction calls are recorded", about $0.10 each and about $16 a day, absent).

**Change 1, measured (where the summary call's usage exists).** The transcript has none, the exporter's `api_request` has it.
- *Transcript:* 0 of 1,351 compactions of the last 14 days' transcripts (Claude Code 2.1.296) have a record with a `usage` inside the call's window `[summary - durationMs, summary]`. The summary is a `user` record (`isCompactSummary`), `compact_boundary` carries `preTokens`, `postTokens`, `durationMs`, and no `assistant` record is written for the call.
- *OTel:* a live `/compact` of a probe session exported one `claude_code.api_request` with `query_source: "compact"`, `model: claude-haiku-5-5`, `input_tokens 1998`, `output_tokens 646`, `cache_read_tokens 22415`, `cache_creation_tokens 70`, `cost_usd 0.0007557`, `duration_ms 3545`, five milliseconds before the transcript's summary record. The session's `cost-state` `modelUsage` delta for haiku matched those five counts exactly.
- *Neither covers the past:* the store holds one `api_request` (the exporter was not running for these sessions), so every stored compaction is `unmeasured` until a session runs with the receiver up.

**What changes.**
- The receiver stores `query_source` as `querySource`.
- `measureCompactions` / `withCompactionUsage` join a compaction to the `compact` request of its own session (`session.id` is the transcript's file id) within 60 s, one request to one compaction; the SAME event id is corrected, so the store gains no event and no turn. `tokens`, `model` and `costUsd` (by `costOf`, null for an unpriced or unnamed model, never 0).
- A compaction no request reaches is `costUsd: null`, `unmeasured: "no-usage-record"`.
- The aggregate's compaction line sums the summary call with the re-read where measured, counts the unmeasured apart (the dollars are then a floor) and prints `ESTIMATED ~$<n> at $0.1 each, not a reading` beside it; `DEFINITIONS` names the spend unmeasured and the chairman's ~$16 a day estimate.

**One real day (the store, read-only, UTC 2026-10-09):** 271 compactions, 0 measured. The aggregate's compaction line: `271  >= $30.5717, 12,022,146 tokens; 271 summary calls UNMEASURED (... ESTIMATED ~$27.1000 at $0.1 each, not a reading)`. The $30.57 is the re-read of the window after each (a floor), the summary calls are not in it. Beside the chairman's ~$16 a day: 271 x $0.10 is ~$27, not ~$16, so the chairman's per-call and per-day figures cannot both hold at 271 compactions a day. Neither is a reading; the first measured day is the first day a session runs with the receiver up.

Mutation: three, each red and each restore byte-identical (copy in the scratchpad and `diff`): an unnamed model priced 0 (1 red); an unmeasured compaction stored `costUsd: 0` (2 red); the ingest not joining (1 red). The first mutant passed until the unnamed-model case was added, so that case exists because of it.

Evidence: `src/packaging/trace-compaction-spend.test.ts` 10 of 10. The trace suites and `trace-store-compact` pass together (401 in 22 files). `tsc --noEmit` reports no error in a file this change touches (81 elsewhere, `@a11ign/toolchain` not resolvable in this checkout).

Not done: no cost-state fallback. `cost-state` records hold the cumulative per-session `modelUsage` and would price the compactions of a session that ran with no exporter, but it cannot be split per compaction; left as a lead.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/trace-compaction-spend.test.ts`

Closes a11ign/agent-org#478

Outside-Region: src/trace/aggregate.ts — the compaction line is where the dollars are summed and the unmeasured are counted apart; `DEFINITIONS` lives there.
Outside-Region: src/trace/aggregate.test.ts — the REPEAT CLASSES fixture's compaction has no usage record, so its line is now a floor with one unmeasured.
Outside-Region: src/trace/trace.ts — `ingest()` is where the batch meets the store's stored requests.
Outside-Region: src/trace/otel-receiver.test.ts — the real-request expectation gains `querySource`.
Outside-Region: .changeset/a-compactions-summary-call-is-in-the-trace.md — the entry a project that pins a tag reads.

platform: n/a (no GitHub, pnpm, systemd or git feature; fixtures only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
