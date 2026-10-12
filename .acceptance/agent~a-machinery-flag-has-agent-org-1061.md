An operator can turn a machinery flag on or off with `agent-org machinery:flag on|off <name> [--signals=a,b] --session=<you>`, and `machinery:flag list` shows each flag with who set it and when. The switch writes the record through `withMachineryFlag` into `machinery-canary.json` in the state directory, the same record `readReenqueueState` and the other readers consult. A name no module reads is refused with nothing written, and so is a signal the tick does not record and a state file that does not parse (left as it was). `off` clears a `reverted` verdict. Before this, the only caller of `withMachineryFlag` was a test, so the three flags could only be turned on by hand-editing the file.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/machinery-flag-switch.test.ts'`

Mutation: `switchFlag` made never to turn a flag OFF (`on: true` forced) failed 2 tests; never to turn it ON failed 3; the `FLAG_REGISTRY` check removed failed 1 (the unknown name was written); the write removed (`writeJsonObject` not called) failed 4. `machinery-flag.ts` restored byte-identical each time (`cmp` against a copy).

Measured: `VERDICT pass: 8 tests in 1 file` for the acceptance file; with `bin-commands`, `machinery-canary`, `rows-unpark`, `work-gate-chain-wait`, `work-gate-ejected-requeue` and `acceptance-commands`, `VERDICT pass: 386 tests in 7 files`. `pnpm run typecheck` exits 0. `node src/bin.ts machinery:flag list` prints the three flags OFF; `node src/bin.ts machinery:flag on queue.nope --session=worker-agent-org-1061` is refused with exit 2 and leaves the state file untouched.

Not here, and named: `rows.autoUnpark` (`AUTO_UNPARK_FLAG` in `unpark-satisfied.ts`) is also a flag a module reads, but it is not in the three-flag registry the row names, so the command refuses it; it is a follow-up. The switch and the gate's tick both read-modify-write `machinery-canary.json` with no lock, so an update landing between the two reads can be dropped; a lock is a follow-up. Turning the three flags on is the gate owner's switch, not this change.

Outside-Region: src/commands.ts — the one command table `bin.ts` dispatches through; `machinery:flag` must be listed there to be reachable, and the test pins that every `// command:` program is listed.

Closes a11ign/agent-org#1061

platform: none; the command is a local file write, and nothing reaches GitHub, git, herdr or the fleet.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
