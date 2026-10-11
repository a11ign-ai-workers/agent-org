The agents host has a boot unit that repairs and resumes after an unclean shutdown (a11ign/a11ign#5127). `src/crash-recover.ts` restores 0-byte tracked files from HEAD, moves empty git files aside and refetches, resumes dead seat and worker panes with the role's launch flags, closes dead reviewer panes, resets failed units, announces once, and wakes `ceo` on a second hard crash inside seven days; `host/crash-recover.service.in` runs it before the tick timer. A clean boot does nothing.

Acceptance:

```bash
bash -c 'cd ~/repos/agent-org-wt-5127 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/crash-recover.test.ts'
```

Closes a11ign/a11ign#5127

Measured: the command above printed `VERDICT pass: 10 tests in 1 file` at this head, on fixture git repositories. Mutations, each reverted byte-identical: (1) restore never fires -- 2 tests fail; (2) boot always unclean -- 2 tests fail (the clean-boot twin and the detection test); (3) reviewer panes not closed -- 2 tests fail.

Outside-Region: `host/crash-recover.service.in` (the unit template `host-units.ts` registers; a unit cannot ship without it), `.changeset/` and this file.

Not done: (1) done-when 2, the live reading, waits for the next host restart. (2) Item 2, atomic writes for EVERY file the tool writes, is only half done here: `writeFileAtomic` exists and the module's own state uses it; converting the other writers (ledgers, caches, rendered declarations) is a separate sweep and should be a new row. (3) The incident for a new pstore record is a failure-ledger line (`host-hard-crash`) plus a text file with the record's last lines under `~/.cache/a11ign/`, not a GitHub row. (4) `host:install` / `host:check` were not run (resource-adjacent to the fleet host); the unit is registered in `TOOL_ENTRIES` and renders from the same placeholders as `kernel-reboot.service.in`, but nobody has installed it.

platform: systemd `Before=`/oneshot ordering, `git fetch --refetch`, `git fsck`, journald's own unclean-shutdown line and pstore; herdr's own `pane run`/`pane close`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
