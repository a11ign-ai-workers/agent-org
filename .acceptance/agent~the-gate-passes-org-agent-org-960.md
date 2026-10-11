The gate passes `orgHealthNow` its fleet build incident, so the 4-hour wake agent-org#943 built can fire (agent-org#960, part of a11ign/a11ign#4405). `orgHealthNow` takes `readFleetBuildIncident` beside `readReleaseRuns`, `undefined` when the caller does not ask (every test), and spreads `fleetBuildIncidentFact(...)` into its facts; the gate's call site passes `() => readFleetBuildIncidents(defaultRun, repoNow())`, and the per-tick call list names the read (the one REST call already lives in the ticket port, so `docs/gh-call-baseline.json` does not move).

Acceptance: `bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/work-gate/org-health-fleet-build-fact.test.ts src/packaging/gh-call-ratchet.test.ts src/packaging/gh-call-inventory.test.ts'`

Mutation: five, each run by hand with the file copied aside and diffed byte-identical after: the `fleetBuildIncidentFact` spread dropped (POSITIVE CONTROL red, 2 of 4); the fact always `[]` (2 of 4 red); `null` read as `[]` (the unknown test red, 1 of 4); "does not ask" read as a refused read (the silence assertion red, 1 of 4); the argument dropped at the gate's call site (the wiring test red, 1 of 4). Run against `src/work-gate/org-health-fleet-build-fact.test.ts`; the reverse direction (the remedy applied) is the same file at 4 of 4 green.

Measured: acceptance command `VERDICT pass: 19 tests in 3 files`; `npx tsc --noEmit -p tsconfig.json` exits 0; the whole `npx rstest run` gives `5 of 9821 tests failed in 550 files`, and those same 5 (`live-tree-independence`, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`) fail identically on the base commit `617dbb36` in a clean detached worktree, so they are not this change's. There is no `lint` or `verify` script in this repository's `package.json`.

Closes: a11ign/agent-org#960

Outside-Region: src/packaging/work-gate.test.ts — the six pins of `GH_READS.unconditional.length` move 13 to 14, which is what the row's Sweep line requires land in this one pull request.

platform: n/a (no GitHub, pnpm, systemd or git feature replaces a read the gate's per-tick list already counts)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
