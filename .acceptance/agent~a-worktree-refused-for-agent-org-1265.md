A worktree refused for its toolchain now says why the claim's install did not leave one. `worktreeToolchainReason` (`src/wake.ts`) takes the install outcome and appends it to the refusal: `the claim's install: install failed: <first error line>`, `the claim's install: not ready: <what>`, or `the claim's install: no install ran` when the claim reported none. The outcome travels from the claim's own STARTED line (`claimLineFor` in `src/row-claim.ts` already writes `/ ${install}` there) through `spawnClaimer`, which reads it into a new `ClaimedRow.install`, into the gate's `reason`, and onto the row through `sayToolchainRefusal`. Nothing else in the spawn or the refusal path changes.

Acceptance: `node --test src/wake-worktree-toolchain.test.ts`

Measured: the acceptance command above, run in this worktree on the final bytes of `src/wake.ts`, 8 of 8 pass (`ℹ tests 8 / ℹ pass 8 / ℹ fail 0`), exit 0. `pnpm run typecheck` exits 0. The repository has no `lint` or `verify` script, so neither was run. Earlier, before the mutation work and on the same `src/wake.ts` bytes, the related suites over 25 files passed 988 of 988.

Done-when, as the row asks: the test drives a refused tree with an install-failed outcome (`install failed: ERR_PNPM_FETCH_404 GET https://registry.example/typescript: Not Found`) and with none, and checks the line is present, or `no install ran`, on the reason, on the row and in the decline event. Each has a control that goes red when the line is dropped.

Mutations, each applied to `src/wake.ts` by a script that saved a copy first, ran the acceptance file, and restored the copy with `cp`. Each restore was proven with `cmp` against the saved copy (`restored: src/wake.ts byte-identical to the saved copy`). The `diff -q` line before each run confirms the mutation changed the file.
- A, the install text dropped from the reason (`; the claim's install: ${install}` removed): both install tests fail, `ℹ fail 2 / ℹ pass 6`. The install-failed test and the `no install ran` test both assert the line, so both go red.
- B, the claim's install not attached to the claimed row (`return claimed;` in place of the install-attaching return): the install-failed test fails, `ℹ fail 1 / ℹ pass 7`.
- C, the no-install default emptied (`install = "no install ran"` changed to `install = ""`): the `no install ran` test fails, `ℹ fail 1 / ℹ pass 7`.

An earlier run of mutation A used a perl pattern that did not match (`\x27` inside `\Q…\E` is read literally), so it reported `fail 0, pass 8` and was not a control. The pattern was corrected and A was rerun; the result above is from the rerun.

Closes a11ign/agent-org#1265

platform: the install outcome is read from the STARTED line the claim already writes, so the change adds no new channel or machinery.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
