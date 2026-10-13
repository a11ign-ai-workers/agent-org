A dispatch that published clears `release-run-failed`. `releaseJobPublished` (`src/org-health.ts`) looked for a job named exactly `release`, but a publishing run's jobs are named `release / <job>` (run 38332090768: `release / ci gate result on this sha`, `release / version`, `release / publish`, `release / tag`), so no job matched, every dispatch read as promote-only, and a release that shipped kept the 01:07:38Z failure as the newest verdict. The check now matches `release / publish` with `success`, read from the job list as `{name, conclusion}` and matched in code, so the test exercises the name rather than a pre-filtered list. The promote-only case (`release / publish` skipped) stays no verdict.

Acceptance: `node --test src/org-health-release-failed.test.ts`, run from the worktree.

Fail before, pass after: with the new cases in place and the old check, `src/org-health-release-failed.test.ts` gives 15 of 17 (two fail: the promote-only case reads `clear`, and the job named just `release` reads `clear`). After the change it gives 17 of 17. The published case passes on the old code too, because the old fake did not run the jq filter; the two failing cases above are the ones that show the old name was wrong.

Mutation, with `src/org-health.ts` restored byte-identical each time (`cp` to a scratch copy, `diff` after):
- the match changed to the old name `release` never matches the publish job: 2 tests fail (the published case and the job named `release` case).
- the match made always true (`Array.isArray(jobs) && true || ...`): 2 tests fail (the promote-only case and the job named `release` case).

Measured: `node --test src/org-health-release-failed.test.ts` gives `ℹ tests 17 / pass 17 / fail 0`. `pnpm run typecheck` exits 0. This repository has no `lint` script, so none was run. A wider run over the files that import `src/org-health.ts` and the trace and board files (about 11,000 tests) had 16 failures; the 34 files I re-ran on a HEAD copy of the two changed files fail with the same names there, so those failures predate this change. I did not re-run every file of the wider run, so a whole-suite comparison is not claimed.

Live reading (done-when 2), read-only on this branch's code over `a11ign/a11ign` `release.yml` runs on `main`: the newest verdict is run 38332090768 (`workflow_dispatch`, `success`, `published: true`, 2026-10-13T01:25:50Z), and `releaseFailedReading` reads `clear`. The job read for that run returned `release / publish` as `success`.

Closes a11ign/agent-org#1298

platform: GitHub's job list is the source of the called workflow's job names; the match reads the names it returns, with no new machinery.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
