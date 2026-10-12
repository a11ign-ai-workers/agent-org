Switch on the flag of agent-org#1166 (a11ign#5216): `CI_CLASS.assertionsOnly` is `true`, so a red check's class is read from its failing assertions by default. The explicit `{ assertionsOnly: false }` passed to `readCiFailure` is the whole-log read the classifier had before, and it still passes its own test.

Acceptance: `node --test src/ci-failure-class-assertions.test.ts`

Measured: `pass 5, fail 0` for the acceptance file (node, native TS), and `pass 13, fail 0` for `src/wake-ci-class-review-depth.test.ts`, which reads the classifier with the default flags. `pnpm run typecheck` exits 0. Mutation: the constant set back to `false` fails exactly the pinned test ("the flag is shipped ON ..."), and the file was restored byte-identical from a copy.

`pnpm test`: 4 of 10884 fail in 3 files (`host-install-agent-org-launcher` test 3, `live-tree-independence` two tests, `release-tag-on-merge`). They fail identically on a clean `origin/main` worktree, so they are not caused by this change.

Not here, and named: the changeset `a-ci-class-reads-the-failing-assertions.md` (from #1166) still says the flag "ships OFF". It is outside this Region and is not edited here; it should be corrected by the row's owner before the next release.
