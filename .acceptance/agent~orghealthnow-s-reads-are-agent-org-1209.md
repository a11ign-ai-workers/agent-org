`orgHealthNow`'s readers that interleaved reads with effects are split into a read step and an effect step, with no behaviour change (a11ign/agent-org#1209, part 1 of the tick cut under 180 s, chairman a11ign#928). **The change.** The stale-wait lift and the board truth audit each read first and act second, in the order they always ran. `liftableWaits` names the holds the gate may lift from the waits alone; `applyHoldLifts` releases them and logs each lift that held. `readBoardTruthAudit` reads the audit with no post; `postBoardTruth` posts the day's table and labels the prose findings, best-effort as before. `liftResolvedHolds` and `boardTruthNow` are the two steps in order, so every existing caller keeps its signature and its result. The release seam (`raiseReleaseIncidents`, `readReleaseFailures`) was already split by seams and is unchanged. No flag, no new wake class, and nothing new is read.

**Read steps.** `liftableWaits` (the wait read, names the lifts and the remaining stale waits, performs no release), and `readBoardTruthAudit` (the open rows, closed rows, merged pull requests, herdr listing, roadmaps, epics and other trackers, performs no post).

**Effect order is unchanged.** The lift's releases run once per holder, in the order the read named them; a release that fails keeps its stale wait in `remaining`. The board truth post runs after the reads, with the audit the gate gets back, and the prose labels run inside it as before. Logging is not treated as an effect: the lines are the same text in the same order.

**Evidence.** `src/work-gate/org-health-reads.test.ts` runs the read steps against a recorded runner that answers the read verbs and throws on any effect verb, recording the call first. Positive controls: a reader with an effect is caught by the recorder, and the effect step `postBoardTruth` is caught by it when it posts. Mutations, each restored byte-identical: a write inside `readBoardTruthAudit` (3 red); the lift's holders released in reverse (1 red); `postBoardTruth` posting nothing (2 red). `tsc --noEmit` is clean; `org-health.test.ts`, `gate-lifts-resolved-holds.test.ts`, `board-truth-audit.test.ts`, `prose-flag-sends-an-order.test.ts`, `pr-hold-any-declared-repository.test.ts`, `release-failure-alarm.test.ts`, `packaging/wait-condition.test.ts` and `work-gate-runner-start-red.test.ts` pass unchanged (143 of 143).

**Not done here.** The production gate still passes the composed `boardTruthNow` as `readBoardTruth` (`src/work-gate.ts`, outside this region), so the tick's board-truth read still posts. Moving the gate to `readBoardTruthAudit` plus an explicit effect step is the follow-up that makes the read step the only one the tick runs.

Acceptance: `node --test src/work-gate/org-health-reads.test.ts`

Closes: a11ign/agent-org#1209

platform: the gate's own tick (no new wake class, no flag); `gh` reads and writes are unchanged in what they touch.
