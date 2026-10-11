Closes #816.

## What
- `ROLE_LOGIN.ceo` in `src/lane-ownership.ts` is now a list: `a11ign-ai-leads`, `a11ign-managers[bot]` (viewer/REST spelling, read by `pr:open`) and `a11ign-managers` (GraphQL `Bot` author, read by `arm-pr` and the sweep).
- `APP_ROLE_LANE_OWNER` accounts for every `github-apps` role (`GITHUB_ROLES`); a test fails if a new App role is unlisted.
- Tests: the managers login, both spellings, is refused at `pr:open`, `arm-pr` and the sweep; the workers' bot is not.

## Left alone
`src/work-gate.ts`'s own `ROLE_LOGIN` is the login CODEOWNERS names, read by `pipelineCodeownerReviewMissing`; a managers-bot PR is correctly reported there already, so it needs no bot.

## Caveats
- `managers` is one App for three roles, so the bot login cannot tell `ceo` from `product-manager` or `orchestrator`. This matches the ruling's own population; telling them apart needs three Apps.
- Done-when 2 (live reading from a leads session) is NOT done: this is a worker session. Both spellings are covered so either answer is refused.
- The rstest runner is not installed in this checkout; I ran the file with `node --test` and `AGENT_ORG_HOST` set to the fixture host: 31 pass. Mutations: managers logins dropped -> 5 #816 cases fail; owner check never firing -> 12 fail, workers' positive controls stay green.

## Acceptance

```bash
bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/pipeline-lane-authorship.test.ts'
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
