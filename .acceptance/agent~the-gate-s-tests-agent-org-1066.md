The gate's pinning tests read its source through one helper, `workGateSource()`, which returns `src/work-gate.ts` followed by every non-test file under `src/work-gate/`, sorted (agent-org#1066). The test-side half of a11ign#5152's split; no behaviour changes.

**What changes.**
- `src/lib/work-gate-source.ts` (new): `workGateSource(srcDir?)`. The entry, then each non-test `.ts` under `work-gate/` (recursive, sorted by code point), joined with `\n`. Test files are excluded because a count or an absence pinned on the gate would otherwise see the pin's own text; `no-search-reads.test.ts` walks the directory with the same filter.
- `src/packaging/work-gate-source.test.ts` (new): positive control (a fixture holding seven files, one nested, written out of order, returns the entry then all of them sorted), a nested-file control, a negative control (a neighbour of the entry, an unrelated file, the helper itself and a `.test.ts` under `work-gate/` are not read), and the real tree.
- 32 test files (the Region's list) call it in place of `readFileSync` on `src/work-gate.ts` (and, in two of them, on `src/work-gate/org-health.ts`), and drop the imports the call left unused.
- Nothing in `src/work-gate.ts` or `src/work-gate/` changes.

**Every pin held.** No pin had to be moved, loosened or named as not holding on the helper's text.

**Mutation, each in its own direction** (restore byte-identical, `cmp` against a copy):
- `.sort` removed: the sorted-order control goes red (1 failing; it was NOT red until the fixture held a nested file that sorts between two top-level ones, because this filesystem lists a flat directory sorted).
- every `.ts` under `src/` read: the nested, sorted-order and negative controls go red (3 failing).
- `.test.ts` filter removed: the negative control and the real-tree control go red (2 failing).
- `recursive` dropped: the nested-file control goes red (1 failing).
- entry placed last: all four go red.

**Failing set.** `npx rstest run --config scripts/rstest/rstest.config.ts` over the whole suite, measured with the rstest JSON report: base `843df8a7` fails 15 of 10396 tests in 592 files; this branch fails 15 of 10400 in 593 files (the four new tests), and the two lists of failing test names are identical (`diff` empty). They fail on the untouched base too; the cause I read in the report is `AGENT_ORG_HOST` unset in this worktree (resolveHomeCheckout), and I did not trace the other 14 individually.

**Open-check at this head.** `git grep -l -E "readFileSync\([^)]*work-gate(\.ts)?" -- src scripts` now names two files, the helper and its own test, which read the entry on purpose; no other test does.

Acceptance: `test "$(git grep -L "work-gate-source" -- src/board-truth-audit.test.ts src/pr-hold.test.ts src/row-tracker.test.ts src/unpark-satisfied.test.ts src/work-tick-cost.test.ts src/packaging/work-gate.test.ts | wc -l)" = 0 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-source.test.ts src/packaging/work-gate.test.ts src/work-gate-lane-reads.test.ts`

Closes a11ign/agent-org#1066.

platform: n/a (a read of the checkout's own files; nothing on the platform lists a module set)
