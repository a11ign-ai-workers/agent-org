`prune.holdOpenPr` (agent-org#1167, shipped OFF) can now be turned on. Before this, `openPrHoldOn` read the flag from the canary state but the flag was in no registry: `agent-org machinery:flag on prune.holdOpenPr` was refused ("not a flag any module reads") and the digest listed it as `flag-without-a-switch`. The sentence that was false and is now true: **`agent-org machinery:flag on prune.holdOpenPr --session=<you>` is accepted, and the digest no longer lists it as flag-without-a-switch.**

**What changes.**
- `src/machinery-flag.ts`: `OPEN_PR_HOLD_FLAG` (imported from `src/prune-worktrees.ts`, where it is declared) is in `FLAG_REGISTRY`.
- `src/flag-switch-ledger.ts`: `prune.holdOpenPr` is in `FLAGS_WITH_ANOTHER_HOME`, which is what takes it out of the digest's `flag-without-a-switch`.
- `src/packaging/machinery-flag-switch.test.ts` and `src/packaging/flag-switch-ledger.test.ts` name it (the registry pin, the map pin, the discovery list and the three-directions list).

**Unchanged.** Nothing writes the canary state unless the command is run, so the flag stays OFF and `prune-worktrees` reads it exactly as before. No line of `src/prune-worktrees.ts` changed.

**NOT shown, said plainly.** The flag is not turned on here: the switch is a host command and nothing in this row may reach the fleet or the lab. The switch is shown through the test suite, which runs `machinery:flag on` in a throwaway state directory and reads the result back with `machineryFlagOn`.

Acceptance: `node --import=./src/lib/crash-exit.ts --test src/packaging/flag-switch-ledger.test.ts src/packaging/machinery-flag-switch.test.ts`

Mutation: before the change the two tests fail on the original sources (`flag-switch-ledger.test.ts` "(2) the three directions" and `machinery-flag-switch.test.ts` "(1) the other five registered flags", 2 red of 22). With the flag removed from `FLAG_REGISTRY`: 2 red (the switch test and the registry-vs-map pin). With its entry removed from `FLAGS_WITH_ANOTHER_HOME`: 2 red (the map pin and the three-directions test). Each break was restored from a copy and compared byte-identical; the restored tree passes 22 of 22.

Evidence, measured at this head: the acceptance command passes 22 of 22. `pnpm run typecheck` exits 0. `src/prune-worktrees-open-pr.test.ts` (the reader's off and on cases) passes 36 of 36 with the two files above.

Flag: prune.holdOpenPr
Revert: turn `prune.holdOpenPr` off with `machinery:flag off prune.holdOpenPr` (it ships OFF, so today's prune is the default), or revert this pull request
