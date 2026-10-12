`rows.autoUnpark` is registered as a machinery flag, so `machinery:flag on|off rows.autoUnpark` switches it and the flag ledger no longer counts it as an unset declaration flag (a11ign/agent-org#1161).

**What changes.**
- `src/machinery-flag.ts`: `FLAG_REGISTRY` gains `AUTO_UNPARK_FLAG`, imported from `src/unpark-satisfied.ts`. A name no module reads is still refused by `switchFlag`. `unpark-satisfied.ts` does not import `machinery-flag.ts` (no cycle).
- `src/flag-switch-ledger.ts`: `FLAGS_WITH_ANOTHER_HOME` gains `"rows.autoUnpark"`, with the reason the other three carry. The existing test pins that map to `FLAG_REGISTRY`, so both move together.
- `src/packaging/machinery-flag-switch.test.ts`: the registry test now switches the four flags and asserts the four-entry registry (it asserted three).
- `src/packaging/flag-switch-ledger.test.ts`: the three-direction case used `rows.autoUnpark` as its undecided example, which now has another home, so it uses `workers.haikuBrief`; the real-tree and merge-date cases no longer expect `rows.autoUnpark` as unset. A new assertion: `unsetFlags` does not report `rows.autoUnpark`.
- `src/unpark-satisfied.ts` and `src/org-health.ts` are not edited.

**Assumption, said so:** the Acceptance runs in this worktree (`/home/agent/repos/wt-agent-org-1161`), not in `~/repos/agent-org`, because the primary checkout does not carry this change.

Mutation: `AUTO_UNPARK_FLAG` dropped from `FLAG_REGISTRY`, and the `rows.autoUnpark` entry dropped from `FLAGS_WITH_ANOTHER_HOME`; each made the expected tests go red, and each restore was checked byte-identical with `diff` (copies in the scratchpad).

Evidence: `src/packaging/flag-switch-ledger.test.ts` and `src/packaging/machinery-flag-switch.test.ts` together 22 of 22 with no failures. `src/packaging/rows-unpark.test.ts` 12 of 12. The 11 other test files that name the changed modules 91 of 91. `pnpm run typecheck` (`tsc --noEmit`) exits with no error. The full `pnpm test` run reports 4 of 10753 tests failed in 627 files, all in three files this change does not touch: `live-tree-independence` (`tsx/package.json` is not in this worktree's `node_modules`), `host-install-agent-org-launcher` (an `@@eventsPort@@` placeholder is in the unit file), and `release-tag-on-merge` (`pnpm-lock.yaml` is tracked and the test asserts it is absent). These four were not run on `main` to confirm they fail there too.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1161 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import=./src/lib/crash-exit.ts --test src/packaging/flag-switch-ledger.test.ts src/packaging/machinery-flag-switch.test.ts'`

Closes: a11ign/agent-org#1161

platform: n/a (a registry and a map in this tool; no GitHub, pnpm or git feature switches a machinery flag)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
