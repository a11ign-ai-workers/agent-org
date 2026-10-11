The claim-stall count line, `claim-stall: tracker \`agent-org\` (a11ign/agent-org): N claimed rows, N evaluated.`, is a position reading the tick prints once per keyed tracker per tick while it holds a claimed row. It is allowlisted in `src/repeating-lines.allowlist.json` as a position reading, the twin of the version banner and the checkout lines. The faulting forms of the same formatter stay offered: `... -- not evaluated.` (a row it cannot read or one with no claim record), `... -- its claimed rows were NOT evaluated this tick (UNREAD ...)` (a tracker it cannot read), `NO claim was evaluated this tick` (comments it cannot read), `is HELD, not released`, and `claim-stall: could not run (...)`.

The lines are the formatter's own output from `claimStallTick` with a fake `log` (`src/work-gate/claim-stall-tick.ts`), so a change to the wording fails the test rather than silently stopping the match. The count line is offered at 40 ticks with an empty allowlist and not with the shipped one, at 3 and at 11 claimed rows; each faulting form is not allowlisted and is still offered at 40 ticks with the shipped one.

Mutation, both directions, each restore byte-identical (`diff` against a copy in the session scratchpad, never `git checkout --`): entry widened to `^claim-stall` (1 of 4 red: `UNREAD open rows is not allowlisted`); entry removed (2 of 4 red: the allowed-by-shipped test and the not-offered-with-entry test).

Evidence: `src/repeating-lines-claim-stall-count.test.ts` 4 of 4 pass; `src/repeating-lines*.test.ts` and `src/work-gate-claim-stall*.test.ts` 151 of 151 pass in 6 files; `pnpm run typecheck` exits 0. `agent-org` has no `lint` script, so none was run.

Acceptance: `bash -c 'npx rstest run --config scripts/rstest/rstest.config.ts src/repeating-lines-claim-stall-count.test.ts src/repeating-lines-blocking-impact.test.ts'`

Closes a11ign/agent-org#941
