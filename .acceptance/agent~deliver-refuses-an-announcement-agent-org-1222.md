`deliver()` refuses an announcement that asks the chairman something, before any send, behind the machinery flag `messaging.refuseAskingAnnouncements` (agent-org#1222, a11ign/a11ign#5112; the flag ships OFF). The sentence that was not true and is now: **with the flag ON, `deliver()` writes an `invalid` line and reaches no provider for an announcement such as "Can you power it on?"; a release quoting `answer:ceo`, and a plain announcement, are delivered byte-for-byte as they are with the flag OFF.**

**What changes.**
- `src/messaging/core.ts`: `createMessenger` takes `refusesAskingAnnouncements` (default false) and `onMisuse`. `deliver()` checks, after the undeclared-audience refusal, an announcement whose text `asksSomething` reads, with `markersOf` on the key. The refusal writes `status: invalid`, `misuse: announcement-question`, `stateHash` and an error that names the remedy, and calls `onMisuse` with `refusalEventOf`. A held text is written once: the refusals already in the ledger are read back, so a restart does not write the line again.
- `src/messaging/audit.ts`: `markersOf` is exported, and `refusalEventOf(key, text)` builds the failure-ledger entry under `MESSAGING_AUDIENCE_MISUSE_KIND`. The predicate is not copied: `asksSomething` is the one the audit reads.
- `src/messaging/watch.ts`: reads the flag from the canary state for a real host (`canaryFlagOn`, unreadable reads OFF with a line saying so) and passes it to the core as a boolean, since the core reads no file. `onMisuse` writes the failure ledger through `recordFailures`.
- `src/machinery-flag.ts`: `REFUSE_ASKING_ANNOUNCEMENTS_FLAG` is in `FLAG_REGISTRY`.
- `src/flag-switch-ledger.ts`: the flag is in `FLAGS_WITH_ANOTHER_HOME`.
- `src/packaging/machinery-flag-switch.test.ts`: the switch test names the flag and the registry pin is now eight flags.
- `src/messaging/core.test.ts`: ten tests for the guard (see Evidence).

**Region deviation, said plainly.** The row's region lists four files. Done-when 2 requires the flag to be in `FLAG_REGISTRY` and `FLAGS_WITH_ANOTHER_HOME`, and the row cites "the same FLAG_REGISTRY line and pinned tests, via #1187", so those two files and the packaging test changed too. `watch.ts` changed because the flag has to be read somewhere and `core.ts` reads no file. Nothing outside the messaging core and its wiring changed.

**Unchanged.** With the flag OFF (the default), `deliver()` runs the same code path as before: the guard is one boolean test that is false. Nothing writes the canary state unless `machinery:flag on` is run.

**NOT shown, said plainly.** The flag is not turned on here: the switch is a host command, and nothing in this row may reach the fleet or the lab. The `watch.ts` reader (`canaryFlagOn`) is not called by any test: `main` is run only with an injected `github`, and the reader is OFF for those. Its state read is covered by the switch test's read-back through `machineryFlagOn`, which uses the same state file and the same flag name, not by a run of `main` with the flag on.

Acceptance: `grep -q "announcement" src/messaging/core.test.ts && grep -qi "asksSomething" src/messaging/core.ts && node --import=./src/lib/crash-exit.ts --test src/messaging/core.test.ts src/messaging/audit.test.ts`

Mutation, in both directions, against the guard line in `core.ts` (each run on the core test file, 49 tests):
- Guard line removed (nothing is refused): 6 red. The refusal, `?`, marker, dedupe, restart and failure-ledger tests.
- Predicate dropped (every announcement refused): 3 red. The two plain-announcement controls and the release control.
- Markers never read for any key: 1 red. The request-marker test.
- Release exemption removed (markers read for `release:` keys): 1 red. The release test, which compares the release's bytes with the flag OFF.
Each mutation was applied to `core.ts` in place, the core test file was run, and `core.ts` was restored and checked with `cmp` against the pre-mutation copy.

Evidence, measured at this head:
- `node --import=./src/lib/crash-exit.ts --test src/messaging/core.test.ts`: 49 of 49. `src/messaging/audit.test.ts`: 26 of 26. Together 75 of 75 (the row's acceptance command).
- The ten new tests: "positive control" (a plain announcement with the guard ON is sent), "Can you power it on?" refused with nothing sent, a line ending in `?` refused, a `needs:chairman` marker refused, a release quoting `answer:ceo` sent with the same bytes as the flag OFF, a plain announcement with the same bytes as the flag OFF, "Can you power it on?" sent with the flag OFF, five ticks writing one refusal line and one failure-ledger event, a restart not writing it again, and the failure-ledger event under `messaging-audience-misuse`.
- `pnpm run typecheck` exits 0.
- `node --import=./src/lib/crash-exit.ts --test src/packaging/machinery-flag-switch.test.ts src/packaging/flag-switch-ledger.test.ts src/messaging/core.test.ts src/messaging/audit.test.ts`: 97 of 97.
- `pnpm test` (rstest, the full suite): 10,992 tests, 4 fail, all in three packaging files (`host-install-agent-org-launcher`, `live-tree-independence`, `release-tag-on-merge`). The same four fail at the unmodified HEAD in a scratch detached worktree, so they predate this change. The cause of each was not investigated in this row.
- The repository has no `lint` script, so no lint was run.

Flag: messaging.refuseAskingAnnouncements
Revert: turn the flag off with `machinery:flag off messaging.refuseAskingAnnouncements --session=<you>` (it ships OFF, so today's delivery is the default), or revert this pull request
