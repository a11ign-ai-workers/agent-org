Org health wakes `ceo` when an open build incident has stood four hours on mixed Windows builds (signal `fleet-build-mixed-over-4h`, agent-org#943).

Closes a11ign/agent-org#943: the row's Done-when is met here (Acceptance passes, the PR names the wake, the tests make no GitHub calls). The production gate call site is NOT in this PR, so the wake does not fire in production until it lands; that is the follow-up below, to be filed as its own row.

## What changes, and why

- **The signal.** `fleetBuildMixedReading({ now, incident })` trips when an OPEN incident issue has stood `FLEET_BUILD_MIXED_HOURS` (4) hours or more. `firstTrippedAt` is its creation plus 4 h, and the discriminator is `fleet-build-mixed-over-4h@<oldest over-bound issue number>`. Its detail names up to five incidents with their box count (from the title) and age.
- **The fact.** `readFleetBuildIncidents(run, repo)` is ONE REST call (`GET repos/<repo>/issues`, `state=open`, `labels=incident`, `per_page=100`). It keeps an issue whose body carries `Incident: incident:fleet-build-mixed` on a line of its own, and drops pull requests. A refused or unparseable list is `null`.
- **The wake.** `orgHealthReadings` takes `facts.fleetBuildIncident`; when it is given, the reading is pushed beside `releaseRuns`. The prompt map entry sends the order to `ceo`, and says that the fleet, not a hand close, clears the incident.
- **The three answers are kept apart.** No open incident, or one under four hours: `clear`. A refused read: `unknown`, never `clear`. An incident with no creation time, and no other over-bound one: `unknown`.
- **The contract constants** `FLEET_BUILD_INCIDENT_LINE` and `FLEET_BUILD_MIXED_HOURS` are copied here from the filing row. The test pins the copy.

## How you verified it

Run in the worktree (`/home/agent/repos/wt-agent-org-943`). The row's Acceptance names `~/repos/agent-org`, the primary checkout, which does not contain this test file until it merges.

- `node_modules/.bin/rstest run --config scripts/rstest/rstest.config.ts src/org-health-fleet-build.test.ts src/org-health-release-failed.test.ts`: 24 of 24 pass (11 new, 13 the release-failed signal, unchanged).
- The POSITIVE CONTROL (an incident open 4 h 30 min trips, with the number, box count, age and `firstTrippedAt`) and the NEGATIVE CONTROL (3 h 50 min and no incident both clear) are in `src/org-health-fleet-build.test.ts`. The tests use a fake `run` and no GitHub calls.
- `node_modules/.bin/tsc --noEmit -p tsconfig.json`: exit 0.

Mutations, each run by `sed` on a copy of `src/org-health.ts`, the file run, and the file restored with `cp` and checked with `diff`:

| Mutation | Result |
| --- | --- |
| never trip | 6 fail, the POSITIVE CONTROL among them |
| always trip | 2 fail, the NEGATIVE CONTROL and the oldest-discriminator test |
| bound of 5 h | 5 fail, the constant pin and the POSITIVE CONTROL among them |
| refused list read as clear | 2 fail, the unknown tests |

## Anything a reviewer should be sceptical of

- **The signal does not fire in production from this PR.** `src/work-gate.ts` and `src/work-gate/org-health.ts` are outside the row's Region, and they are where `readReleaseRuns` is called and passed as `facts.releaseRuns`. A follow-up must pass `readFleetBuildIncidents(defaultRun, "a11ign/a11ign")` as `facts.fleetBuildIncident`, and count that call in the gate's read inventory. Nothing here changes what the gate reads.
- **Two checks are red on this branch, and both come from the new `gh` call site in `src/org-health.ts`.** Both files are outside the Region, so they are not edited here:
  1. `src/packaging/gh-call-ratchet.test.ts`: `src/org-health.ts` has 6 calls against a baseline of 5 in `docs/gh-call-baseline.json`. The ratchet's message says to go through the ticket or code-host port, and not to raise the baseline.
  2. `src/packaging/gh-call-inventory.test.ts`: `docs/gh-call-inventory.json` is stale. It needs regenerating with `node --import tsx src/packaging/gh-call-inventory.ts`, which the environment here cannot run (no `tsx`).
- **`src/work-gate/org-health-suppression.test.ts` is red**: `fleet-build-mixed-over-4h` is missing from `ORG_HEALTH_CLASSES` in `src/work-gate/org-health-suppression.ts`. The one-line fix is `"fleet-build-mixed-over-4h": PAGE,`, outside the Region.
- `src/packaging/live-tree-independence.test.ts` (3 tests) fails because `tsx` is not installed in this checkout. It is not related to this change.
- Lint: the repository has no lint script or config that I could find, so none was run.

Acceptance: `node_modules/.bin/rstest run --config scripts/rstest/rstest.config.ts src/org-health-fleet-build.test.ts` (in the worktree; the row's `~/repos/agent-org` path does not hold the file until merge).

Outside-Region: none edited. The three files named above are where the follow-ups go.

platform: n/a (no GitHub, pnpm, systemd or git feature; the tests use a fake `gh`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
