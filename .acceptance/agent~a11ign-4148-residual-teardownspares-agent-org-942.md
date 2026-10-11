The tick reads each tracker's `in-progress` rows once, not once per live spare (a11ign/agent-org#942, parent a11ign#4148). `tearDownSpares` asked `lookupOtherHeldIssues` for every spare, so a tick with twelve spares on one tracker asked the same list twelve times.

**What changes.**
- *One read per tracker per tick.* `heldRowsReadOncePerTick()` is created once in `tearDownSpares` and holds a per-call memo keyed by tracker (`repo`, or the first tracker). Each spare's rows are taken from its own `session:` label in that one list, so every spare sees the answer the per-spare read gave it.
- *A failed read is remembered for the tick.* The failure is stored per tracker and rethrown to every spare on it, so each spare is told the cause and the tracker is not asked again. `heldRowsOfSpare` turns the throw into `null` (a read that could not ask ends nothing) and records the cause, as before.
- The `read` seam of `heldRowsOfSpare` is unchanged; the memo is passed in as it, so `endFinishedSpares` and its callers do not change.

**Assumptions (routine calls, noted for the task log).**
- The current read path is the GraphQL `repository.issues(labels:)` connection (#5039), not `gh issue list`.
- A memo scoped to one `tearDownSpares` call is one tick.
- The cause text is the same as the run wrapper's (`<repo>: <first stderr line>`).

**Measured.** From the gh-call ledger, the work tick's reads for 16:59:41Z to 17:59:09Z are 179 `work-tick.ts [api graphql]` calls (21 failed) and none `[issue list]`. This is the post-#5039 read shape, not a before/after count: the per-tick number before and after this change is not measured here, and needs the host install.

**Mutation:** two, each red in its own test, each restore byte-identical (the restored file is copied to the scratchpad and `cmp`'d): the memo removed, so every spare reads the list again (2 red); the failure memory removed, so a failed read is asked again per spare (1 red).

**Evidence.** `src/wake-teardown-keyed-rows.test.ts`: 8 of 8 (2 new). The wake, work-tick and row-claim files (51 files): 807 of 807. `tsc --noEmit`: exit 0.

**The row's own Acceptance is defective, not run here.** It greps `work-tick.ts [issue list]` in the ledger. Since #5039 the work tick's reads are `[api graphql]`, so that grep matches nothing and passes vacuously. Its done-when also needs a 30-minute window after the host install, which cannot be produced from this worktree. Routed to product-manager to amend.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/wake-teardown-keyed-rows.test.ts`

Closes: a11ign/agent-org#942

platform: n/a (no GitHub, pnpm, systemd or git feature does this; the reads are the existing GraphQL `repository.issues(labels:)` connection, one per tracker per tick)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
