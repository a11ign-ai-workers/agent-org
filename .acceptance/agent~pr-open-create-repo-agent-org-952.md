## What it is

`pr:open create --repo <owner/repo>` with no `--head` opened the pull request, then failed its own arming step: the arm (`gh pr merge --auto --merge --repo R`) and the session label (`gh pr edit --repo R --add-label session:*`) named no pull request, and gh refuses `--repo` with no selector (`argument required when using the --repo flag`). The PR was left unarmed and without its `session:` label.

## Change

With `--repo` and no `--head`, the arm and the label name the tree's own branch, which is the branch `gh pr create` opened the PR from. `--head` still wins. A create without `--repo` is armed and labelled exactly as before (gh reads the checkout's branch itself). When `--repo` is given and no branch is known, nothing is sent rather than the refused form. The branch is read once per create, through the same injected `git` as the other facts.

Tests pin the arm and the label naming the branch with `--repo`, `--head` still winning, the no-`--repo` argv unchanged, `--draft` arming nothing, the null branch sending nothing, the whole `sendToGitHub` path reaching `run` with the branch named, and the branch being read once per create (the arm and the label name that one read).

Closes a11ign/agent-org#952

Flag: none -- a fix to the argv of the arm and the label, which gh refused on every `--repo` create without `--head`; the argv of every create gh accepted is unchanged.
Health-signals: claims-refused, wakes-held
Revert: revert this PR; the arm and the label go back to naming no pull request with `--repo`, the refused form this fixes.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-952 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts'`

Mutation: removing the branch selector (`return branch === null ? null : [branch]` -> `return []`) turns 4 of the 25 tests red, all of them #952 tests (the arm, the label, the end-to-end path, and the null-branch case), and restoring it turns them green. Making the selector fire without `--repo` (deleting `if (repoFlagOf(rest).length === 0) return [];`) turns the no-`--repo` negative control red. Reading the branch a second time at the label step turns the READ ONCE test red (1 of 26). All restored byte-identical.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
