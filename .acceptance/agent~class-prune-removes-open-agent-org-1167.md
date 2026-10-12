The worktree prune keeps a removable tree while an open PR names it, behind `prune.holdOpenPr` (shipped OFF). `src/prune-worktrees.ts` lists the open PRs once per run (`listOpenPulls`, `gh pr list --state open --limit 1000`) only when the flag is ON; a tree is held when a PR's head branch is the tree's branch, or the PR carries the tree's session label (`session:` plus its `.a11y-owner` stamp), and the held line names the PR number and URL. A listing that cannot be read (a failed `gh`, a non-list answer, or a full page of 1000) holds EVERY removable tree and says why, so an unknown is never a removal. The flag is read in `main()` (`openPrHoldOn`) from `machinery-canary.json`; an absent or unreadable state is OFF. With the flag omitted or `false`, the prune is unchanged and GitHub is not asked.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1167 && node --test src/prune-worktrees-open-pr.test.ts'`

Old-code check: the new file run against `git show HEAD:src/prune-worktrees.ts` fails 10 of 13 (every hold and listing test); the 3 OFF tests pass there, as they must, since OFF is today's prune.

Mutation: the branch match made never to fire (`if (false && onBranch)`) failed 1 test (the branch hold); an unreadable listing treated as an empty one (`if (!listing.read) return null`) failed 2 (the failed-listing and non-list tests); every tree always held failed 1 (the NEGATIVE test). `prune-worktrees.ts` restored byte-identical each time (`cmp` against a copy).

Measured: `node --test src/prune-worktrees-open-pr.test.ts` 13 of 13 pass; `node --test src/prune-tmp-janitor.test.ts src/prune-worktrees-closed-row.test.ts src/prune-worktrees-commits-only.test.ts` 58 of 58 pass; `npx tsc --noEmit -p tsconfig.json` exits 0.

Not here, and named: `prune.holdOpenPr` is NOT in `FLAG_REGISTRY` (`src/machinery-flag.ts`, outside this Region), so `machinery:flag` cannot switch it ON yet; the registration belongs to the a11ign switch row filed beside this one. `defaultPullGh` (the real `gh` spawn) is not called by any test; its behaviour is the injected `gh` the tests pass, and its literal `spawnSync("gh", ...)` is for the SPAWNS_GH guard. The hold does not read PR state other than open, and does not read PR review state.

Closes a11ign/agent-org#1167

platform: GitHub's `gh pr list` (read-only) gives the open PRs and their head branch and labels; the flag's state is the canary file the reviewer machinery already writes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
