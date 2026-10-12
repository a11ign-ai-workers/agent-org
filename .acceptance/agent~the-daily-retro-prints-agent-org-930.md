The daily retro prints the circular waits the gate found and how long each stood (a11ign/a11ign#5009's summary has no reader). `deadlockSummary` exists on main (agent-org#928) and nothing in the retro called it.

**What changes.** `org-retro.ts` calls `deadlockSummary` on the record the retro already parses for the top blocker, and prints one line directly beneath `- Top blocker:`: `- Circular waits: N found (K broken, longest M minutes; J standing)`. The longest is taken over the standing and the broken cycles together. A readable record with no cycle prints `- Circular waits: 0 found`; a record that was not read or does not parse prints `- Circular waits: unknown (blocking-impact.json could not be read, ...)`, the same reading `blockingLines` gives the top blocker.

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-930 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/org-retro-deadlocks.test.ts src/blocking-impact.test.ts'`

The row's own command cds to `~/repos/agent-org`, the main checkout, which does not carry this change; the command above runs the same two files in the worktree where the change is.

Closes: a11ign/agent-org#930

Mutation: two mutations of `org-retro.ts`, each restored from a copy with `cmp` proving the restore byte-identical. Taking the longest over the broken cycles only fails 1 of 7 (the headline test). Reading an unreadable record as `found: 0` fails 1 of 7 (the `unknown` test). The file was restored after each.

**Evidence**, measured at this head. Before the change the new test file fails 7 of 7. After it, the Acceptance command passes 33 of 33 in two files. `src/org-retro*` passes 35 of 35 in five files. `tsc --noEmit -p tsconfig.json` exits 0. The full `npm test` reports 5 of 10679 tests failed in 619 files: `live-tree-independence` (2), `release-tag-on-merge`, `work-gate-other-scopes-concurrent` and `worker-stop-hook`. The same five fail identically with `org-retro.ts` at HEAD, and none of those four files imports `org-retro.ts`.

**Not verified here**: Done-when 2, that the next daily pass prints the line. That runs on the gate's schedule and cannot be run from this session.

platform: `deadlockSummary` (agent-org#928) is reused; no new cycle reader is written.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
