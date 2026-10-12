Closes a11ign/agent-org#1240

## What changed

Behind one machinery flag, `gate.graphqlPacing` (a named record in `machinery-canary.json`, default OFF; switched by `machinery:flag`, and the canary turns it off if a named signal degrades; off = the current behaviour).

- **Pacing (`src/work-gate/pacing.ts`, `pacingNow`).** The gate reads the GraphQL pool off the probe it already makes (`GRAPHQL_POOL_PROBE`, `poolFromHeaders`). Below `GRAPHQL_RESERVE` = **1000** points it is paced. A probe that cannot be read is NOT paced: its reads then refuse on their own and are reported as they are (fail-open, deliberate).
- **Skip order.** A paced tick skips `orgHealth` and the other repositories' lanes (`otherScopes`). It never skips the primary's claims or wakes. `main` reports every skipped lane through `unreadLanes` (`pacedUnread`), so a skip is unread, never clean. The tick exits PARTIAL with the skipped lanes named.
- **Webhook event gating (`otherScopesToRead`, `scopesToRead`).** Flag on AND `host.json` `events.source == "webhook"`, the other repositories are read only where the event queue names their code or tracker repository, or where their last whole read is older than `GRAPHQL_SWEEP_MINUTES` = **15**. A missing or malformed event file (`null`) reads them all; `[]` (nothing named) reads only the repositories due a sweep. Last-read times live in `other-scopes-memory.json` and are stamped only from real reads in `main` (`rememberOtherScopesRead`), never from the first-wave rehearsal.
- **Poll mode** is unchanged: the event gate is not applied, and the pacing skip is the only change.
- **No second GitHub App.** Nothing here adds an App or a token.
- **Pool read once per process** (`tickPacing`): `readOtherScopes` and `main` share one probe. Test runs (`isAmbientRun` false) never probe and never read the state directory.

Assumptions (named, not measured): the reserve of 1000 points and the 15-minute sweep. Both are constants in `pacing.ts`.

## Not done (open)

- Primary `readLanes` / `readOpenRows` are NOT event-gated. The primary's `readPrs` already narrows through `pr-list-memory`.
- `orgHealth` is skipped only below the reserve, not event-gated: `org-health.ts` is outside this row's Region.
- **Paced-tick B4 caveat.** With other repositories skipped, the B4 comparison and the other-scope claims run against the primary only. This is reported (the tick is PARTIAL with the lanes named), not silent.
- `main` is now 127 lines (was 124). The source comment says "its 90-line limit"; no test enforces a limit and the structure tests pass, but the comment's figure is stale.

## Timings and health readings (not produced here)

The ceo's health readings one clock hour after the flag is on (blind ticks per day = 0, refusals per hour = 0, GraphQL points per hour under 3,500) cannot be produced in this environment. They are not claimed here.

## Acceptance

```
node --test src/packaging/gate-graphql-pacing.test.ts
```

12/12 pass. Each rule has a red control in its test. The structure tests that pin the gate's text also pass: `node --test src/packaging/gate-b4-repo-scope.test.ts src/packaging/work-gate.test.ts src/work-gate-lane-reads.test.ts src/work-gate-one-wave.test.ts` = 441/441. `pnpm run typecheck` exits 0.

## Full suite (`pnpm test`): four failures, pre-existing

11,006 tests, 4 failing. All four also fail on a clean `git archive HEAD` export of this branch's base, run with the same `node_modules`:

- `src/packaging/host-install-agent-org-launcher.test.ts` ("an absent launcher ...") and `src/packaging/live-tree-independence.test.ts` (two "#3233" tests): they depend on the a11ign checkout and its commits, not on this change.
- `src/packaging/release-tag-on-merge.test.ts` ("the call names pnpm and changesets ..."): expects no lockfile; `pnpm-lock.yaml` is tracked.

## Machinery

Flag: gate.graphqlPacing
Health-signals: blind-ticks, claims-refused, wakes-held
Revert: `agent-org machinery:flag off gate.graphqlPacing` (the canary also turns it off on a degraded signal); reverting this PR also removes the code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
