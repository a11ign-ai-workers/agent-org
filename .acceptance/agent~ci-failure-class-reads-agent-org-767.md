`readCiFailure` could not read a job log: `gh api repos/<r>/actions/jobs/<id>/logs` exits 1 on the colour codes an Actions log carries (`the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway`), so `ci-failure-class` never reached its provider and wrote no record. The wake's `try`/`catch` made that degrade to the order as the gate wrote it, which is right for the order and is why only a journal line said the use was dead. This is the whole of a11ign/agent-org#767 (found by a11ign/a11ign#4880, part of a11ign/a11ign#4627).

Closes a11ign/agent-org#767

## What changes, and why

- **The log read passes `--allow-escape-sequences`** (`src/ci-failure-class.ts`), the flag `gh api` 2.100.0 names for exactly this refusal.
- **The escape bytes are stripped from the whole log once, before any fact is read from it**, so a coloured `##[error]` still matches `ERROR_LINE`, and a phrase a colour code splits (`rate \e[1mlimit\e[0m`) still matches `RATE_LIMIT_OR_RUNNER_LOST`. The strip is the existing `ANSI` expression, widened from `ESC[<digits;>letter` to ECMA-48's whole CSI form, because a log also carries `ESC[?25l`, which the narrow form left in place; `trimErrorLines` uses the same expression, so it only strips more.
- **A changeset** (patch).

## Platform first, deleting first

platform: the flag is `gh`'s own; nothing was built. Net lines: two in production (one argument, one `.replace`), the rest is tests and the changeset.

## How you verified it

```
$ AGENT_ORG_HOST=<a recorded host with no triage> node --import tsx --test src/ci-failure-class.test.ts src/wake-ci-class-review-depth.test.ts
ℹ tests 28   ℹ pass 28   ℹ fail 0
$ node --import tsx --test src/packaging/gh-call-inventory.test.ts      # the call shapes did not move
ℹ tests 7   ℹ pass 7   ℹ fail 0
$ node_modules/.bin/tsc --noEmit -p tsconfig.json                         # 81 errors before and after, all `@a11ign/toolchain/*` modules missing from this tree; none in the two files
```

The row's command says `cd /home/agent/repos/agent-org`; that is the primary checkout, which does not hold this branch, so it was run from the worktree. The 13 tests of `src/ci-failure-class.test.ts` fail at import on an unset `AGENT_ORG_HOST` on an untouched `main` checkout too (measured in the primary checkout), so the variable names a recorded host, as #4888's acceptance did.

The three new tests drive `readCiFailure` through a `gh` stub that refuses a job log as the real one does: exit 1 on a body holding an escape byte unless `--allow-escape-sequences` is among the arguments, and by content, so a log with no escape bytes reads the same with or without the flag. Fails before the change (the stub's refusal throws out of `readCiFailure`), passes after.

Acceptance: `node --import tsx --test src/ci-failure-class.test.ts src/wake-ci-class-review-depth.test.ts`

Mutation: 3 mutants, each killed by its own tests and no others (the flag dropped: the coloured-log test and the split-phrase test; the strip dropped with the flag kept: the same two; the expression put back to the narrow form: the coloured-log test only, which is why its fixture's `ESC[?25l` line is an error line, since a first draft's was not and the narrow form survived it). Source restored with `cp` and proved byte-identical with `diff`.

## Anything a reviewer should be sceptical of

- **The live record is not this row's.** `~/.cache/a11ign/decisions` holds 0 `ci-failure-class` lines today; it is a11ign/a11ign#4880's to re-read once the host runs the release.
- **The stub is a model of `gh`, not `gh`.** The refusal text and the flag are from `gh api --help` and the row's Open-check on gh 2.100.0; nothing here ran a real job-log read.
