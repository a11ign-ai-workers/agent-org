Closes a11ign/a11ign#5094

## What
- `ROLE_LOGIN` in `src/work-gate.ts` has no `ceo` entry any more (it is `{}`), so `pipelineCodeownerReviewMissing` names nothing: the #1959 cause is retired (a11ign#5044 step 2). The cause name stays declared, so the cause-list pins in `project-roles.test.ts` and the trace fixtures are unchanged.
- The owned-path check (`src/owned-path-signoff.ts`) is the guard that replaces it. Its test file is unchanged and green in the same run.
- Tests:
  - `src/packaging/work-gate.test.ts`: the #1959 positive-firing cases are replaced by "#1959 retired" pins (no PR is named for a workflows path with no code-owner review; `decide()` orders `ceo` for no PR, with and without a drain). The FINISH/ACTION classification assertions are kept.
  - `src/work-gate-codeowner-review-repos.test.ts` (#3720 keying, agent-org#483 review states) and `src/work-gate-codeowner-app-review.test.ts` (a11ign#796 managers-App review): every case keeps its fixture and asserts nothing is named. Each header points at the "#1959 retired" control.
- Changeset: `.changeset/the-codeowner-review-keys-by-repository.md`.

## Mutation
- Restoring `ceo: "a11ign-ai-leads"` in `ROLE_LOGIN` turns fourteen of 442 tests red, in four files: two in `work-gate.test.ts`, five in `work-gate-codeowner-app-review.test.ts` and seven in `work-gate-codeowner-review-repos.test.ts` (re-measured at `3299ca99`). Two cases stay green under the mutation and so do not pin the retirement: `#796 (a)` in the app-review file, and the owner-authored case in the review-repos file. The file was restored from a backup copy and `diff` confirmed it byte-identical.

## Done-when 2: the owned-path check refuses an unsigned change
The check in `src/owned-path-signoff.ts` refuses a change to an owned path whose body does not state each owned-path fact. The refusal names the fact and the states that satisfy it. `src/packaging/owned-path-signoff.test.ts` ("a change to an owned path with NO sign-off is refused, and it names each missing fact") runs `packages/nvda-worker/src/capture-core.ts` with the body "Fixes a typo." and asserts exit `1`, the fact `CAPTURE_PROTOCOL_VERSION` and the phrase "say one of: unchanged, bumped".

## Caveats
- The `ceo` entry of `ROLE_LOGIN` in `src/lane-ownership.ts` is NOT touched (named as out of scope in the row).
- Dead code left for a follow-up: the `CODEOWNER_REVIEW_APPROVED_ONLY` switch and the `ownerHasReviewed` path are no longer reachable from the pipeline check.

## Acceptance

```bash
bash -c 'npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/owned-path-signoff.test.ts src/work-gate-codeowner-review-repos.test.ts src/work-gate-codeowner-app-review.test.ts'
```

The `#1959 retired` pins in `src/packaging/work-gate.test.ts` are NOT in this command: that file needs `history` (through `host-units.ts`), which the acceptance job does not have. They run in a full checkout, where the mutation above was measured.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
