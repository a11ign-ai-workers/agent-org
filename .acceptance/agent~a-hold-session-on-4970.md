A `hold:<session>` on a pull request outlives no holder unseen (a11ign/a11ign#4970, chairman PRIORITY). **The incident:** approved pull requests sat held by sessions that had gone idle or vanished; the hold stops arming and nothing but the holder lifts a hold with no condition, so the pull request waited on a session that was no longer there to release it.

**What changes.**
- *Wake once.* Each tick, for every held pull request it already read, the gate reads the holder's herdr status and `worker:state` declaration. A holder idle 30 minutes with no excusing declaration, or no workspace carrying its label, is woken once: the order names the pull request, the hold, whether it is approved, and the three ways out (release, declare the wait as a field, re-take `--until`). A gone holder's order falls back to the escalation seat (`fallbackOnlyIfAbsent`), so it is one order, not two.
- *Then decide.* 30 minutes after the wake, still idle or gone, `orchestrator` (`ceo` when `orchestrator` is the holder) is ordered once to decide: release with the reason on the pull request, or take over. The label is untouched; no code removes a hold.
- *Left alone:* a working holder; `blocked`; `waiting-ci`/`waiting-review` naming this pull request (`waiting-review` not once approved). Not an excuse: `done`, another pull request's wait, a declaration older than the hold.
- *Silence is safe.* A herdr listing without `ceo` and `orchestrator`, an unreadable declarations directory or a refused pull-request list is no order and keeps the memory; the step never throws and makes no `gh` call (the tick's pull requests are in hand).
- New cause `hold-holder-idle` (ACTION, FINISH, `sonnet`/`medium`), memory `hold-holders.json`.

Mutation: ten on `src/pr-hold-state.ts`, each red with a restore byte-identical (copy in the scratchpad and `diff`): never waking (10 red); waking every tick (5); never asking for the decision (3); asking every tick (2); a declaration never excusing (3); a working holder not spared (2); `done` excusing (1); an incomplete listing trusted (1); a gone holder asking twice (1); `orchestrator` deciding its own hold (1). Two on `src/work-gate.ts`: the memory never written (2 red) and the call deleted from the tick (1 red).

Evidence: `src/pr-hold.test.ts` 17 of 17. The five pins the new cause touches pass (`project-roles`, `work-gate` classification, `worker-profile`, `project-vocabulary`, `gh-call-inventory`). `tsc --noEmit` is clean. The whole suite: 60 failures in 14 files that fail identically on a clean checkout of this base (measured there); the six this change caused are fixed.

Live reading (pure function over real facts, NOT a gate tick: the production gate acts): agent-org#866 was held by `worker-agent-org-747` at 08:09:28Z on 2026-10-11 (`Waiting-for: merged a11ign/agent-org#845`), approved 08:14:17Z, lifted by the gate at 08:43:41Z and merged 08:50:46Z. Replayed from the hold with the holder assumed idle (herdr keeps no history), the rule wakes `worker-agent-org-747` at 08:39:28Z, 4 minutes before the gate's own lift, and asks `orchestrator` at no point. Right now no pull request in either repository carries a `hold:*` label, and the real listing and state directory give no order.

Not done: item 4 of the row (the daily #928 reading of approved pull requests unqueued over 15 minutes, p90 approval-to-queue, and the 2-day incident), and a live gate tick showing the first real wake; this change does not close the row.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/pr-hold.test.ts`

Closes: none -- a11ign/a11ign#4970's item 4 (the daily #928 reading) is not built here and its Done-when 2 asks for a live reading the production gate must make after this merges; the row stays open for both.

Outside-Region: src/cause-declaration.ts — the new cause `hold-holder-idle` is declared where every cause is, with its model and effort.
Outside-Region: src/packaging/project-roles.test.ts — the pinned cause list and count (43 to 44) and the FINISH classification.
Outside-Region: src/packaging/work-gate.test.ts — the pinned FINISH list names the new cause.
Outside-Region: src/packaging/worker-profile.test.ts — the emitted-cause scan reads `pr-hold-state.ts`, where the orders are built.
Outside-Region: src/packaging/project-vocabulary.test.ts — two declared non-vocabulary hits in `pr-hold-state.ts` (the worker's `blocked` state, and the `answer:<session>` prose).
Outside-Region: docs/gh-call-inventory.json — regenerated; the new cause is in its cause table, no new `gh` shape.
Outside-Region: .changeset/a-hold-outlives-no-holder.md — the entry a project that pins a tag reads.

platform: n/a (no GitHub, pnpm, systemd or git feature beyond a read of `gh pr list` for the live reading)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
