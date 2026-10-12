`src/packaging/org-health.test.ts`'s gate-as-a-process no longer reads the live githubstatus.com (agent-org#1178). Test file only; no source is touched.

**Cause, read from the log (run 38248349829) and re-read now.** `gateAsAProcess()` stubbed `gh` and `journalctl` but the gate it spawns starts a child `node -e` (`startGithubStatus()`, called with no URL by `work-gate.ts`) that fetches `https://www.githubstatus.com/api/v2/summary.json`. While GitHub reports an incident the gate emits the `org-health` / `github-incident` order and the assertion, which filtered out only `flag-without-a-switch`, saw it. The status reader has no URL or file seam the test can reach (its defaults are constants and the file name carries a per-tick token), and the row's Region is this one file, so the seam is the child's environment: the test writes a `--import` preload that replaces `globalThis.fetch`, and hands it to the gate through `NODE_OPTIONS`, which the status worker inherits.

**What changed.**
- `gateAsAProcess(status)` takes `"operational"` (default) or `"incident"` and answers the status call with a summary of that state.
- The existing test now also asserts `github-status: operational` on stderr, so it fails if the stub did not reach the gate (a stub that never fires is a check that never runs).
- A sibling test feeds the gate an incident and asserts `GITHUB INCIDENT:` on stderr and that the one `org-health` order left is `github-incident`, keyed `ceo/org-health/github-incident/stubincident01`: a real incident IS offered.

Mutation, each run and restored with `cp` and `diff`, byte-identical:
- first test fed `gateAsAProcess("incident")` (the failure the row names, made deterministic): 1 red, the new `github-status: operational` control (`ℹ pass 33`, `ℹ fail 1`);
- `NODE_OPTIONS: nodeOptions` dropped from the gate's env, so the live page is read (GitHub's incident 93njd414rpbx was still unresolved at the time of the run): 2 red, the first test (`actual: ...GITHUB INCIDENT: Incident with Actions, Pull Requests and Issues...`, `expected: /github-status: operational/`) and the sibling (`ℹ pass 32`, `ℹ fail 2`). This is the original defect reproduced from the unmodified assertion.

Measured: the acceptance command below, `ℹ tests 34`, `ℹ pass 34`, `ℹ fail 0`, with the stub answering operational in the first test and incident in the second, i.e. both states pass; `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/org-health.test.ts` `VERDICT pass: 34 tests in 1 file`; `npx tsc --noEmit -p tsconfig.json` exit 0.

Not done, and said so: `outcome-clock.test.ts`, `outcome-clock-feed.test.ts`, `repeating-lines.test.ts`, `reviewer-auth-detector.test.ts` and `disk-headroom.test.ts` also spawn the gate with no status stub. They did not fail on run 38248349829 (only this test did), so this row does not touch them; a follow-up row would share the preload.

Acceptance:
```bash
node --import=./src/lib/crash-exit.ts --test src/packaging/org-health.test.ts
```

no-release: one test file only; nothing a pinned project runs changes

Closes a11ign/agent-org#1178
Closes a11ign/a11ign#5228

platform: n/a (the status reader's own `fetch` is the platform's; the test replaces it at its edge and builds no new machinery)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
