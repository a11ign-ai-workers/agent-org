`host:install` on a host that declares `events.source: webhook` writes and starts the receiver's unit (`a11ign-event-receiver.service`, `enable --now` on the service), and on a `poll` host (or one with no `events` block) it neither lists, writes nor misses it; an installed copy on a host that reverted to `poll` is an orphan the install stops and removes.

**What changes.**
- `host/event-receiver.service.in` (new): `Type=simple`, loopback, `Restart=on-failure`, the compile-cache and `GH_CONFIG_DIR` lines; `ExecStart` runs `src/event-receiver.ts --port --secret-file --queue` from `host.events.receiver` and `stateEntryPath("events/queue.jsonl")`. Its header says the tunnel is NOT started here and names `127.0.0.1:<port>`.
- `host-config.ts`: registered in `LONG_RUNNING_TEMPLATES`; `templateValues` carries `eventsPort`, `eventsSecretFile` and `eventsQueue` for a webhook host only (a path holding a space or a systemd specifier is refused by field name).
- `host-units.ts`: in `TOOL_ENTRIES`; `HOST_OPTIONAL_UNITS` (template to a predicate over `host.events`) read by `shippedUnits`, which takes the host; the tool form for the unit.

**Existing pins moved, in the same PR** (they enumerate shipped units): `host-project-paths.test.ts` 30 to 31 entries and 33 to 34 files scanned; `host-units.test.ts` the long-running list, the compile-cache population (a host-optional template is not this population), and the #3443 walk, which renders every template and now does so for a webhook host.

Mutation (each restored byte-identical, copy in the scratchpad, `diff`): predicate always true, 3 of 7 red (absent-on-poll, install, orphan); predicate always false, 3 of 7 red (present-on-webhook, install, orphan); template left out of `LONG_RUNNING_TEMPLATES`, 2 of 7 red (classification, `enable --now`); `--queue` dropped from `ExecStart`, 1 red (rendering); secret path not read from the declaration, 1 red (rendering).

Evidence: `src/packaging/host-units-event-receiver.test.ts` 7 of 7, with `host-units.test.ts` and `host-project-paths.test.ts` 192 of 192 together, measured at this head. This row installs nothing on the live host: the live `host:install` is the VERIFY row's.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/host-units-event-receiver.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/host-units-event-receiver.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/host-units-event-receiver.test.ts
```

The row's third command leads with `cd ~/repos/agent-org`, which `runAcceptanceCommand` does not map to this worktree (the `~` is not expanded, so it reads the primary checkout, which carries the change only after the merge); the same command run in the worktree's top level is the one above.

Closes a11ign/agent-org#980.

History: full

The new test reaches `shippedUnits` and `orphanedUnits` in `host-units.ts` (`addedOnSomeRef`, `git log --all`, `--is-shallow-repository`), which need the real answer a shallow checkout cannot give; the line above is why the acceptance job is handed full history.

Mutation: predicate always true, always false, template out of `LONG_RUNNING_TEMPLATES`, `--queue` dropped from `ExecStart`, secret path not read from the declaration: each went red in its own tests and no others (3, 3, 2, 1, 1 of 7); each restore byte-identical.

Outside-Region: src/packaging/host-units.test.ts — it pins the long-running list, the compile-cache population and the #3443 walk, all of which enumerate shipped units.
Outside-Region: src/packaging/host-project-paths.test.ts — it pins the tool's entry count (30 to 31), the one numeric pin the new template moves.
Outside-Region: src/no-loader.test.ts — it lists the units that run node on a `.ts`; the new unit is one more.
Outside-Region: src/packaging/work-gate.test.ts — it declares each test file that joins the `history` population; the new test file imports `host-units.ts` like the others.
Outside-Region: .changeset/a-webhook-host-ships-the-event-receivers-unit.md — the entry a project that pins a tag reads.

platform: systemd already starts and restarts a `Type=simple` service and the existing long-running and orphan paths already stop and remove one; the only new machinery is the host-keyed predicate, because `OPTIONAL_UNITS` reads the project's file.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
