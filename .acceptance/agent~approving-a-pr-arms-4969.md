The agent-org half of a11ign/a11ign#4969 (the a11ign half is a11ign/a11ign#4981): `auto-arm.yml` reacts to an approving review, marks an approved draft ready and arms it, with no worker turn.

**Design.** `pull_request_review` runs the BRANCH's copy of the file (the shape a11ign/a11ign#4191 measured and #4287 closed), so a minting job on it would be refused, or would let a branch mint. The review therefore runs one job, `relay` (`actions: write`, no `id-token`, no mint), that dispatches `main`'s copy with the PR number. `arm-approved` is the `workflow_dispatch` half, running as `refs/heads/main`; it re-reads the PR as the minted token and acts only on `reviewDecision == APPROVED`, an open PR against `main` with a head in this repository and no `hold:` label. A held, forked, closed or `CHANGES_REQUESTED` PR is untouched and not marked ready. `pull_request_review` has no `branches:` filter (actionlint says so), so `relay` reads the base itself. **The policy gains `workflow_dispatch` in `event_name`** (`.github/chainguard/auto-arm.sts.yaml`, `subject_pattern` already admits `ref:refs/heads/main`); it is read from the default branch, so it takes effect when this merges.

**Measured** at this head: actionlint (npm `actionlint` wasm build) 0 findings on the workflow after the `branches:` filter it first flagged was removed; `auto-arm-octo-sts.test.ts` and `auto-arm-workflow-honours-hold.test.ts` 13 tests in 2 files pass under `rstest`. The `arm-approved` script is the same text as a11ign/a11ign#4981's, whose eight outcomes were run with recording `gh`/`agent-org` fixtures.

**Not measured.** The live readings (Done-when 1 and 2) can only be made after this merges, since `workflow_dispatch` and `pull_request_target` run `main`'s copy.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/auto-arm-octo-sts.test.ts src/packaging/auto-arm-workflow-honours-hold.test.ts`

Mutation: four, each red in exactly one of the six tests of `auto-arm-octo-sts.test.ts` and each restore byte-identical (`diff` clean, 6 of 6 after): the policy without `workflow_dispatch`; `relay` holding `id-token: write`; `relay` on any review state; `arm-approved` without its `github.ref == 'refs/heads/main'` guard.

Closes: none -- a11ign/a11ign#4981 carries the Closes for a11ign/a11ign#4969; this is its agent-org half, and the live readings stay a new row.

Outside-Region: .github/chainguard/auto-arm.sts.yaml — the row names it for a changed claim, and the new dispatch event is one (`event_name`).
Outside-Region: src/packaging/auto-arm-octo-sts.test.ts — pins the policy's claims and the jobs' triggers (a11ign/a11ign#4199); it must name `relay` and `arm-approved`.
