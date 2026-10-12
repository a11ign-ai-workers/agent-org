`holds.recheck` (agent-org#1165, shipped OFF) can now be turned on, and turning it on changes the gate's order path. Before this, `perPullRequestOrders` called `sharedFileOrders(prs)` with no option and the flag was in no registry: `machinery:flag on holds.recheck` was refused ("not a flag any module reads") and the digest listed it as `flag-without-a-switch`. The sentence that was false and is now true: **setting `holds.recheck` ON with `agent-org machinery:flag on holds.recheck --session=<you>` makes the next tick release a hold whose overlap has gone and put the approved green pull request first, and the digest no longer lists it as flag-without-a-switch.**

**What changes.**
- `src/work-gate/pr-orders.ts`: `perPullRequestOrders`'s fourth parameter is a clock OR `{ nowMs, recheck }`, and it passes `recheck` to `sharedFileOrders`. A bare clock, which is every call that exists, reads `recheck` OFF.
- `src/work-gate/tick.ts`: `decide` takes `recheck?: boolean` and resolves it with `recheckFlagOn` (the caller's reading, else `machineryFlagOn(readReenqueueState(), RECHECK_FLAG)`). It is read in `decide` because the primary tick (`work-gate.ts`) and every other scope's tick (`scopeTick`) both end there, so one read covers both and neither call site can be the one that forgot.
- `src/machinery-flag.ts`: `RECHECK_FLAG` is in `FLAG_REGISTRY`. `src/flag-switch-ledger.ts`: it is in `FLAGS_WITH_ANOTHER_HOME` (outside the Region as filed, declared in the PR body), which is what takes it out of the digest's `flag-without-a-switch`.
- `src/packaging/machinery-flag-switch.test.ts` and `src/packaging/flag-switch-ledger.test.ts` name it.

**Decisions the row left to the engineer, said so.**
- **`decide` reads the state directory itself when `recheck` is omitted**, rather than a new argument built in `work-gate.ts` (not in the Region). A caller, a test or a replay that passes `recheck` is not overridden. The read drops `readReenqueueState`'s log line, which names `queue.reenqueueEjected` and which the gate's own read of the same file already says once per tick.
- **The fourth parameter is a union, not a fifth positional parameter**, for `max-params`; the bare-number form is kept because dozens of tests call it.
- **a11ign#5215's premise (a `holds.recheck` key in `.agent-org/project.json`) is wrong**, as its own correction says: the switch is the host command, which writes the canary state.

**NOT shown, said plainly.** The flag is not turned on here and no live tick was run with it on (nothing here may reach the fleet or the lab, and the switch is a host command). `decide`'s reading of the state directory is shown through a child `node` given a throwaway state directory by `A11IGN_SHADOW_STATE_DIR`, which is how the shadow runner gives `decide` one.

Acceptance: `node --import=./src/lib/crash-exit.ts --test src/work-gate/shared-file-orders-recheck-switch.test.ts`

Mutation: each break was applied to one source file, the acceptance test (and the two pinned tests where the file is theirs) run, and the file restored from a copy and compared byte-identical. `recheck` never passed to `sharedFileOrders`: 3 red (the ON release, `decide`'s pass-through, the child). Passed always ON: 4 red (the OFF case, the byte-for-byte case, `decide` off, the child's off step). `decide` passing its argument straight and never reading the flag: 1 red, the child (the only test that sees the default read; every explicit-`recheck` test stays green, which is why the child exists). `recheckFlagOn` never ON: 2 red; always ON: 2 red. The flag out of `FLAG_REGISTRY`: 5 red (the command refuses `on`, the registry pin, the ledger's map pin, and the three tests that switch it). The flag out of `FLAGS_WITH_ANOTHER_HOME`: 2 red, both in `flag-switch-ledger.test.ts`.

Evidence, measured at this head: the acceptance command passes 7 of 7. `pnpm run typecheck` exits 0. `pnpm test` reads 4 failed of 10,963 in 645 files; the four are `host-install-agent-org-launcher` (a placeholder `@@eventsPort@@` no host value fills), `live-tree-independence` twice (`Cannot find module 'tsx/package.json'`) and `release-tag-on-merge` (a `pnpm-lock.yaml` now exists), the same four agent-org#1195's evidence names at 4588b28e. They were not re-run on a clean `origin/main` here; none of them imports a file this diff changes.

Outside-Region: src/flag-switch-ledger.ts — the pinned test requires FLAGS_WITH_ANOTHER_HOME to equal FLAG_REGISTRY, and the digest's flag-without-a-switch reads that map, so the flag cannot be switchable and still counted without this one line (agent-org#1195 changed it the same way)

Flag: holds.recheck
Health-signals: approved-unqueued, blind-ticks
Revert: turn `holds.recheck` off with `machinery:flag off holds.recheck` (it ships OFF, so today's gate is the default), or revert this pull request
