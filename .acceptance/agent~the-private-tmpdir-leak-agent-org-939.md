The private-TMPDIR leak report says what each leaked entry is. Each leaking file's line keeps its earlier text (`<file> left N in its TMPDIR: <names>`) as a prefix and appends, for the first five entries named: a directory with its entry count, its first three names and its age before the teardown; a file with its age and no count; an entry that vanished between the directory read and the `lstat`, or one that cannot be read, as such. Neither of those two is dropped: both are still counted as a leak. A tidy run and a directory holding only `RUNTIME_CACHE` names report nothing and stay green, and the default policy stays red on a leak.

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/private-tmp.test.ts'`. That runs the primary checkout, not this worktree, so the worktree run is the one that exercises the change: `bash -c 'cd /home/agent/repos/wt-agent-org-939 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/private-tmp.test.ts'`.

Mutation (each restored from a copy in the session scratchpad, `diff` identical; measured with `rstest run` on `src/private-tmp.test.ts`, 14 tests): details never appended turned 5 red; the earlier text moved out of the prefix position, 7; the `vanished`/`unreadable` entries dropped from `entries`, 1 (the negative control); the cache exclusion removed, 2; the policy made never red, 2; made always red, 2; ENOENT read as `unreadable`, 1; the age taken from the wrong end, 2; a file given an entry count, 2; a directory's first names left uncapped, 1.

Measured: `VERDICT pass: 14 tests in 1 file` for `src/private-tmp.test.ts` in the worktree. `npx tsc --noEmit -p tsconfig.json` reports nothing for `src/private-tmp*.ts`. The unreadable-entry half of the negative control (`chmod 000`) is not read when the process is root; it says so on the console and the run here was not root. The vanish race is made deterministic through `findLeaks`'s `describe` option, not by timing.

Not here: the leak in `region-paths-checkout.test.ts` itself is not fixed. The first report that names its cause is the evidence a fix row needs (the row's own words). `pnpm run verify` and the wider `test:org` suite were not run in this worktree.

Closes a11ign/agent-org#939

platform: the age is the entry's `mtime` from `lstat`; nothing in git, pnpm or systemd reports what a test left in a run's TMPDIR.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
