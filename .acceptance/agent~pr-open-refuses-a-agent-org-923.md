`pr-open create` refuses a `Closes` of a row whose Region spans two or more repositories while another repository's pull request, still open, also names that row. The refusal names that pull request and the first-half declaration that is the right one for this half (a `none` line whose reason names that row). A row whose Region is one repository, a row with no other open pull request, and a pull request in the row's own repository that names it all pass as before. An open-pull list that cannot be read refuses by name, so a failed `gh` is never read as "nothing is open" (#1286).

The check reads the Region's repositories from `readRegions` (each entry's `key:` prefix, or the stated repository, through `repositoryOfEntry`), and lists each other repository's open pull requests through `openPullsOf` in `src/ticket-port/open-pulls.ts`, with `gh` handed in by `pr-open.ts`. It is wired only on `create`; an `edit` that adds a `Closes` is not checked (a gap, named in the PR).

Acceptance: `bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts'`. That runs the primary checkout, not this worktree, so the worktree run is the one that exercises the change: `bash -c 'cd /home/agent/repos/wt-agent-org-923 && npx rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts'`.

Mutation: the other-repository check removed (`const otherHalf = null;`) turned four tests red (the POSITIVE CONTROL, the Refs POSITIVE CONTROL, the NEGATIVE CONTROL for an unreadable list, and the `create` POSITIVE CONTROL), `VERDICT fail: 4 of 16 tests failed`. `src/pr-open.ts` restored from a copy in the session scratchpad, `diff` identical.

Measured: `VERDICT pass: 16 tests` for `src/pr-open.test.ts` in the worktree. All 33 test files that reference `pr-open` pass together: `VERDICT pass: 1390 tests in 33 files`. `npx tsc --noEmit -p tsconfig.json` exits 0. The gh-call ratchet (`src/packaging/gh-call-ratchet.test.ts`) passes with `src/pr-open.ts` at its baseline (7 spawns, 11 calls); the baseline is not raised. `docs/gh-call-inventory.json` is regenerated (`node src/packaging/gh-call-inventory.ts`): the one new file is `src/ticket-port/open-pulls.ts`, with one `pr list` shape and no spawn, and the inventory's spawn count stays 137.

Not here, and named: `tsx` is not installed in this worktree, so `node --import tsx ...` (the command the inventory test names) cannot run; `node src/packaging/gh-call-inventory.ts` runs it instead. `src/packaging/live-tree-independence.test.ts` cannot load `tsx/package.json`; `src/packaging/release-tag-on-merge.test.ts` reads a `pnpm-lock.yaml` that main has; `src/work-gate-other-scopes-concurrent.test.ts` fails "14 !== 16" and imports none of the changed modules. None of those three were run against main here. The `Refs` line counts as naming a row (the reading `merged-row-open-incident.ts`'s `deliverableKeys` does not take); it is a choice, and the PR says so.

Closes a11ign/agent-org#923

platform: the open-pull read is a `gh pr list`; a fourth port operation, if the ceo rules one, would take it through `CodeHostPort` instead.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
