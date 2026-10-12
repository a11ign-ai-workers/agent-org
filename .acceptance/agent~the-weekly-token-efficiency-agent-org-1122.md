`readInstances` in `src/wakes-per-row.ts` no longer aborts the weekly token-efficiency aggregate on one unparseable `spare-cycles` line (agent-org#1122). A line that does not parse, such as a run of NUL bytes left by a torn or concurrent append, is SKIPPED and COUNTED: `readInstances` now returns `{ instances, skipped }`. The count is named in the reading (`UNREADABLE spare-cycles lines: N skipped, not read as instances`, present only when N > 0) and in the weekly aggregate's footer (`src/trace/trace.ts`, `mainAggregate`; on stderr for `--json 1`). Its own test (`NUL-padded spare-cycles line`) has a positive control with the same fixture and no bad line, which must read 0 skipped.

Acceptance:

```bash
git grep -q "agent-org#1122" -- src/wakes-per-row.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/wakes-per-row.test.ts
```

Closes a11ign/agent-org#1122

Measured at this head: the acceptance command printed `VERDICT pass: 48 tests in 1 file` (45 before, plus the 3 `agent-org#1122` tests). Before the change the NUL test failed with `SyntaxError` from `JSON.parse`, the reproduction in the row. Mutations, each run and reverted byte-identical: (1) skip always counted, `skipped + 1` on every read -- the NUL test and its POSITIVE CONTROL both fail (`VERDICT fail: 2 of 48`). Trace suite (`src/trace/*.test.ts` with the wakes-per-row test): `VERDICT pass: 644 tests in 23 files`. `src/packaging/trace-weekly-post.test.ts` and `src/wake-start-fresh.test.ts`: `VERDICT pass: 30 tests in 2 files`. `pnpm run typecheck`: no errors. End to end, `node --experimental-strip-types src/wakes-per-row.ts` with a `spare-cycles` holding a NUL run between two valid lines exits 0 and prints the UNREADABLE line.

Full `pnpm test` at this head: `VERDICT fail: 5 of 10675 tests failed in 618 files`. The same five fail with the HEAD versions of the three changed files in place (measured by swapping them and restoring), so they are not this change: `live-tree-independence` (`Cannot find module 'tsx/package.json'`, `tsx` is not declared in `package.json`), `release-tag-on-merge` (expects no lockfile, `pnpm-lock.yaml` is tracked), `work-gate-other-scopes-concurrent` (`ProjectDeclarationRefusal`), `worker-stop-hook`.

Not done: the root cause, the writer of the NUL run. `appendSpareCycle` in `src/wake.ts` appends with `writeFileSync(..., { flag: "a" })` and takes no lock; that is read from the code, and was not reproduced. The live `spare-cycles` file is not repaired (an org record, `orchestrator`'s host), so the aggregate names one skipped line until it is.

platform: `JSON.parse` in a try/catch; no new reader, and the existing `readInstances` callers are updated rather than a parallel one added.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
