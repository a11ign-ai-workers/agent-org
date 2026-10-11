A fourth kind of unfinishable Done-when item, `post-merge-act` (a11ign/agent-org#751, parent a11ign#4437): an act that needs the merged result to be true, with no time, seat or row named. `unfinishableItems` returns it, so `row-file` refuses a new row carrying it and names the split (file the build row; the verify row follows it, behind `--blocked-by`). agent-org#475's item 2 (`compact-store --dry-run` run on the host against the live store) and #560's item 2 (`a11ign#4623` told that the fix is in force, with the merge commit) each read `[]` before this and each held a worker after its pull request merged.

**The boundary against `live-check` is the verb.** A reading (a record quoted on a row, a switch read on, a log line after the merge) is still no refusal and `liveCheckItems` / `verify-row.ts` read exactly the items they did; an act is something somebody does to the live system or tells another row. An item that matches both is refused at filing and still returned by `liveCheckItems`, so a row filed before this closes as it did. An item already `future-time`, `seat-act` or `row-outcome` keeps that kind (one item, one finding).

**What is not refused** (each with its control in the test): an item that says the act is a verify row's or another row's (`#476`'s own wording, measured in the live sweep; the first draft flagged it), a test's assertion about a command (`the file bytes are equal before and after the run`), a quotation in code, and a row that already follows something: a blocked-by edge, a readable `Waiting-for:`, a `Waits-on-done-when:` or the `Verifies: #N` line `verify-row.ts` writes.

Acceptance:

```bash
AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import tsx --test src/unsplit-done-when-post-merge.test.ts src/unsplit-done-when.test.ts
```

Closes a11ign/agent-org#751

Measured, on this head: that command prints 19 tests, 19 pass (9 new in `src/unsplit-done-when-post-merge.test.ts`, 10 in the existing file). Under the repo's runner (`npx rstest run --config scripts/rstest/rstest.config.ts`) those two files and `src/verify-row.test.ts` are 34 tests in 3 files, all passing. `tsc --noEmit` reports the two `mjs-ratchet.test.ts` errors `origin/main` reports and no other. The row's Acceptance as written (`cd /home/agent/repos/agent-org && ...`) runs in the primary checkout, which does not hold the new test until this merges: it ran the existing file there, 10 of 10. `src/packaging/row-file.test.ts` has 8 failures that are the same 8 on the unmodified classifier (measured by running it with `git show HEAD:src/unsplit-done-when.ts` in place and restoring); they are not this change's.

Mutation: seven, each restored byte-identical (copy in the scratchpad, `diff` printed `RESTORED-IDENTICAL`). The classifier never fires: the positives fail (my tests 1, 2, 3, 4, 5, 6, 7, 8, 9). It always fires: the controls fail (my 1-9 and the existing live-check test 11). The disown guard removed: test 3 alone. The `Verifies:` line not read as data: test 7 alone. Data never excusing the act: test 7 alone. The act checked before `future-time`: test 6 alone. Restored: 0 red.

Open-check, re-run on this head: `unfinishableItems("## Done-when\n\n1. a11ign#4623 is told on its row that the fix is in force, with the merge commit.\n").length` prints `1` (it printed `0` on the row, taken 2026-10-10T20:02Z).

Not done, and routed: the promotion path (`promoteRefusalReason` -> `fileRefusalReason`) does not call `unsplitDoneWhenRefusal` for ANY of the four kinds (measured: the only call site is `createIssue`, `src/row-file.ts:1941`), and `row-file.ts` is outside this row's Region. And `verify-row.ts` files a verify row for `future-time` and `live-check` items only, so a build row that already carries a `post-merge-act` and closes on its merge files none for it and does not name it as declined. Both are named on the row.

platform: n/a (a pure classifier over a body; no GitHub, pnpm, systemd or git feature involved)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
