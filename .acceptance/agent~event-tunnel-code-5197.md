The code half of a11ign/a11ign#5197 (the last mile of #5043): a host can expose the event receiver to GitHub through Tailscale Funnel, and the scheduler App's webhook can be set by the App's own JWT. The host's declaration (`.agent-org/host.json`) is a11ign/a11ign's PR and waits for this release: the previous reader REFUSES a `poll` host that names a receiver, so flipping `host.json` first would stop every tick.

**What changes.**
- `host-config.ts`: `events.tunnel` (`tailscale-funnel` | `none`, default `none` and left absent) and `events.publicUrl` (exactly `https://<host>/<path>`: no port, query, credentials or trailing slash). A funnel needs a `publicUrl`, a receiver, and `receiver.tunnel: "tailscale"`, each refused by field name. A `poll` host may name a receiver once it names a `tunnel`, so `"tunnel": "none"` is the whole revert; `poll` with a receiver and no `tunnel` is refused as before.
- `host/event-tunnel.service.in` + `host-units.ts`: a oneshot that stays active, shipped only for `tunnel: tailscale-funnel` (`HOST_OPTIONAL_UNITS`), `enable --now`ed (`LONG_RUNNING_TEMPLATES`). It runs `event-tunnel.ts up` and `down`. The receiver's unit now ships for `source: webhook` OR a funnel, so the feed is live while the gate still polls; `work-tick.ts` still acts only on `source: webhook`.
- `event-tunnel.ts`: `up`/`down` (`tailscale funnel --bg --yes --https=443 --set-path=<path> http://127.0.0.1:<port>`, and the same with `off`; never `reset`, never unscoped, so the trace pages' 8443 mount is untouched), `register` (creates the secret file at mode 600 if absent and never replaces it, then `PATCH /app/hook/config` by the App's JWT), `deliveries` (GitHub's delivery log: id, event, action, status).
- Three pins moved because the property they pin moved (`host-units.test.ts` long-running list and the tool-form walk's host, `host-units-event-receiver.test.ts` optional-unit keys, `host-project-paths.test.ts` counts, `no-loader.test.ts` node units).

Mutation: (each restored, `cmp` byte-identical, and only its own test red): funnel predicate never fires (2 red) and always fires (2 red); receiver not shipped for a funnel (2 red); secret mode 0644 (1 red); secret always rewritten (1 red); `publicUrl` not required (1 red); `down` unscoped (1 red); a failed registration echoing the response body (1 red).

**Evidence**, measured at this head: `src/event-tunnel.test.ts` 16 of 16 with `AGENT_ORG_HOST` naming the flagged declaration, 15 passed and 1 skipped (reason named) without it; `pnpm test` 10,582 tests in 610 files with 6 red: five fail identically on the untouched primary checkout at v0.177.0 (`live-tree-independence`, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`), and the sixth is `event-tunnel.test.ts`'s live-host test, red here only because this shell's `AGENT_ORG_HOST` names the main checkout's `host.json`, which carries no funnel until the a11ign PR merges. In CI that variable is unset and the test skips.

**Live, and what is not claimed.** `register` ran once against the real App: the secret file was created, and `PATCH /app/hook/config` answered 404, because an App has no webhook until it has been made Active once in its settings. That is the chairman's step (brief on the row), after which `register` sets the URL and secret. Nothing is exposed and no delivery is proven by this PR.

Acceptance: `bash -c 'cd ~/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/event-tunnel.test.ts'`

Closes: none — the code half; the pull request that flags `.agent-org/host.json` closes a11ign/a11ign#5197, after this release is tagged

Outside-Region: host/event-tunnel.service.in — the unit's template, which `host-units.ts` can only ship from `host/`
Outside-Region: .changeset/the-event-receiver-has-a-funnel.md — the entry a project that pins a tag reads
Outside-Region: src/no-loader.test.ts — pins the node-running units, and this adds one
Outside-Region: src/packaging/host-project-paths.test.ts — pins the template count and the tool's directory
Outside-Region: src/packaging/host-units.test.ts — pins the long-running list and walks every template
Outside-Region: src/packaging/host-units-event-receiver.test.ts — pins the optional units' keys

Flag: events.tunnel
Health-signals: blind-ticks, wakes-held
Revert: set `events.tunnel` to `none` in the host's declaration and run `agent-org host:install` (the unit is removed and its path leaves Funnel), then the chairman sets the App's webhook inactive; or revert this PR

The row also names deliveries per hour, signature refusals and receiver restarts. None is a standard signal the gate records (`MACHINERY_SIGNALS`), so none is promised here: `event-tunnel.ts deliveries` reads GitHub's own log for the first, the receiver already logs a 401 per refusal, and `event-drift.ts` is what notices a delivery the receiver never got.

platform: Tailscale's own `funnel --bg` is the mechanism (no tunnel is reimplemented); GitHub's `PATCH /app/hook/config` is the registration.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

History: full
