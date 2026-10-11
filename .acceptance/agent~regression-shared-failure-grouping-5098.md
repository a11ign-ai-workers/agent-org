Shared-failure grouping no longer matches on the `gate` roll-up's line or on a package manager's `WARN` line, groups a non-setup failure only when it is outside both PRs' diffs, treats a closed incident row as the end of its holds (24h quiet unless a new PR joins), and expires a hold after 15 minutes without a claimed row (a11ign/a11ign#5098). `src/ci-failure-class.ts`: `readSignature`, `sharedFailureGroups`, `holdSharedFailures`, `standingOf`, `sharedFailureTick`; `src/work-gate.ts` exports `sharedFailuresNow` with an injectable `run` and clock so a test reaches it from the gate's own call.

Acceptance:

```bash
git grep -q "THE REAL LOGS" -- src/packaging/work-gate-shared-failure.test.ts
git grep -q "CLOSING THE INCIDENT RELEASES THE HOLDS AT ONCE" -- src/packaging/work-gate-shared-failure.test.ts
bash -c 'cd ~/repos/agent-org-wt-5098 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/ci-failure-class.test.ts src/packaging/work-gate-shared-failure.test.ts'
```

Closes a11ign/a11ign#5098

Measured: the command above printed `VERDICT pass: 32 tests in 2 files` at this head; the new packaging test fails 7 of its 8 tests against `origin/main`'s `src/ci-failure-class.ts` (the eighth, SETUP, is the positive control that setup grouping still works). The fixtures are the real `checks` and `gate` job logs of control#53 (run 38142093391) and control#58 (run 38145327395), trimmed to the lines that decide the signature. Root cause beyond the row: the `checks` job's first error-looking line was `WARN Failed to create bin at ...`, identical on every PR, so the roll-up was not the only false match.

Mutation: each run against this head and reverted byte-identical, and each breaks its own test and no other: (1) the roll-up read by name / by step / by line -- the roll-up unit test, once each; (2) a `WARN` line may be the failure -- the failure-line unit test; (3) a changed file never touches the failure -- OUTSIDE THE DIFF; (4) it always does -- OUTSIDE THE DIFF; (5) no file required -- OUTSIDE THE DIFF and A WARNING IS NOT THE FAILURE; (6) a closed row is ignored -- CLOSING THE INCIDENT; (7) a hold never expires -- A HOLD EXPIRES; (8) a hold always expires -- A HOLD EXPIRES and the 5008 POSITIVE CONTROL; (9) an unfiled row still holds -- A HOLD WITH NO ROW BEHIND IT; (10) a claim is ignored -- A HOLD EXPIRES.

Outside-Region: docs/gh-call-inventory.json — (generated, `node src/packaging/gh-call-inventory.ts`; `gh-call-baseline.json` is unchanged and `gh-call-ratchet.test.ts` passes). `.changeset/` is exempt.

Not done: (a) done-when 2, the 24h live reading, waits for 24 hours of the gate running this; (b) change item 5, the daily retro's detector for held-then-released wakes and incidents closed as "not the same failure", is in `src/org-retro.ts`, outside this Region, and is filed as its own row. The test fixtures set the check named `checks`, not `gate`, in `ci-failure-class.test.ts`: `gate` is now a roll-up by name and cannot carry a failure. Two tests fail on `origin/main` as well, measured by running them against its `ci-failure-class.ts` and `work-gate.ts`: `work-gate-other-scopes-concurrent.test.ts` (14 !== 16) and `worker-stop-hook.test.ts`.

platform: GitHub's own labels (`in-progress` is the claim), `createdAt` and `closedAt` on the incident row, and `GET /pulls/{n}/files`; no state kept beside them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
