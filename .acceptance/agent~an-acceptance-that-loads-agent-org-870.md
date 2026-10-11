An Acceptance that loads TypeScript through `tsx` is refused at filing and at `pr:open` (a11ign/agent-org#870). `tsxAcceptanceReason` (`src/acceptance-commands.ts`) is called by `acceptancePathsReason`, which `row-file` calls, and by the `acceptance` report in `CI_BODY_REPORTS`, which `pr:open` and CI share, before the command runs. It refuses `--import tsx`, `--import=tsx`, `--loader tsx`, `pnpm exec tsx` and a `tsx <file>` runner at a command's own position, names the line and gives `node --test <file>` as the way out. A `Hand-run:` body, prose outside the Acceptance, `git grep tsx` and the one-shot registry runner (the placeholder Acceptance of many test fixtures) are not refused.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/acceptance-no-tsx.test.ts
node --test src/acceptance-no-tsx.test.ts
```

Outside-Region: src/row-file-board.test.ts — its one fixture Acceptance was `node --import tsx --test x`, the spelling this row refuses, so two `--board` tests were refused at filing; the line is now `node --test x`.

Mutation: five, each red and each restore byte-identical (`cp` to the scratchpad and back, `diff` of the two empty): the predicate returning false (4 red: the CONTROL, the POSITIVE CONTROL, the every-spelling test, `checkBody`); the predicate returning true (6 red: the CONTROL, the NEGATIVE, the every-spelling test, the mention-only lines, the prose test, `checkBody`); the `row-file` seam unwired (2 red: the POSITIVE CONTROL and the every-spelling test); `checkBody`'s report unwired (1 red: its own test); the bare arm loosened to `no-loader.test.ts`'s `(^|\s)tsx` (3 red: the CONTROL, every-spelling, mention-only, because `git grep -qE tsx` is refused).

Measured: `pnpm test` (rstest, the whole suite) prints `VERDICT fail: 60 of 9659 tests failed in 539 files` with this change, and the same 60 test names fail on `origin/main`'s `acceptance-commands.ts` (the 24 failing files re-run with the file restored to HEAD: `60 of 817`; compared by name, `comm -23` is empty). `pnpm run typecheck` is clean. The first full run, before `npx tsx` was left unrefused, had 132 failures: 72 were fixtures that file an `npx tsx --test x` placeholder.

Closes a11ign/agent-org#870
