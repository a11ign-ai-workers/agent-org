Class `ready-rows-untiered` (agent-org#909, Move 3 of a11ign/a11ign#4505): the Tier line of a ready row is a `DecisionClass` a one-shot run can serve, Haiku by default for the run itself. A file and its test; nothing is switched on (`seatModeOf("ready-rows-untiered")` stays `seat`).

**What changes.**
- `src/decision-run/classes/ready-rows-untiered.ts`: the question (the order, default `sonnet-line`, allowed `sonnet-line | haiku-label | escalate`), `actionsFor` (`sonnet-line` posts one line opening `Tier: sonnet -- <reason>`, collapsed to one line outside any fence, which `hasTierDecision` counts; `haiku-label` posts the reason and adds `tier:haiku`; `escalate` and anything else is no action), `tierQuestion` (default `haiku`), and a role excerpt capped at `ROLE_EXCERPT_CAP_BYTES` (1400).
- `haiku-label` is allowed in CODE only when the body's Acceptance section holds a fenced block with a command line (`acceptanceIsCommand`); a row no longer `ready`, or with a Tier line in its body, allows only `escalate`.
- **Assumptions, said so:** the order is a sweep over N rows, so a run decides the FIRST row its prompt lists (the sweep key changes when it leaves the set). The port shows neither a `Tier:` line in a comment nor the `tier:haiku` label (`TicketFlag` has no such flag), so "the gap is gone" is read from the state, the body and any flag shown; the apply's staleness check covers the rest. `tier:haiku` is added through a cast, as the adapter writes an unnamed flag as the label of that name. The tier thresholds are the provider's (`serveByRun`); the class names the two tiers.

Measured: (done-when 3) `outcomeSplit` over `readStore(~/.cache/a11ign/trace/events.ndjson)` (1,310,890 events, newest 2026-10-12T09:20Z), window 7 days to 2026-10-12T09:22Z: `ready-rows-untiered` 36 wakes, 32 wrote (88.9%), 0 no-op, 0 escalated, 4 null, 0 unsettled. The row's own 23 / 22 was an earlier reading. Read-only; no ingest was run.

Mutation: haiku guard never firing (1 red) and always firing (2 red); open-row guard dropped (1 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `npx rstest run ... ready-rows-untiered.test.ts` 7 of 7 at this head; `pnpm run typecheck` clean. Measured, not inferred.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/ready-rows-untiered.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/ready-rows-untiered.test.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/ready-rows-untiered.test.ts'
```

Closes a11ign/agent-org#909.

platform: n/a (a class file for the registry the row's predecessor built)

Outside-Region: src/serve-by-run.test.ts — its "default registry holds no class" case asserted the premise this row ends; it now asserts the registry holds this class, without an exact list so each class row stops editing the line.
Outside-Region: .changeset/the-ready-rows-untiered-class-exists.md — the entry a project that pins a tag reads.
