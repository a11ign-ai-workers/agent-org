A closed row ends its claim, and so its pane, for a keyed `worker-<key>-<n>` holder as for a bare `worker-<n>` one (a11ign/agent-org#757, parent a11ign#4437). The closed-claim pass named its rows with `familyNumber`, which is `null` for `worker-agent-org-730` by design, so a keyed pane's row was never read, open or closed.

**What changes.**
- *Name a keyed pane's row.* `closedClaimsWhenWorkerListed` asks each declared tracker for the rows of the instances listed in it (`familyMember`: `worker-agent-org-730` is row 730 of `agent-org`), one call per tracker; the home tracker's read is made exactly as it was. `familyNumber` still answers `null` for a keyed label, so its other callers do not change meaning.
- *Same pass, either spelling.* The release carries the tracker's key (agent-org#834), so `performRelease` reads, comments on and declines the row in that tracker, and a `working` keyed pane is interrupted as a bare one is. The pane itself is ended by the spare teardown, which already handles keyed rows (`wake-teardown-keyed-rows.test.ts`).
- *A keyed pane is a worker pane in the closed-row label sweep (#3883).* `holdsClosedRow` counted it a standing seat (a day's grace); it is ten minutes after the close, as a bare-number one's.
- *Said, never silent.* A keyed label naming a tracker the project does not declare yields no read and a line saying so; one tracker's refused read is said and does not hold another's closed rows (every read refused is `rows: null`, never `[]`).
- `withClosedClaims` is exported so the test drives the orders the gate's `main` hands the stall pass.

Mutation: six, each red in its own tests and each restore byte-identical (copy in the scratchpad and `cmp`): a keyed label read as no row (7 red); the release losing its tracker key (3); a keyed pane counted a standing seat in the debris grace (1); a keyed pane not counted an instance, so no interrupt (1); open rows read as closed, the always-fires direction (3, one of them the existing #3535 control); the undeclared key never said (1).

Evidence: the two files below, 53 of 53 (11 new, 42 existing). `tsc --noEmit` is clean. The whole suite (`pnpm test`): 60 of 9636 fail, in 13 files; the same 60 fail in the same 13 files with `src/work-gate.ts` and `src/arm-pr.ts` restored to HEAD (measured: both runs, 388 tests in those 13 files), so none is this change's.

**Change 3, measured (the bare-number holder's wait).** From `~/.cache/a11ign/spare-cycles` (the cycle line is written when the teardown ends the pane, `clean: true`, role `worker-<n>` for row `<n>`) against GitHub's `closedAt` for the same row, the last 60 such rows since 2026-10-06: **minimum 5 s, median 95 s, 90th percentile 684 s, maximum 2069 s** (measured; the gate's ticks are about 2 min 7 s apart in the journal, read from four consecutive 2026-10-10 20:01-20:07 ticks). 54 of the 60 were closed by their own pull request and 6 by hand or as not planned (76-684 s). `GONE_CONFIRM_MS` (10 min) is therefore NOT the whole of it: 49 of 60 ended inside 4 min, a tick or two, and 7 took longer than 600 s. What the tail is made of (a working holder, an unconfirmed gone, a pane the teardown could not close) is not separated by this reading and is not claimed.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-closed-claim-keyed-pane.test.ts src/packaging/closed-row-ends-instance.test.ts`

Closes: a11ign/agent-org#757

Note on the row's own Acceptance: it names `src/work-gate-closed-claim.test.ts`, which does not exist (`git ls-files` finds no such file), and does `cd /home/agent/repos/agent-org`, the primary clone, which cannot see this branch (run verbatim there it prints `Could not find ...`). The command above runs the new file and the existing closed-claim tests, `src/packaging/closed-row-ends-instance.test.ts`, from this worktree.

platform: n/a (no GitHub, pnpm, systemd or git feature does this; the read is the existing aliased GraphQL `issue(number:)` call, one per tracker)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
