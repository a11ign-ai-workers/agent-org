An approved pull request held at `REVIEW_REQUIRED` for more than 10 minutes is a named health finding, behind `health.approvedRequired`, which ships OFF (agent-org#1248, a11ign/a11ign#928).

**The incident:** a11ign#5303, #5302, agent-org#1241 and control#75 sat approved and `REVIEW_REQUIRED` for about 90 minutes after the reviewer switchover, because the approving App's approval did not count toward `main`'s merge rule. `org-health` had no reading for an approval that does not count, so nothing named them.

**What changes.**
- `src/org-health.ts`: `approvedRequiredReading`, the reading beside the approved-DIRTY readings. It trips on an open pull request with an APPROVED review on its current head and `reviewDecision` `REVIEW_REQUIRED`, once a tick has stamped it for more than `APPROVED_REQUIRED_MINUTES` (10). The finding names the PR, its age and the approving identity, and says the approval does not count (usually a permission or a rule excluding it), not a failing check.
- A stamp taken on an older head is not that head's age, so a new head clears the finding; a closed or merged PR, and `reviewDecision` leaving `REVIEW_REQUIRED`, clear it too. A PR no tick has stamped is unknown, never a finding; a refused read is unknown.
- `approvedRequiredReadings` gives nothing while the flag is off. `orgHealthReadings` takes it as `approvedRequired`, silent when the caller does not ask. The live gate does not pass it yet, so nothing changes until a later row wires it.
- The REMEDY text for the class says what to read and what not to do (approve again).

**Assumptions, said so:** the class is not in `SIGNALS` or the suppression table in `work-gate/org-health-suppression.ts` (outside this Region), the same as the approved-DIRTY classes: an order of it falls to that table's default until its row registers it, which is why the flag ships OFF. The 10-minute figure is the row's.

Mutation: three, each red and each restore byte-identical (copy in the scratchpad, `cmp`): the window dropped so any age trips (3 red), every held PR trips (8 red), the flag ignored (2 red); a stamp from an older head counted (1 red).

Evidence: `src/org-health-approved-required.test.ts` 16 of 16. `src/org-health*.test.ts` with `work-gate-org-health-port`, `work-tick-health` and `class-repeat` 149 of 149 together. `rstest run ... org-health` 206 of 206 in 16 files. `pnpm run typecheck` exits 0. The test file cannot load on the old code (the new exports are a link error), so it fails before the change.

Acceptance: `node --test src/org-health-approved-required.test.ts`

Closes a11ign/agent-org#1248.

Outside-Region: .changeset/an-approved-pr-held-at-review-required-is-a-finding.md — the entry a project that pins a tag reads.

platform: checked `gh pr view --json reviewDecision`: GitHub reports the decision, not how long it has stood, so the age is the gate's own stamp, as the approved-DIRTY reading does.

Path note: the row's Acceptance was `cd ~/repos/agent-org && node --test src/org-health-approved-required.test.ts`. That `cd` names the primary checkout, which is detached at effdfdf7 and cannot contain this file until this PR merges, so the row's command could not pass from any worktree before merge. The `~` also stops the tool's leading-`cd` rewrite (`rewriteLeadingCd` matches a literal path only). The `cd` is dropped; the test command is unchanged and runs in the checkout it is started in.
