Closes a11ign/agent-org#1253

## What changed

Fixes three defects that PR agent-org#1243 (`gate.graphqlPacing`) left before the flag is switched on. The flag stays OFF; nothing here turns it on.

- **A repository an event gate drops is reported unread.** `unreadScopes` (`src/work-gate/reads.ts`) names each declared repository that `scopesToRead` left out, with its reason ("no event named it, and it was read less than 15 minutes ago"). `main` adds those reports to `unreadLanes` as a skip, so the tick says the lanes were not read. Before, an event-gated repository was dropped silently, and an unread lane read as clean.
- **The primary's tracker lanes and `orgHealth` obey the event gate.** On a flag-on webhook tick, `readLanes` (the primary's promotable, chairman-blocked and open rows) and `orgHealth` run only when the event queue names the home repository or the home's sweep is due (`primaryDue`, keyed by the home's declaration key `""`). Otherwise both are skipped as refused nulls (`primaryLanes`, `orgHealthSkipped`), and the skip is reported unread (`primaryUnread`). `rememberOtherScopesRead` stamps the home key only when its lanes were answered.
- **Tests drive the gate with a webhook tick.** `src/packaging/gate-graphql-pacing.test.ts` writes a real `tick-scopes.json` and a real `other-scopes-memory.json`, and asserts the reported unread scopes and the skipped reads. No test matches source text.

Reading of "the three spans": `readLanes` (the primary's tracker lanes), `orgHealth`, and `otherScopes` (the other repositories' lanes). `otherScopes` is not its own `endGateSpan`: it is read inside the `readLanes` span by `readLanesAfterOutageCheck`. The first two are gated by the primary's rule above; `otherScopes` is gated by `otherScopesToRead`, which already applied the event gate in agent-org#1243 and now also reports what it drops.

## Not done (open)

- **Operational risk on a flag-ON webhook tick.** A tick that names neither the home repository nor a due sweep skips the primary's tracker lanes and `orgHealth`. Claims, wakes and stall checks then depend on the 15-minute sweep to be read. The tick exits PARTIAL on every such tick, with the skipped lanes named. This is the cost of the event gate, and it is why the flag stays OFF. The ceo should read the health signals (blind ticks, claims refused) for an hour before switching it on.
- The health readings one clock hour after the flag is on cannot be produced in this environment. They are not claimed here.

## Acceptance

```
node --test src/packaging/gate-graphql-pacing.test.ts
```

16/16 pass. Each rule has a red control in its test: the same tick with the flag OFF reads everything and reports nothing; a tick with the home repository named reads the primary; a tick with the home not named skips it and reports both lanes.

Mutation checks, each run and restored byte-identical: (1) primary always due, which fails the primary-skip tests; (2) `unreadScopes` returns nothing, which fails the unread-report tests; (3) the event gate ignores the flag, which fails the flag-OFF controls. Each produced 2 failures.

`grep -c 'unreadScopes' src/work-gate/reads.ts` = 1 (≥ 1).

`pnpm run typecheck` exits 0.

## Full suite (`pnpm test`): six failures, pre-existing

11,016 tests in 650 files, 6 failing. All six also fail on a clean checkout of HEAD (the four files were run with the four changed files restored to HEAD, and the log shows `ℹ pass 14`, `ℹ fail 6`):

- `src/packaging/host-install-agent-org-launcher.test.ts` ("3. an absent launcher ..."), and `src/packaging/live-tree-independence.test.ts` (two "#3233" tests): they depend on the a11ign checkout, not on this change.
- `src/packaging/release-tag-on-merge.test.ts` ("the call names pnpm and changesets ..."): expects no lockfile.
- `src/row-claim-refusal-record.test.ts` (two tests: "a refused claim leaves exactly one claim-refused line" and "an unwritable ledger is said on stderr"): the second asserts exit code 1 and gets 2. The cause was not investigated; the failure is the same on clean HEAD.

No lint script exists in `package.json` (scripts are `typecheck`, `test`, and the messaging and chairman commands).

## Outside the Region

These paths belong in this PR; each is named here with its reason.

Outside-Region: src/work-gate/pacing.ts — the pure pacing module (the reserve, the sweep, the read-times memory, the flag read, and `primaryUnread` / `orgHealthSkipped`). The row's rules are here, and the Region names the gate's entry and reads, not the module they call.

## Machinery

Flag: gate.graphqlPacing
Health-signals: blind-ticks, claims-refused, wakes-held
Revert: `agent-org machinery:flag off gate.graphqlPacing` (the canary also turns it off on a degraded signal); reverting this PR also removes the code.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
