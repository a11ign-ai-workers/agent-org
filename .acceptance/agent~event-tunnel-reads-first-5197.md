Closes: none -- the row a11ign/a11ign#5197 stays open for the live delivery proof; this is the code half of its last mile, found when the host's first `up` was refused.

## What changes, and why

The tunnel unit's first start on the host failed: `sending serve config: 401 Unauthorized: must be root, or be an operator and able to run 'sudo tailscale' to serve a path or Unix socket`. Read from tailscale v1.102.4: `ipn/localapi/serve.go` rejects any POSTed serve config for which `HasPathHandler()` holds, and the CLI always POSTs the whole config, so the node's existing file-path mount of the trace pages (8443) makes EVERY non-root change fail, not just this one.

So the unit cannot be what mounts the path on this host, and a root-mounted path (persisted by tailscaled) would still leave the unit `failed` at every login. `event-tunnel.ts`:
- `pathIsServed(status, mount)`: the loopback port is proxied at the funnel path AND `AllowFunnel` is true for that host:443 (a tailnet-only proxy is not exposed).
- `changeFunnel`: `up` and `down` read `tailscale serve status --json` (works without root) and do nothing when the path is already as asked; otherwise they run the one scoped command, read again, and throw if the state is not the one asked for. A refused `down` no longer leaves a unit `inactive` over a path that is still public.

Not done here, and not claimed: a non-root session still cannot mount or remove the path while the trace pages are a file-path handler. That is a host decision filed separately (proxy mount for the trace pages, or a sudoers rule that lists `tailscale` for the operator).

## Platform first, deleting first

platform: checked `tailscale serve status --json` (it is the platform's own read, used as is) and tailscale's own `--yes`/idempotent flags: none skips the POST of an unchanged config, so the read has to come first.

Net lines: +41 non-test, -6 (about 35 net in `src/event-tunnel.ts`). Removing could not do it: the alternative is a unit that fails at every login against a correct mount.

## How you verified it

- `AGENT_ORG_HOST=<flagged host.json> npx rstest run --config scripts/rstest/rstest.config.ts src/event-tunnel.test.ts`: 18 passed (16 before, 2 added).
- Also `src/no-loader.test.ts` and the three `src/packaging/host-units*.test.ts`/`host-project-paths.test.ts`: 201 passed in 4 files.
- `pnpm run typecheck`: clean.
- Mutations, each restored byte-identical (`diff` against a copy) and only its own test red: `AllowFunnel` ignored (1 red, the `pathIsServed` test); read-first off, so `up` always runs (1 red, the `changeFunnel` test); read-first always skips (1 red); read-after removed (1 red); wrong host key (2 red, both read it).

Acceptance: `env -u AGENT_ORG_HOST npx rstest run --config scripts/rstest/rstest.config.ts src/event-tunnel.test.ts`

## Anything a reviewer should be sceptical of

- The shape of `tailscale serve status --json` for a LIVE Funnel mount is from Tailscale's documented output, not read from this node: nothing is mounted yet, so `AllowFunnel`/`Web` keys could not be observed live. If the real shape differs, `up` never reads "already served" and runs the command as before, which fails the way it did before, so the failure is loud and no worse than today. The live read is the first thing the row's proof does after the root mount.
- `down` still needs root while a file-path handler is in the config; it now says so rather than being silent.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
