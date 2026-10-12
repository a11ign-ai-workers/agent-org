The trace pages stop being a file-path mount: `src/trace-publish-serve.ts` serves `defaultOut()` read-only on 127.0.0.1:8788 (GET and HEAD only, no listing, a path or symlink that leaves the directory is 404, a directory that does not exist yet answers 404 and does not stop the server), and `host/trace-publish-serve.service.in` runs it as a sibling unit that restarts on failure. The 8443 tailnet mount is now `tailscale serve --bg --https=8443 http://127.0.0.1:8788`, a PROXY handler, so the operator can change Funnel mounts without root. The ceo's ruling (2026-10-12 11:32Z) is the form.

Acceptance: `bash -c 'tailscale serve status --json | jq -e "[.Web[]?.Handlers[]? | select(has(\"Path\"))] | length == 0"'`

Mutation: the containment check removed failed 2 of 10 tests (the `..`/escaped-`..` cases and the symlink to the secret); the `isFile` check removed failed 1 of 10; the method check removed failed 1 of 10. `src/trace-publish-serve.ts` restored byte-identical each time (`diff` against a copy).

Measured: `src/trace-publish-serve.test.ts` `VERDICT pass: 10 of 10`. The three packaging files that pin the unit lists (`src/packaging/host-units.test.ts`, `src/packaging/host-project-paths.test.ts`, `src/no-loader.test.ts`) `VERDICT pass: 194 tests in 3 files`. `pnpm run typecheck` exit 0. Full `pnpm run test`: 4 of 10955 tests fail in 3 files (`host-install-agent-org-launcher`, `live-tree-independence` x2, `release-tag-on-merge`); the same four fail on a clean checkout of HEAD, so they predate this change and are not named here as this change's.

Migration, in order (done live on the host, 2026-10-12, as the ceo's ruling asked):
1. Start the server: `systemd-run --user --unit=trace-publish-serve-transient --working-directory=<worktree> -p Restart=on-failure -p RestartSec=10 -p Environment=AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json /home/agent/.local/bin/node src/trace-publish-serve.ts`. The installed unit replaces this at `host:install`.
2. Remove the old handler: `tailscale serve --https=8443 off`. This is run BEFORE the proxy, because `off` removes the whole 8443 listener and would delete the new mount if it ran after.
3. Point the mount: `tailscale serve --bg --https=8443 http://127.0.0.1:8788`.
4. Check: the Acceptance command above prints `true`; `https://agents.tail15a8bb.ts.net:8443/` answers 200 with the index byte-identical to `index.html`; POST answers 405; `a11ign-event-tunnel.service` is `active` (not restarted).

Region: the row's Region lists three files. This change also touches `src/host-units.ts`, `src/host-config.ts`, `host/trace-publish-serve.service.in` (the unit `host:install` ships, which condition (2) of the ruling requires), and the three pinned tests above. Those files are outside the Region, so `product-manager` must amend it before this PR can be opened.

Closes a11ign/agent-org#1159

🤖 Generated with [Claude Code](https://claude.com/claude-code)
