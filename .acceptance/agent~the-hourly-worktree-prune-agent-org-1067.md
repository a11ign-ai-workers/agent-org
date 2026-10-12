The hourly worktree prune covers the agent-org checkout as well as the project's. The unit ran from the tool's directory with the project's path as its argument, so the tool's own worktrees were never pruned and piled up toward the cap of 100 that refuses claims. The unit now has two passes: the first runs `src/prune-worktrees.ts --apply` with no path, so `pruneWorktrees` takes its cwd, which the tool form sets to the declared `tool`; the second is the project's pass, unchanged, which the tool form rewrites to the declared project checkout. The first pass is wrapped in `timeout --kill-after=30 600` and carries the `-` prefix, so a hang or failure there does not stop the project's pass. `TimeoutStartSec` is raised from 900 to 1500 to cover both bounds. No `--force` is passed in either pass, and the per-run limit and every refusal are unchanged.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1067 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/host-units.test.ts src/packaging/prune-worktrees.test.ts'`

Mutation: deleting the project pass from the template (the second target gone, so the unit covers only the tool's checkout) fails the `#1067` tests in `src/packaging/host-units.test.ts`. The `--force` case (`#1067: --force is in neither pass, in either form`) is written and passes on the current template; I did not run a mutation that adds `--force` to either pass, so that case's failing direction is unmeasured.

Measured: `VERDICT pass: 249 tests in 2 files` for the acceptance command. `src/no-loader.test.ts` and `src/packaging/host-project-paths.test.ts` pass (`VERDICT pass: 18 tests in 2 files`); `pnpm run typecheck` exits 0. The full suite, run before the last two test-pin edits, showed 17 failures in 599 files. One of them was this row's own: the `host-project-paths.test.ts` pin for the unit, which is now updated to the new hash. Another was `no-loader.test.ts`, which pins the set of units that run `node` and now includes `worktree-prune`. The other 15 are in files this row does not touch (`org-health*`, `wait-condition`, `release-behind-main`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`, `release-tag-on-merge`, `live-tree-independence`). Some fail on live host data (`claim-refusal-storm` tripped) and some on a missing `tsx` module. I did not run those on `main` to confirm they fail there too.

First run after install, on a checkout already under the cap: it does NOT do nothing. The cap is not this unit's gate. Each pass removes whatever is removable (clean, merged, inactive, no `runs/` record it cannot verify, not claimed), up to `MAX_REMOVALS_PER_RUN` (25) per pass. Every refusal still applies, so anything dirty, unmerged, cherry-picked, inconclusive, active, or claimed is left standing.

Known issues:
- A plain host (no `tool` in the declaration) runs `node src/prune-worktrees.ts` in the project checkout, where the file is absent. The `-` makes that a logged failure, and the pnpm line after it still runs.
- `timeout` signals only the node process. A `git` child it started is left to systemd, which stops the unit's cgroup when the start phase ends.
- A firing can remove up to twice `MAX_REMOVALS_PER_RUN` (one pass per checkout).
- Not verified on a real systemd: the interaction of `timeout`, the `-` prefix and `TimeoutStartSec` was checked by reading the template and the test assertions, not by running the unit.
- The live unit changes only after `host:install` runs. That is a host action outside this row.

Closes agent-org#1067

platform: the pass structure and bounds are asserted by `host-units.test.ts` against the rendered unit; systemd's handling of them is not exercised here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
