Class `unclaimed-blocker-cleared` (agent-org#907, Move 3 of a11ign/a11ign#4505): promote-or-hold of one row whose blocker closed is a `DecisionClass` a one-shot run can serve, Haiku by default. A file and its test; nothing is switched on (`seatModeOf("unclaimed-blocker-cleared")` stays `seat`).

**What changes.**
- `src/decision-run/classes/unclaimed-blocker-cleared.ts`: the question (the order, default `hold`, allowed `promote | hold | escalate`), `actionsFor` (`promote` posts and sets `ready`; `hold` posts and changes nothing; `escalate` and anything else is no action, so `serveByRun` falls back to the seat), `tierQuestion` (default `haiku`, allowed `haiku | sonnet`), and a role excerpt capped at `ROLE_EXCERPT_CAP_BYTES` (1400).
- `promote` is guarded in code: it needs the head named in the order (`Head: <sha>`), the answer's `openCheckHead` equal to it, an `Open-check` section in the body, a shelved item (`backlog` or no state), no hold flag and every edge closed (no open `blockedBy`, no `waitingFor`, no `not before` ahead). Otherwise `promote` is not allowed and its answer is no action.
- **Assumptions, said so:** (1) the order today carries no head, so until the gate stamps `Head: <sha>` into the prompt `promote` is never available and the class holds: that is the safe direction, and the gate change is outside this Region and goes to a new row. (2) The class is handed no tracker scope, so `SCOPES` maps the two tracker keys this project declares, as `answer-owed` does. (3) The tier thresholds are `serveByRun`'s and the provider's, so no threshold constant is named here that nothing reads.

Measured: (done-when 3) `outcomeSplit` over `readStore(~/.cache/a11ign/trace/events.ndjson)`, window 2026-10-05T00:00Z to 2026-10-12T00:00Z: `unclaimed-blocker-cleared` 211 wakes, 188 wrote (89.1%), 1 no-op, 0 escalated, 22 null, 0 unsettled (all causes: 6,115 wakes, 5,020 wrote). Read-only; no ingest was run.

Mutation: `promote` made the default (`default: PROMOTE` in `buildQuestion`): 1 red, `POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions`. The `promotable` guard dropped from `actionsFor`: 1 red, `NEGATIVE CONTROL: a promotion is no action while an edge stands, ...`. Each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `rstest run src/decision-run/classes/unclaimed-blocker-cleared.test.ts` 7 of 7 at this head; `pnpm run typecheck` reports no error. Measured, not inferred. `pnpm run verify` was not run here.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/decision-run/classes/unclaimed-blocker-cleared.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/classes/unclaimed-blocker-cleared.test.ts
bash -c 'cd "$(git rev-parse --show-toplevel)" && npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/classes/unclaimed-blocker-cleared.test.ts'
```

Closes a11ign/agent-org#907.

Outside-Region: src/serve-by-run.test.ts — the class registry test names the classes it knows; `unclaimed-blocker-cleared` joins that list.
Outside-Region: src/packaging/project-vocabulary.test.ts — declares the port state names the class uses, as `ticket-port/` does.
Outside-Region: .changeset/class-unclaimed-blocker-cleared.md — the entry a project that pins a tag reads.

platform: n/a (a class file for the registry the row's predecessor built)
