The comment a stalled release leaves names the unanswered nudges and says the pull request is left open (agent-org#743 follow-up, row 1152).

Acceptance: AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-claim-stalled.test.ts

Mutation: guard `request.why === "stalled" && request.nudges !== undefined` replaced by `false` (1 red: the new test) and by `request.why === "stalled"` (2 red: the new test and the existing stalled-release comment test); each restored byte-identical.

Closes a11ign/agent-org#1152
