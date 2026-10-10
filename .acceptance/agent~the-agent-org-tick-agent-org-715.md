Each of the six `// COPIED FROM` files the tick's import closure reaches (`changed-files`, `cli-flags`, `git-env`, `local-import-closure`, `npm-cli-executable`, `worktree-resolution`) is compared with `@a11ign/toolchain/lib/<stem>` after install, by exported names and by return value over a table of inputs per function, so a copy that drifts turns a test red instead of staying silent (a11ign/agent-org#715, the follow-up ruled on #522). One new file, `src/packaging/bootstrap-copies-match-toolchain.test.ts`; none of the six originals changes.

**The stems are derived, never listed.** The closure of `work-gate.ts`, `work-tick.ts` and `wake.ts` is walked with `localImports` (the copy of `local-import-closure`) and intersected with the files headed `COPIED FROM`: a seventh copy the tick reaches is compared on the next run, by its names and by every function that has a probe, and one with no probe table is REPORTED, never skipped; a copy the tick stops reaching drops out. `walk-scope.ts` is the seventh kept copy and the tick does not reach it, so it is not compared (its toolchain original differs on purpose, #522's ruling).

**What a pass says.** The test names the six stems and `@a11ign/toolchain@0.7.1` in its test names and in one `bootstrap-copies: comparing ...` line, and refuses an install that does not satisfy the range `package.json` declares (`^0.7.0`): the toolchain in the primary checkout is 0.1.2 today, so the comparison needs the install the host row owns (#714) and is red there by design, not skipped.

**Positive controls (on every stem).** The derivation is fed a synthetic tree and must return exactly the reached, headed file; a copy of the real source with only a comment appended must read as the unaltered copy does, and one with an extra export must be reported; and the real toolchain module with each export replaced in turn must be reported by that export's OWN probe, which is what proves a probe table calls the function it names.

Evidence (measured on this branch, `AGENT_ORG_HOST` the real host file, toolchain 0.7.1 installed into a hybrid `node_modules`): `node --import tsx --test src/packaging/bootstrap-copies-match-toolchain.test.ts` 24 of 24; the same file under `npx rstest run --config scripts/rstest/rstest.config.ts` 24 of 24 (`VERDICT pass`); `npx tsc --noEmit -p tsconfig.json` exit 0.

Mutation: each run by hand with the file copied to the scratchpad first and the restore proved byte-identical with `diff`. A DRIFTED COPY reds its own stem's test and no other: `git-env.ts` stops scrubbing `GIT_*`; `worktree-resolution.ts` takes any value of the override env; `cli-flags.ts` near-miss threshold 4 to 3; `changed-files.ts` drops `--no-renames`; `local-import-closure.ts` drops the `.mjs` candidate (FIRST RUN: 24 of 24 pass, the fixture had no extensionless import that only the `.mjs` candidate could resolve, a hole in the probe table, fixed and re-run red) and tries `.mjs` before `.ts`. THE TEST'S OWN GUARDS: the altered copy made to match (6 controls red), each replaced export made to match (6 red), `compare` made never to report a differing outcome (6 red, the stem tests stay green, which is exactly why that control exists), the git-env probe table emptied (its stem test and its replaced-export control red), both sides of a stem test reading the toolchain's module (6 red), the closure walk following no import (2 red), the header filter dropped (the derivation control red), `package.json` declaring `^0.8.0` (the version test red). On the real tree: a headed file nothing imports changes nothing (24 of 24); the same file imported from `wake.ts` is derived as a seventh stem and reds the probe-table test and its own stem test, naming `zz-seventh-copy`.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-715 && node --import tsx --test src/packaging/bootstrap-copies-match-toolchain.test.ts'`

Closes a11ign/agent-org#715

Outside-Region: .acceptance/agent~the-agent-org-tick-agent-org-715.md -- this file, ADR 0044.

platform: n/a (a parity test over two modules; Node's own `node:test`, no feature of GitHub, pnpm, systemd or git beyond `git diff` in a throwaway repository)

Not done: the Acceptance in the row is written against `/home/agent/repos/agent-org`, the primary checkout, where this file does not exist before the merge and where `@a11ign/toolchain` is 0.1.2 until the host install (#714, owned by `orchestrator`). The command above is the same command from this worktree.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
