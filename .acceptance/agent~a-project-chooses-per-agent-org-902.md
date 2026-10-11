A project can choose how a wake class is served (a11ign/agent-org#902, Move 3 option of a11ign/a11ign#4505): `src/seat-mode.ts` reads `.agent-org/seats.json`, `{ "<cause>": "seat" | "run" }`, and `seatModeOf(cause, deps)` returns `run` only when the registry holds the cause AND the file says exactly `run`; `src/decision-run/registry.ts` adds the `DecisionClass` type and `loadClasses(dir)`, which imports every non-test `*.ts` in a directory and refuses, by file name, a module that is not a class and a second class for one cause. No class and no caller is added: **no wake path calls `seatModeOf` yet**, so behaviour is byte-identical to `origin/main`.

**The one-line revert** is deleting `.agent-org/seats.json`, or setting the cause to `"seat"`. The option is OFF by default: no file, an empty file, `{}`, malformed JSON, a value other than `seat`/`run`, a cause the file does not name, and `run` for a cause the registry does not hold each read `seat`. A malformed file turns EVERY class to `seat` and says which file, never what it held (`readSwitches` in `decision-provider.ts` keeps the same rule).

**Assumptions** (the row fixes the names, not these shapes):
- `loadClasses` is async (it uses `import()`), takes the class from each module's `default` export, and throws `DecisionClassError` (carrying `file`) on the first refusal; an absent directory is no classes (`classes/` does not exist yet).
- `seatModeOf` takes `{ path, known, read?, diagnostic?, warned? }`: `known` is anything with `has(cause)` (the Map `loadClasses` returns), so `seat-mode.ts` does not import the registry.
- `tierQuestion` is typed as an optional function with `buildQuestion`'s signature (the question that picks the tier); `actionsFor` returns `DecisionAction[]`, a ticket-port post or `StateChange`. The row names the members and not their types; no class exists to constrain them yet.
- A value other than `seat`/`run` makes THAT cause `seat` (and says so once, naming the file and the cause the caller asked about); only an unreadable or non-object file turns every class to `seat`.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/seat-mode.test.ts
git grep -q "NEGATIVE CONTROL" -- src/seat-mode.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/seat-mode.test.ts src/decision-run/registry.test.ts
```

The row's third command is `bash -c 'cd ~/repos/agent-org && npx rstest run ...'`; the primary checkout carries the new files only after the merge, so the command above is the same one run in the PR's own tree.

```
VERDICT pass: 23 tests in 2 files -- full report: A11Y_RSTEST_FULL_REPORT=1
```

Mutation (each applied once, run against both test files, restored from a scratchpad copy and checked with `diff` and `git diff --quiet`):
- `seatModeOf` never gives `run` (`return "seat"` for `run`): 4 of 23 fail, the two POSITIVE CONTROLs and the two negative tests that need a `run` neighbour or an own-key `run`.
- gives `run` for any named value: 2 of 23 fail, the value-other-than-seat/run test and the per-cause test. The positive controls still pass, so the two directions break different tests.
- ignores the registry (`known.has` removed): 2 of 23 fail, the unknown-cause and empty-registry tests.
- the malformed-file line echoes the file's text: 2 of 23 fail, the malformed-JSON test and the unreadable-file test.
- `loadClasses` accepts any default export (the `whyNotClass` refusal removed): 3 of 23 fail.
- allows two classes for one cause: 1 of 23 fails, the duplicate test.
- imports `*.test.ts` files too: 1 of 23 fails, the POSITIVE CONTROL that has a throwing test file beside the classes.

Also run: `tsc --noEmit` clean; no `.mjs` touched; this repository has no `lint` or `verify` script (`package.json` scripts: `typecheck`, `test`). The whole suite on this branch: `4 of 9686 tests failed in 541 files`, none in or importing either new file (`git grep` for `seat-mode` and `decision-run/registry` outside the four files finds nothing): `packaging/live-tree-independence` (2, `Cannot find module 'tsx/package.json'` in this fresh worktree), `packaging/release-tag-on-merge` (a `pnpm-lock.yaml` expectation) and `work-gate-other-scopes-concurrent` (`14 !== 16` in a run whose log has `gh: 502`). Not rerun against a clean `origin/main`, so whether they fail there is inferred from the imports, not measured.

Closes: a11ign/agent-org#902

platform: n/a (a pure option reader and a directory import; GitHub, pnpm, systemd and git have no per-cause seat-or-run switch)
