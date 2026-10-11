The stuck-claim report reads a keyed row's own worktree `wt-<key>-<n>`, so agent-org#724's existing tree is seen and `product-manager` is told after 15 ticks (agent-org#819).

## What changes, and why

- `claimRefusalOf` resolved `wt-<number>` for every row; a keyed row is claimed into `wt-<key>-<number>` (`claimNames`), so the reading was always `null` and the streak never started. It now builds the name from `row.repoKey`; an unkeyed row keeps `wt-<number>`.
- `work-gate.ts` cannot import `row-claim.ts` (a cycle), so the name is a pinned copy: a test compares the directory and the refusal's words with `claimNames` and `worktreeTargetReason`, keyed and unkeyed.

## How you verified it

Run with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json`; this worktree had no `tsx` (first run was `node --test`, type stripping); the row's literal command then ran with a11y-witness's `tsx` linked into `node_modules`. 4 of 4 pass: keyed `wt-agent-org-724` stamped is REFUSED naming `worker-agent-org-724`; the same keyed row with only `wt-724` is NOT; unkeyed rows unchanged; the name and words equal row-claim's. `work-gate-engineer-order-paths.test.ts` 16 of 16.

Mutation: the name made `wt-<number>` again: 3 of 4 fail. Source restored with `cp`.

Not done here: Done-when 2 (the live `ready-row-unclaimable` count for agent-org#724) needs the change deployed. The `kept` map is still keyed by the bare number, so a keyed row can read an unkeyed row's kept record; not changed (not in this row's text).

Class: a reader that rebuilds a name `row-claim.ts` owns, ignoring the repository key — the `kept` map in the same function is still keyed by the bare row number; guard: the pin test here for the worktree name, nothing yet for `kept` (out of this row's Region, to be filed).

Acceptance: `node --import tsx --test src/work-gate-claim-refusal-keyed.test.ts`

Closes a11ign/agent-org#819
