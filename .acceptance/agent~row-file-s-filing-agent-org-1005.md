row-file's filing preflight reads the open pull requests and open rows over REST instead of GraphQL: `src/sweep-window.ts` (`prOpenTimes`, the declared code repos' open pull requests), `src/blast-radius.ts` (`ghBlastReads.openRows`, the tracker's open rows) and `src/duplicate-row.ts` (`openRows`, the candidate rows for the duplicate check) now read `gh api repos/<repo>/pulls?state=open` and `gh api repos/<repo>/issues?state=open`, paged at 100 per page, through one shared helper `openRestListing` in `src/blast-radius.ts`. The helper drops pull requests out of the issues listing, and a listing still open after 100 pages throws, so each caller reads it as unknown. The caller field names are unchanged (`created_at`, `number`, `title`, `body`). The three sites' `gh pr list` / `gh issue list` GraphQL reads are gone from these files; the other `pr list` and `issue list` callers (`src/row-claim/file-overlap-rule.ts`, `src/row-file.ts`) are outside this Region and are not changed here.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1005 && npx rstest run --config scripts/rstest/rstest.config.ts src/sweep-window.test.ts src/blast-radius.test.ts src/duplicate-row.test.ts'`

Printed: `VERDICT pass: 55 tests in 3 files -- full report: A11Y_RSTEST_FULL_REPORT=1`, exit 0. Before the source change the three pin tests were red (`red.log`: 14 of 55 failed, including the three new pins, F01 sweep-window, F03 sweep-window `check`, F14 duplicate-row).

Mutation: each site turned back to its old GraphQL argv, one at a time, the three acceptance files run, the file restored from a byte copy in the scratchpad and checked with `cmp` (identical each time).
- `prOpenTimes` back to `gh pr list --json number,createdAt,body`: 5 of 55 failed. The pin is F05 (`gh api repos/<code>/pulls`, never `pr list`). F01 to F04 also fail, because the old argv returns `createdAt` and the fixture carries `created_at`, so the pull request's open time is lost and the box does not start. That is fixture shape, not a second pin.
- `ghBlastReads.openRows` back to `gh issue list --limit 500`: 1 of 55 failed, F01 only (the pin, the `pull_request` filter included).
- `openRows` in duplicate-row back to `gh issue list --limit 1000`: 8 of 55 failed. The pin is F02 (`gh api repos/<repo>/issues`, never `issue list`). F01 and F03 to F08 fail because the duplicate-row stub answers only the REST `/issues?` route, so the old argv gets no candidate list.

Measured, not changed by this row: `pnpm run typecheck` exit 0. The repo has no lint script. Full `pnpm run test`: 11 of 10235 tests failed in 6 files (`src/packaging/live-tree-independence.test.ts`, `src/packaging/org-health-queued-lab-jobs.test.ts`, `src/packaging/release-tag-on-merge.test.ts`, `src/packaging/wait-condition.test.ts`, `src/work-gate-other-scopes-concurrent.test.ts`, `src/worker-stop-hook.test.ts`). These files do not import the three changed modules and do not stub the old argv. Most of the failures are `AGENT_ORG_HOST` unset (the tool refuses to guess the host). Against this worktree as host the remaining failures are host- and checkout-dependent (`live-tree-independence` reads the home checkout; `release-tag-on-merge` reads the root lockfile and packageManager). These were not re-run against the base commit.

Net: six files changed, 70 insertions and 24 deletions (`git diff --stat`). Removed `jsonArray`, `OPEN_ROWS_LIMIT` and `OPEN_ROW_READ_LIMIT`; added the one shared helper.

Closes a11ign/agent-org#1005

platform: `gh api` REST (`repos/{repo}/pulls`, `repos/{repo}/issues`, core pool) in place of `gh pr list` / `gh issue list` (GraphQL, managers App pool); checked.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
