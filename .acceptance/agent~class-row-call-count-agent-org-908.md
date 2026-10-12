The `row-call-count-signal` decision class (Move 3, a11ign/a11ign#4505): a file in `src/decision-run/classes/` whose default export is a `DecisionClass`. Nothing is switched on: `seatModeOf("row-call-count-signal")` stays `seat` until a project's `seats.json` says `run`, and that line is the revert.

**What it does.**
- Question: split the row or say it is one unit; default `one-unit`; allowed `one-unit | split | escalate`. `one-unit` posts the reason in `formatRowCallCountAssessment`'s shape (marker and `calls=N`, so the doubling guard reads it back) and changes nothing; `split` and `escalate` post the reason and add `answer-owed:<seat>`, since a split is a Region/Acceptance rewrite and a run never files rows.
- Tier question: Haiku default, Sonnet on a Sonnet pick or an under-floor answer (`serve-by-run`'s `tierFor`); `CALLS_FOR_LARGER_TIER = 300` is named in the question text. Role excerpt capped at 1024 bytes by a test.
- **Assumptions, said so:** the class shape hands `actionsFor` no item and no repository, so the claim check lives in `buildQuestion` (throws `GapGoneError`, which `serveByRun` turns into a fallback to the seat) and the row's scope is the named constant `ROW_SCOPE = a11ign/agent-org`. Orders naming a SET of rows (`1,2,3`) read as no item through `itemOfKey` and stay with the seat. A follow-up that gives a class its `ItemRef` would remove both.

**Baseline (measured, not inferred)** with `npx tsx src/trace/trace.ts --wake-outcomes --since 2026-10-05T00:00:00Z --until 2026-10-12T09:30:00Z --json 1`, which calls `outcomeSplit`: cause `row-call-count-signal` has **83 wakes, 72 wrote (86.7%), 0 no-op, 0 escalated, 11 null, 0 unsettled**. The row text said 82 and 69 for the week to 2026-10-11; this is the window ending at the head's time.

Mutation: allowed-answer check never firing (1 red, its own negative control); claim check never firing (1 red) and always firing (3 red); tier default moved to Sonnet (2 red). Each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `src/decision-run/classes/row-call-count-signal.test.ts` 10 of 10; `src/decision-run` with `src/serve-by-run.test.ts` green at this head; `tsc --noEmit` clean.

Acceptance: `bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/row-call-count-signal.test.ts'`

Closes a11ign/agent-org#908.

Outside-Region: src/serve-by-run.test.ts -- its tripwire "the default class registry holds no class" is exactly what the first class falsifies; it now asserts the registry holds this one class and that it is `seat` without a seats file.

platform: n/a (a class module the registry already defines)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
