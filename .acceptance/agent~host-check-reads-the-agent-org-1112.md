`host:check` read the `%h` of an `ExecStart` as a literal directory under the unit's `WorkingDirectory`, and reported a program that is there as PROGRAM MISSING. `programCandidates` now expands a leading `%h` (and `$HOME`) to the home before it resolves the path, the way systemd does before anything runs. `~` is left alone, since systemd does not expand it. The home is a parameter, defaulting to `homedir()`, so the test names it.

Acceptance:

```bash
node --test src/host-check-home-specifier.test.ts
```

Closes a11ign/agent-org#1112

Measured at this head, in this worktree: the command above printed `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`. The same file passes in a depth-1 clone with no token in the environment, which is the shallow acceptance job. `src/packaging/host-units.test.ts` printed `ℹ pass 175`, `ℹ fail 0`. `pnpm run typecheck` exits 0.

History is requested only so the job can run the test: the test's import closure reaches the shallow-checkout check at `host-units.ts:2299`, which the job's detector charges to any test importing that file. The test does not need history; it passes in the depth-1 clone above.

History: full

Mutation: (A) the leading-`%h` expansion removed from `host-units.ts`: 3 of 5 red (positive control, negative control, `$HOME` case); (B) expansion anchored only at the leading position: 1 of 5 red. Each restored byte-identical from a copy with `diff`.

platform: n/a (a resolution step inside the existing `programCandidates`; no platform feature reads a unit's `ExecStart`)
