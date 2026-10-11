The work-tick unit carries `CPUWeight=400` (above the default 100, so an engineer's `pnpm -r run build` no longer takes an even share of the host from a tick), and the tick-cost line records each `ExecStartPre` command's own wall as `prestartSteps` beside `prestartMs`. `readUnitFacts` asks `systemctl --user --timestamp=us+utc show` for `ExecStartPre` too and reads each entry's `start_time` and `stop_time`; an entry whose time is `[n/a]` or missing is `null` for that step only, and the field is `null` off systemd. The three pins of the unit's rendered bytes move with the new line, as their own comments say each such change does.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-920 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/host-units.test.ts src/work-tick-cost.test.ts src/packaging/host-project-paths.test.ts src/packaging/host-tool-install.test.ts src/packaging/shadow-window-arm.test.ts'`

History: full

Mutation: `CPUWeight=400` deleted from `host/work-tick.service.in` failed 1 test (the #920 unit test); `CPUWeight=100` failed that test only; a step with no exit time read as `0` instead of `null` failed the `readUnitFacts` test only; `prestartSteps` made always `null` failed the `readUnitFacts` test only; the `unknown` return without the `prestartSteps` key failed 2 tests (the off-systemd one and the tick-line one). Each file restored byte-identical (`diff` against a copy).

Measured: the row's own two files, `VERDICT pass: 207 tests in 2 files`; with the three digest-pin files and `work-tick-health.test.ts`, `VERDICT pass: 282 tests in 6 files`. `tsc --noEmit` clean. Full `pnpm test`: 8 failures, of which three were this change's own (the three digest pins, now moved and green), four fail identically on `origin/main` (`live-tree-independence` x2, `release-tag-on-merge`, `worker-stop-hook`), and one (`work-gate-other-scopes-concurrent`) passes alone on this branch and failed only under the full run's load. The format of the `ExecStartPre` lines and the `--timestamp=us+utc` form were read from `systemctl --user show a11ign-work-tick.service` on this host (systemd 259), not assumed.

Not here, and named: the tick-line test off systemd can only prove the field is present and `null`; a real step list is proven by the `readUnitFacts` test against output copied from this host. The reading after `host:install` (the next 20 ticks against the 20 before) is `ceo`'s, per the row. `slowTickOrders` in `work-tick-health.ts` does not yet name the slowest step; it is outside this row's Region.

Closes a11ign/agent-org#920

platform: systemd's own `CPUWeight=` and its `ExecStartPre` exec status (`systemctl show`) carry both halves; nothing is built.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
