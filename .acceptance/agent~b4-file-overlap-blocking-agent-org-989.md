B4 file-overlap blocking at the claim (`src/row-claim.ts`) yields to a `priority:emergency` row that the gate honours, the same way it yields to a `priority:chairman` row (#4793). The yield uses the gate's own verdict: `lookupEmergencyRows` reads the open labelled rows and keeps only the ones `readEmergencyPriority` (in `work-gate.ts`) honours, so a label the gate ignores gives no yield. An honoured emergency row joins the chairman rows in one priority set, so two priority rows still exclude each other. The claim leaves a note naming the incident and the holder it walked past; the `check` path reports the same yield. With `emergencyPriority.enabled` unset, nothing is read about the label and the verdict is unchanged.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-989 && npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim-emergency-yield.test.ts src/row-claim-chairman-yield.test.ts'`

Mutation: four mutations, each restored byte-identical against a copy (`cmp`) after its run. The option guard in `lookupEmergencyRows` removed (`if (!option.enabled) return new Map();` made `if (false)`) failed 2 of 30. Emergency rows left out of the priority set failed 2 of 30. The incident not named in the verdict failed 2 of 30. The claim note written without the emergency argument failed 1 of 30.

Measured: `VERDICT pass: 30 tests in 2 files` for the acceptance files; `src/packaging/gh-call-ratchet.test.ts` passes 8 of 8 (`src/row-claim.ts` spawn sites held at the baseline); `npx tsc --noEmit` exits 0.

Not here, and named: the acceptance command as the row writes it runs from `~/repos/agent-org`, which lacks the new test file, so it passes only the chairman file (15 tests). The record uses the worktree path, where both files run. Five tests in the full `pnpm test` suite fail at HEAD as well (live-tree-independence ×2, release-tag-on-merge, work-gate-other-scopes-concurrent, worker-stop-hook), and this change does not touch them.

Closes a11ign/agent-org#989

platform: the emergency verdict is read through the gate's own `readEmergencyPriority`, with the history read from `repos/{tracker}/issues/N/events`; the claim-path priority reads go through the injected `run` in tests, so no test reaches the network.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
