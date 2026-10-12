The repeating-lines allowlist covers the gate's two steady counters (agent-org#1196): `gate-rest: N of N conditional reads answered N` (written by `src/work-gate/tick.ts`'s `tickReadingLines` on every tick with the conditional-read flag on, the ETag cache working) and `read memo: N identical read(s) answered from memory, N distinct answer(s) held at the end of the tick.` (written at exit by the gate's process in `src/work-gate/reads.ts`, read deduplication working). Each has one entry in `src/repeating-lines.allowlist.json` carrying a reason that names its writer. The entries are anchored on the whole normalised line, and the other tails of the same family (`gate-rest: ... conditional reads refused`, `read memo: N read(s) refused`) are still offered.

Acceptance: `node --test src/repeating-lines-steady-counters.test.ts`

Mutation: the `gate-rest` entry dropped failed 2 of 4 tests (the line's own test and the 40-tick test); the `read memo` entry dropped failed 2 of 4 (its own test and the 40-tick test); the `gate-rest` pattern widened to the bare `^gate-rest` failed the control test only; the `read memo` pattern widened to the bare `^read memo` failed the control test only. Each mutation was made with a script in the session scratchpad and the allowlist restored by `cp` from a copy, `cmp` showing it byte-identical after every run.

Measured: `ℹ tests 4 / ℹ pass 4 / ℹ fail 0` for the acceptance file; with `src/repeating-lines-*.test.ts`, `src/work-gate-read-memo.test.ts`, `src/gh-conditional.test.ts` and `src/packaging/repeating-lines.test.ts`, `ℹ tests 87 / ℹ pass 87 / ℹ fail 0`. `tsc --noEmit -p tsconfig.json` exit 0.

Closes a11ign/agent-org#1196

platform: the allowlist is the detector's own file and the normaliser is `normaliseLine`; nothing platform-level replaces it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
