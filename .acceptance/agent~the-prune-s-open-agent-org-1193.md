The ticket port gains `readOpenPullHeads` (`src/ticket-port/open-pull-heads.ts`): a repository's open pull requests (number, url, head branch, label names) read through an injected `run`, returning `{ read: true, pulls }` or `{ read: false, reason }`. A refused runner, a non-list answer and a listing that fills its limit are each `read: false`, never an empty list. `defaultGh` in `src/worktree-removal.ts` is exported; its literal `spawnSync("gh", ...)` is unchanged. Nothing calls the new reader yet (agent-org#1167 is its consumer), so there is no flag and no behaviour change.

Acceptance: `node --test src/ticket-port/open-pull-heads.test.ts`

Measured: `node --test src/ticket-port/open-pull-heads.test.ts` 4 of 4 pass. The test file cannot run before the change (the module does not exist there), so it is a fail-before, pass-after pair by construction.

Mutation, in both directions per failure path, with `open-pull-heads.ts` restored byte-identical each time (`cmp` against a copy):
- the refused-runner catch returns `read: true, pulls: []` → fails 1 test (the refused-runner test);
- the non-list check returns `read: true, pulls: []` → fails 1 test (the non-list test);
- the limit check returns `read: true, pulls: []` → fails 1 test (the full-page test);
- the whole reader replaced by `return []` → fails 4 of 4.

Other suites: `node --test src/ticket-port/ticket-port.test.ts src/ticket-port/open-pull-heads.test.ts` 23 of 23 pass (the port scanner holds the new file to naming no `gh` and spawning nothing); `node --test src/packaging/host-units.test.ts src/packaging/gh-call-ratchet.test.ts` with ticket-port 203 of 203 pass; the importers of `worktree-removal.ts` (`carry-branch`, `prune-tmp`, `prune-worktrees`, `prune-tmp-janitor`, `prune-worktrees-closed-row`, `prune-worktrees-commits-only`, `wake-reviewer-instance`) 221 of 221 pass; `pnpm run typecheck` exits 0. There is no `lint` or `verify` script in this repository, so neither was run.

Not here, and named: `prune-worktrees.ts` is not touched; the open-PR hold that calls `readOpenPullHeads` is agent-org#1167's, which will bring the `prune.holdOpenPr` flag and its tests.

Closes a11ign/agent-org#1193

platform: the reader uses `gh pr list --json` as the existing ticket-port reads do; it adds no machinery beyond a parser and a typed result.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
