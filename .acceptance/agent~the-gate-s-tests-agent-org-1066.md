The gate's pinning tests read its source through one helper, `workGateSource()`, which returns `src/work-gate.ts` followed by every non-test file under `src/work-gate/`, sorted (agent-org#1066). The test-side half of a11ign#5152's split; no behaviour changes.

**What changes.**
- `src/lib/work-gate-source.ts` (new): `workGateSource(srcDir?)`. The entry, then each non-test `.ts` under `work-gate/` (recursive, sorted by code point), joined with `\n`. Test files are excluded because a count or an absence pinned on the gate would otherwise see the pin's own text; `no-search-reads.test.ts` walks the directory with the same filter.
- `src/packaging/work-gate-source.test.ts` (new): positive control (a fixture holding seven files, one nested, written out of order, returns the entry then all of them sorted), a nested-file control, a negative control (a neighbour of the entry, an unrelated file, the helper itself and a `.test.ts` under `work-gate/` are not read), the real tree, and a guard that no test reads the gate's entry directly (its pattern is checked against each shape the 32 readers had, and one reader put back is named).
- 32 test files (the Region's list) call it in place of `readFileSync` on `src/work-gate.ts` (and, in two of them, on `src/work-gate/org-health.ts`), and drop the imports the call left unused.
- Nothing in `src/work-gate.ts` or `src/work-gate/` changes.

**Every pin held.** No pin had to be moved, loosened or named as not holding on the helper's text.

**Mutation, each in its own direction** (restore byte-identical, `cmp` against a copy):
- `.sort` removed: the sorted-order control goes red (1 failing; it was NOT red until the fixture held a nested file that sorts between two top-level ones, because this filesystem lists a flat directory sorted).
- every `.ts` under `src/` read: the nested, sorted-order and negative controls go red (3 failing).
- `.test.ts` filter removed: the negative control and the real-tree control go red (2 failing).
- `recursive` dropped: the nested-file control goes red (1 failing).
- entry placed last: all four helper controls go red.
- the direct-reader pattern loosened to never match, or to always match: its pattern case and its guard case go red in each (2 failing, twice).

**Failing set.** `npx rstest run --config scripts/rstest/rstest.config.ts` over the whole suite, measured with the rstest JSON report: base `843df8a7` fails 15 of 10396 tests in 592 files; this branch fails 15 of 10400 in 593 files (the four new tests), and the two lists of failing test names are identical (`diff` empty). They fail on the untouched base too; the cause I read in the report is `AGENT_ORG_HOST` unset in this worktree (resolveHomeCheckout), and I did not trace the other 14 individually.

**Open-check at this head.** `git grep -l -E "readFileSync\([^)]*work-gate(\.ts)?" -- src scripts` now names two files, the helper and its own test, which read the entry on purpose; no other test does.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-source.test.ts src/work-gate-lane-reads.test.ts`

The row's own two commands are not both runnable by the acceptance job: `src/packaging/work-gate.test.ts` imports `history`, which that job has no token for, and a `test`/`wc -l` check cannot verify anything. Run locally exactly as the row wrote them, the first printed `0` and the second passed 432 tests in the three files. The first command's claim is a test here instead: the last case of `work-gate-source.test.ts` names every test file that reads `src/work-gate.ts` or a file under `src/work-gate/` directly, and finds none.

Mutation: `.sort` removed, every `.ts` under `src/` read, the `.test.ts` filter removed, `recursive` dropped, and the entry placed last each turn the helper's own controls red (1, 3, 2, 1 and 4 failing), and the direct-reader pattern made never or always match turns its own two cases red; each restore byte-identical.

Closes a11ign/agent-org#1066.

platform: n/a (a read of the checkout's own files; nothing on the platform lists a module set)
