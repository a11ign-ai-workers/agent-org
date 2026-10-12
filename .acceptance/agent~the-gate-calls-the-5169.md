The gate reads its polling reads through the ETag/304 reader and the tick holds the per-tick GraphQL budget, behind `gate.restConditional` (a11ign/a11ign#5169, the wiring of #5128). Flag off is today's read; revert is the flag.

**What changes.**
- `work-gate/reads.ts`: with the flag on, `readPrs` and `readOpenRows` list through REST with the stored `If-None-Match` and keep what they read (`kept-reads.json` beside the validators). A `304` is answered from the kept body; a pull request whose head sha and `updatedAt` are unchanged is not re-read. A kept detail is asked again when a check on it is still running or it is older than `KEPT_READ_MAX_AGE_MS` (10 min), because a re-run, a check and `main` moving do not move `updated_at`. `defaultRun`, the capturing runner and `runBatch` charge the budget the tick holds; any failure of the conditional path is said and answered by the read as it always was.
- `work-gate/tick.ts`: when the process is the gate and the flag is on, the tick holds `tickBudget` through `cutBackFirst` (a cause past `CAUSE_SHARE` of the cap is refused once `CUT_BACK_FROM` of it is spent) and writes the `gate-budget:` and `gate-rest:` lines on exit.
- `ticket-port/conditional-reads.ts` (new, declared below): the arguments of the two calls this adds, because `gh-call-ratchet.test.ts` refuses a new call shape in a baselined file and the spawn stays in `ghWithin`.

**Tests** (in `src/gh-conditional.test.ts`, the row's file): 11 cases added, 26 in the file. They cover the stored ETag sent and a 304 reading nothing from GraphQL; only the moved pull requests viewed; a running check and an aged detail re-read (the positive control); flag off as today with no REST ask and nothing kept; a failed REST read said and read as today, and a refusal `null`; the rehearsal's `[]` never kept, on a cold store and over a warm one; `readOpenRows` kept, moved, aged and flag off; `cutBackFirst` cutting the over-share cause first; the tick lines; and a held budget charged by `defaultRun` and `runBatch` and stopping them at its cap.

Mutation: 11 mutations, each caught by at least one test and each restored byte-identical (copy made first, `diff` after): conditional path never taken (5 red); nothing ever unchanged (3 red); `stillMoving` never true (1) and always true (3); an empty whole list kept over held details (1); open rows kept without agreeing with the listing (1); open rows never answered from kept rows (1); `runBatch` not metered (1); `defaultRun` not metered (1); `cutBackFirst` never cutting (1) and cutting every cause (1).

Evidence, measured at this head: `src/gh-conditional.test.ts` 26 of 26 under the acceptance command; `src/packaging/gh-call-ratchet.test.ts`, `src/ticket-port/ticket-port.test.ts` and `src/packaging/gh-call-inventory.test.ts` pass; `tsc --noEmit` clean. A run of `src/work-gate`, `src/packaging`, `src/gh-conditional` and `src/trace` (6,532 tests) fails four, none touched by this diff: `work-gate-other-scopes-concurrent` (`14 !== 16`, failing before this change), `live-tree-independence` x2 (`Cannot find module 'tsx/package.json'`: the worktree's node_modules) and `release-tag-on-merge` (a lockfile expectation).

NOT measured: the live hour (Done-when 2) needs the marker on the host and a real tick, and an engineer may not touch the fleet; it is filed as its own row. That a `304` is free to GitHub's primary rate limit is documented by GitHub and not measured here. The cost of a `pr list` (1 point at 20, 7 at 100) is the measurement of 2026-10-05 the code cites; `POINTS_PER_GRAPHQL_READ = 1` is an estimate. The open-check's `If-None-Match` count in `src/work-gate` is a mention in a comment: the header is built in `ticket-port/conditional-reads.ts`, which is the line that makes the sentence true.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/gh-conditional.test.ts'`

Closes a11ign/a11ign#5169.

Outside-Region: src/ticket-port/conditional-reads.ts — the call-site ratchet (agent-org#826) refuses a new `api` or `pr view` shape in the baselined `work-gate/reads.ts`; ADR 0046 sends it through the port, and a baseline rise has no door.
Outside-Region: .changeset/the-gate-reads-conditionally-behind-its-flag.md — the entry a project that pins a tag reads.

platform: n/a (a read path in the gate; no platform feature polls with validators)
