A DRAFT pull request refused at its current head wakes its holder: `reviewBlocked` admits the one draft that `mergeCandidates` drops for being a draft, a refusal (CHANGES_REQUESTED) posted at the head it has (agent-org#958, split from a11ign/a11ign#5036 part 4). `src/work-gate/pr-state.ts` gains `draftCandidates`, which is `greenUnheldPrs` with the draft exclusion lifted and nothing else changed; the hold rule, the red-checks rule and the conflict rule all still apply. `src/work-gate/causes/pr-reviews.ts` `reviewBlocked` appends the draft refused at its head. The order then goes out through the existing `reviewBlockedOrders`: to the `session:` label holder when there is one, to the manager's set order when there is not. A draft with no verdict stays `draft-awaiting-verdict`'s. A draft refused at an older head stays outside the cause, as before.

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate-review-blocked-draft.test.ts
```

The row's own command cds to `~/repos/agent-org`, which is the primary checkout and does not carry this change. The command above runs from the root of the PR's checkout instead. It is the same test file.

Measured at this head: `VERDICT pass: 4 tests in 1 file` for `src/work-gate-review-blocked-draft.test.ts`. Before the change, 3 of the 4 failed; the positive control (the same draft with no refusal) passed in both runs. Related files: `VERDICT pass: 14 tests in 2 files` for `work-gate-review-blocked`; `packaging/work-gate` 526/10, `packaging/org-health` 81/4, `packaging/git-spawn-classification` 10/1, `packaging/work-gate-size` 4/1.

Mutation: the refusal filter in `reviewBlocked` replaced by `false` (so no draft is ever admitted). `VERDICT fail: 3 of 4 tests failed in 1 file`; the positive control still passes. The file was restored byte-identical afterwards.

Outside-Region: `src/work-gate/pr-state.ts` (`draftCandidates` and the opt-in `drafts` flag on `greenUnheldPrs`). The population change has to live beside the draft exclusion it lifts; copying the filter into `pr-reviews.ts` was the alternative, and the file's own comments warn against copies.

Not done: `pnpm run verify`, `pnpm run lint` and `pnpm run test:org` are not defined in this package, so they were not run. The full agent-org suite was not run to completion: several of its test files read `AGENT_ORG_HOST` and queued real handoffs to live sessions, so that run was stopped. Only the files listed above were run.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
