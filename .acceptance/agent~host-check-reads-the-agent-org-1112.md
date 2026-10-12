`host:check` read the `%h` of an `ExecStart` as a literal directory under the unit's `WorkingDirectory`, and reported a program that is there as PROGRAM MISSING. `programCandidates` now expands a leading `%h` (and `$HOME`) to the home before it resolves the path, the way systemd does before anything runs. `~` is left alone, since systemd does not expand it. The home is a parameter, defaulting to `homedir()`, so the test names it.

Acceptance:

```bash
node --test src/host-check-home-specifier.test.ts
```

Closes a11ign/agent-org#1112

Measured at this head, in this worktree: the command above printed `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`. The same file passes in a depth-1 clone with no token in the environment, which is the shallow acceptance job. `src/packaging/host-units.test.ts` printed `ℹ pass 175`, `ℹ fail 0`. `pnpm run typecheck` exits 0.

Mutations, applied to `src/host-units.ts`, run, and restored byte-identical (`cp` from a copy, `diff`): (A) the expansion removed: the positive control, the negative control and the `$HOME` case fail, 3 of 5; (B) the expansion no longer anchored to the leading position: only the leading-position case fails, 1 of 5.

platform: n/a (a resolution step inside the existing `programCandidates`; no platform feature reads a unit's `ExecStart`)
