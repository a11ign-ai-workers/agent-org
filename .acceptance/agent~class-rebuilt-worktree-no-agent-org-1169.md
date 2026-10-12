A claimed worktree is not handed to its worker until `typescript` resolves from it, behind the `worktree.rebuildCheck` switch (OFF by default). `spawnWorker` asks a gate after the claim succeeds and before the pane opens: a tree with a `package.json` and no `node_modules/typescript/package.json` (a `node_modules` link that resolves nothing reads as absent) is refused with the cause named, the claim is released so the row is free for the next tick, and no pane is opened. The refusal is written on the row once per cause (`<!-- worktree-not-ready:<row>:<hash> -->`). With the switch off or absent, no gate is passed and the spawn is unchanged. The switch is read from `.agent-org/decisions.json` (booleans only) by name.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1169 && node --test src/wake-worktree-toolchain.test.ts'`

Mutation: the gate made never to refuse (`&& false` on the refusal branch) failed the REFUSAL test only (5 pass, 1 fail); `src/wake.ts` restored byte-identical each time (`cmp` against a copy). Run against `HEAD`'s `src/wake.ts`, the REFUSAL, row-write and switch-reader tests fail (they name exports that do not exist yet); the OFF and positive-control tests pass, as today's behaviour should.

Measured: `node --test src/wake-worktree-toolchain.test.ts`: 6 tests, 6 pass, 0 fail. `pnpm run typecheck` (`tsc --noEmit`) printed no errors. The wake test files, `src/wake*.test.ts` (26 files, 315 tests) and the 28 other test files that import `src/wake.ts` (553 tests), all pass. `package.json` has no `lint` script.

Not here, and named: only `typescript` is checked (the row's open-check sentence); `@rstest/core` is not. The row write is for unkeyed rows only, the same limit `sayClaimRefusal` has, because `rowComments` reads the default repository. The claimed tree in the REFUSAL test is answered by the fake host's `exists`, not a real directory; the real-link case is a separate test that uses `worktreeToolchainReason` against a dangling symlink on disk.

Closes a11ign/agent-org#1169
