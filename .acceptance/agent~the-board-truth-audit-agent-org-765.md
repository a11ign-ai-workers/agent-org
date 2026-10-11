The board-truth audit's duplicate question does not pair a pipeline verify row with the build it verifies, in either direction, and two unrelated rows with similar titles still pair (agent-org#765; a11ign#4901 against #4488).

**What changes.**
- `buildsVerifiedBy(body)` and `verifiesOrVerifiedBy(row, other)` (`src/board-truth-audit.ts`): the build a row names in its `Verifies: #n` line or its `<!-- verify-row: build #n -->` marker, the two forms `verify-row.ts` writes. `nearDuplicates` refuses to pair two rows when either names the other.
- `src/board-truth-audit.test.ts`: one test, with a positive control that the real pair clears `DUPLICATE_SIMILARITY` on words alone, so the empty result is the rule and not a short title.

Acceptance: `cd /home/agent/repos/wt-agent-org-765 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/board-truth-audit.test.ts`

Mutation: four hand mutations, each restored from a copy in the scratchpad and `diff`ed byte-identical, each red in the new test: the exemption never firing (1 red, the new test alone); the exemption always firing (5 red, the new test and four existing twin tests); only the "other row names this one" direction (1 red); only the "this row names the other" direction (1 red).

Measured: `board-truth-audit.test.ts` passes 47 of 47 (46 before the new test). `tsc --noEmit` prints 81 errors in this worktree, none in `board-truth-audit*`: they are `Cannot find module '@a11ign/toolchain/...'` and the implicit-`any` they cause in other files, which this worktree's linked `node_modules` does not carry.

Closes a11ign/agent-org#765

platform: n/a (the question is about two row bodies the audit already holds; nothing in GitHub pairs a verify row with its build for this alarm)
