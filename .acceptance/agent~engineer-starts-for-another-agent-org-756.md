Engineer starts for another tracker's rows reach the model router (a11ign/agent-org#756, a11ign/a11ign#4627). `routesForStarts` kept only orders `rowOfOrder` names, which is `null` for a keyed row, so 32 of 75 `worker-agent-org-<n>` starts took the ordinary `sonnet/high` and left no `model-routing` line (measured by worker-4882 for a11ign#4882, 13:00Z to 19:50Z).

**What changes.**
- `routesForStarts` routes a keyed order (`ready-row-unclaimed/agent-org#<n>`) too. The row is read from THAT tracker (`readRowForTier(row, key)` resolves the repository from the declaration) and the route is filed under `agent-org#<n>`; the first tracker's rows stay under the bare number, so every existing reader of the map is unchanged.
- The ledger id of a keyed row is `row-agent-org-<n>`, so it cannot collide with a11ign's `row-<n>`. The id is built in one place now (`idOf`, `engineer-route.ts`).
- `tierOfRow` looks the route up by the same key. A keyed row that cannot be read or routed is absent and takes the ordinary profile, as before; a keyed row with no route is still not read for the first tracker's `tier:haiku` label (that row would be another one).

**Evidence** (measured, with `AGENT_ORG_HOST` set to the a11y-witness `host.json`): `src/engineer-route.test.ts` 54 of 54 (51 before, three new: a keyed order routed from its own tracker and logged `row-agent-org-756`; an a11ign row and an agent-org row of number 659 are two routes with two ids and neither takes the other's; an unreadable keyed row is absent and a keyed row with no route gets the ordinary profile with the first tracker's row 756 still reading its own label). `wake*`, `route-*`, `multi-board*` and `engineer*` test files: 406 of 406 in 26 files. `tsc --noEmit` reports only the `@a11ign/toolchain` module and implicit-any errors this worktree's linked `node_modules` gives on a clean `origin/main` too. `rstest --changed=origin/main` fails 19 tests in 6 packaging files, and the same files fail 19 of 72 on a clean `origin/main` in a second worktree.

**Not done here, as the row says:** the live reading (the share of `worker-agent-org-<n>` starts with a `model-routing` line, from the work-tick journal and `~/.cache/a11ign/decisions`) is Done-when 2, its own VERIFY row filed when this merges. Not changed: `route-outcome.ts` and `route-accuracy.ts` read only `row-<n>` ids, so a keyed row's outcome is not yet joined to its route (they skip a keyed id, as they skipped it before it existed); `escalatedRoutes` still keys an `escalation` line by its bare `row`.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/engineer-route.test.ts`

Closes a11ign/agent-org#756

Mutation: two, each restore diffed byte-identical (copy in the scratchpad, `cp` back, `diff`): `routesForStarts` dropping keyed orders again (2 red: the keyed-row case and the collision case); the ledger id made the bare number (2 red: the same two).

Outside-Region: src/engineer-route.ts — the ledger id `row-<n>` is built there (`routeEngineer` and `routeOnly`), so a keyed id needs the key on `RouteRow` and one `idOf`.
Outside-Region: src/engineer-escalation.test.ts — its helper types the routes map `ReadonlyMap<number, Routed>`, which `escalatedRoutes` no longer returns once the map may carry a keyed key (`tsc` red otherwise).

platform: n/a (a lookup key and a repository argument to `gh issue view`; no GitHub, pnpm, systemd or git feature does it)
