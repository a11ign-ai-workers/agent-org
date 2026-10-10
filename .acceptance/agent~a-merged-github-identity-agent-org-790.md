A merged `github.identity` switch takes effect on the next tick, and a declared app role that makes calls and never as its app is a ledger incident (the whole of a11ign/agent-org#790, parent a11ign/a11ign#4900). `host-units.ts --json`, which the gate spawns every tick, re-renders `~/.local/bin/gh` alone when its identity block differs from `host.json`'s declaration (`rerenderGhWrapper`, through the same atomic write as `host:install`); `src/app-role-silent.ts` is the pure detector and the same tick files each silent role once per episode as an `app-role-silent` failure-ledger line.

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-790 && npx rstest run --config scripts/rstest/rstest.config.ts src/app-role-silent.test.ts src/packaging/host-units.test.ts'`

Mutation: the re-render made never to fire (`if (true) return null`) failed 5 of 18 tests; made always fire (`if (false) return null`, so a matching wrapper is written) failed 5. The detector's window never excluding an old call failed 4; an `app:<role>` line in the window never rescuing a role failed 3; the wrapper's own `incident` line counted as a call failed 1; a role with no call at all flagged (`calls > 0` dropped) failed 4. `host-units.ts` and `app-role-silent.ts` restored byte-identical each time (`diff` against a copy in the scratchpad).

Measured: `VERDICT pass: 185 tests in 2 files` for the Acceptance (18 in `src/app-role-silent.test.ts`, 167 in `src/packaging/host-units.test.ts`, which was 167 at origin/main before the change). `src/app-token.test.ts`, `src/failure-ledger.test.ts`, `src/packaging/host-project-paths.test.ts`, `host-install-claude-wrapper.test.ts`, `host-tool-install.test.ts` and `gh-call-ledger.test.ts`: `0 of 55 tests failed in 6 files, 2 files failed`, and the same two files fail to LOAD (a circular-import `ReferenceError: Cannot access 'ANSWER_PREFIX' before initialization` under this worktree's copied, older `@a11ign/toolchain` 0.1.2) with `host-units.ts` at `HEAD`, so they are not this change. `tsc --noEmit` reports nothing in `host-units.ts`, `app-role-silent.ts` or either test; its other errors are modules the older toolchain does not carry.

Live reading (Done-when 2, which needs the release installed): the scratch `host.json` is the test's. The test `SWITCHING A ROLE TO user-accounts AND BACK` prints the wrapper's `APP_ROLES=` line at each step in its own output (declared `workers`, then `user-accounts` for every role with the `workers` arm gone, then `github-apps` again with it back) and asserts a second tick writes nothing. The live host's `host.json` was not read or written.

Closes a11ign/agent-org#790

platform: systemd/git/GitHub do not render a template from a declaration; the re-render reuses `shippedScriptText` and `hostIdentityInstall`'s atomic write (now one `writeOwnedFile`), and the incident goes through `recordFailures`, so no new writer or reader of either was built

🤖 Generated with [Claude Code](https://claude.com/claude-code)
