The gate detects a circular wait (a pull request waiting on a row that B4 shelves because of that pull request) and breaks it: the holder is woken once with the narrow-or-take-in instruction, a cycle still standing on the next tick files an incident naming both rows and wakes orchestrator, and the daily pass can count cycles and how long each stood (a11ign/a11ign#5009).

Acceptance:

```bash
git grep -q "POSITIVE CONTROLS" -- src/work-gate-deadlock.test.ts
bash -c 'cd ~/repos/agent-org-wt-5009 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-deadlock.test.ts src/b4-cycle.test.ts src/blocking-impact.test.ts'
```

Closes a11ign/a11ign#5009

Mutation: six mutations of `src/b4-cycle.ts` (the first sighting makes no wake; it escalates too; the second tick never escalates; the escalation is not remembered; the detector always fires; the detector never fires), each run, each turning its own tests red, and each restored byte-identical.

Measured: the command above printed `VERDICT pass: 48 tests in 3 files` at this head, and `npx tsc --noEmit -p tsconfig.json` printed nothing. Mutations, each run and restored byte-identical (`diff` of the copy): (1) the first sighting makes no wake -- the #878 test and two more fail; (2) the first sighting escalates too -- the #878 test, the escalates-once test and two more fail; (3) the second tick never escalates -- the escalation test and the daily-count test fail; (4) the escalation is not remembered -- the same two fail on the third tick; (5) the detector always fires -- the plain-shelf test, the #878 test (its #874 and #888 would be woken) and 12 more fail; (6) the detector never fires -- the #878 test, the escalation test and 12 more fail.

Full suite, measured with `npx rstest run --config scripts/rstest/rstest.config.ts`: `60 of 9659 tests failed in 539 files`, in 13 files none of which imports `blocking-impact.ts` or `b4-cycle.ts`; the same 13 files on a clean `origin/main` checkout print `60 of 388 tests failed in 13 files`, so the 60 are not this change's.

Outside-Region: none. Not done: (a) Done-when 2, the live reading, waits for the next circular wait, and the #878 shape is seen live only once agent-org#921 (`worker:state blocked --on <n>` writes the native edge) ships; the fixture carries that edge. (b) The daily retro line: `org-retro.ts` is outside this Region, so `deadlockSummary` has a test and no caller yet; it is filed as its own row.

platform: GitHub's native `blockedBy` edge (the wait) and the failure ledger already in the repository; no new store beyond two optional keys in the existing `blocking-impact.json`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
