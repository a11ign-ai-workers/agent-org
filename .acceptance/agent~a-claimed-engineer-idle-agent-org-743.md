An idle claimed engineer whose own pull request has a red check is nudged within 10 minutes with a prompt naming the failing checks, whatever it declared with `worker:state`; `waiting-ci` and `waiting-review` excuse it only while the checks are not red. A holder with a pull request open is counted per stall: the third unanswered nudge releases the claim (the pull request left as it is) and the second does not; a commit, a push, a new pull request or a new claim after the nudge resets the count; a comment does not. A holder with no pull request is read exactly as before.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL: an idle holder on a RED pull request that declared" -- src/packaging/idle-claimant.test.ts
git grep -q "the THIRD unanswered nudge releases a holder with a pull request open, and the second does not" -- src/packaging/idle-claimant.test.ts
bash -c 'cd ~/repos/wt-agent-org-743 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.t[s] src/packaging/idle-claimant.test.ts src/work-gate-claim-stalled.test.ts src/work-gate-red-pr-waiting.test.ts'
```

Mutation: `redOwnPrs` made to return nothing fails the red-nudge controls and the tick sequence; made to return the first pull request as red fails nine tests (every green control); `MAX_UNANSWERED_NUDGES` set to 2 or to 4 fails the second-does-not and the third-releases cases and the tick sequence; counting a row comment as progress fails the comment control; ignoring a commit and a push as progress fails the reset case and the tick sequence; dropping `waiting-ci`/`waiting-review` from the voided declarations, the 10-minute clock, the young-pull-request grace, the inferred-kind filter, the written count, the carried `unanswered`, and applying the count to a holder with no pull request each fail their own control. Each was run by hand and the file restored byte-identically (`diff` empty).
