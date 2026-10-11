Workers route to Haiku by default on a Tests-first row and move to a fresh Sonnet session on evidence, behind `routing.haikuDefault` (a11ign/a11ign#5110). Choice mode only: `traits` mode has no single pick to veto.

**What changes.**
- `engineer-route.ts`: with the flag on and a Tests-first row (Region names a test file; `whyHeld` still refuses `lane:ceo`, `needs:chairman`, workflows, no command Acceptance), the route is Haiku unless the provider picks a configured Sonnet route at P >= 0.7 (`SONNET_VETO_MIN_P`). No usable pick, a failed provider and an off-list answer are each Haiku. Haiku's own switch and refusals still hold it (`takeVerdict`).
- `wake.ts`: with the flag on, `escalationsNow` moves a Haiku start at the third distinct failing head (`HAIKU_DEFAULT_CI_FAILURES`, was 2) and on a transcript `stop_reason: refusal` (`instanceRefused`). The move is the existing #4630 restart: a fresh Sonnet process in the same worktree, brief naming the reason, once per row.
- **Assumptions, said so:** "Tests-first" is read from the Region (a test file named), because the companion row has not landed. The "underspecified" declaration is NOT wired: it needs `worker:state`, outside this Region, and goes to a new row.

Mutation: veto bar moved to 0.5 (1 red) and to 0.9 (1 red); flag ignored (11 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `src/engineer-route.test.ts` 77 of 77 with `src/engineer-escalation.test.ts` 114 of 114 together. Measured at this head; `tsc` reports no error in the two files touched (the worktree lacks `yaml` and `@rstest/core` types, so its other errors are the environment's).

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/engineer-route.test.ts'`

Closes a11ign/a11ign#5110. What remains is filed as its own rows: the 24h reading (Done-when 2, live after the flag is on) and the worker declaring a row underspecified (needs `worker:state`, outside this Region).

Outside-Region: .changeset/workers-route-to-haiku-by-default.md — the entry a project that pins a tag reads.

platform: n/a (a switch in the existing decisions.json; no platform feature does routing)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
