Closes #5094.

## What
- `ROLE_LOGIN` in `src/work-gate.ts` has no `ceo` entry any more (it is `{}`), so `pipelineCodeownerReviewMissing` names nothing: the #1959 cause is retired. The cause name stays declared, so the cause-list pins in `project-roles.test.ts` and the trace fixtures are unchanged.
- The owned-path check (`src/owned-path-signoff.ts`) is the guard that replaces it. Its test file is unchanged and green in the same run.
- Tests: the #1959 positive-firing cases are replaced by retirement pins (no PR is named for a workflows path with no code-owner review; `decide()` orders `ceo` for no PR, with and without a drain). The FINISH/ACTION classification assertions are kept.

## Mutation
- Restoring `ceo: "a11ign-ai-leads"` in `ROLE_LOGIN` turns two named tests red: `#1959 retired: an open PR touching a pipeline path with no code-owner review is NOT named` and `#1959 retired: decide() orders ceo for NO pull request, a drain included`. The file was restored from a backup copy and `diff` confirmed it byte-identical.

## Caveats
- **Blocked: `src/work-gate-codeowner-review-repos.test.ts` is red after this change** (4 tests: #3720 repo keying and #483 review behaviour). It asserts the `ceo` login names a PR, which is now false. It is outside this row's Region (`src/work-gate.ts`, `src/packaging/work-gate.test.ts`), so it was not edited and this PR is NOT opened. Needed: a Region amendment naming that file (and its changeset `.changeset/the-codeowner-review-keys-by-repository.md`), or a ruling on how its cases should read now.
- Done-when 2 (quote of the owned-path check refusing an unsigned change) is in the PR body once the PR opens.
- The `ceo` entry of `ROLE_LOGIN` in `src/lane-ownership.ts` is NOT touched (named as out of scope in the row).
- `tsc --noEmit` cannot run in this checkout: `@types/node` is not installed (the primary checkout lacks it too). `eslint` has no config in this repo.

## Acceptance

```bash
bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate.test.ts src/packaging/owned-path-signoff.test.ts'
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
