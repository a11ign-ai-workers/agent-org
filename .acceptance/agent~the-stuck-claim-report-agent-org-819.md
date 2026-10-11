The stuck-claim report reads a keyed row's own worktree `wt-<key>-<n>`, so agent-org#724's existing tree is seen and `product-manager` is told after 15 ticks (agent-org#819).

## What changes, and why

- `claimRefusalOf` resolved `wt-<number>` for every row; a keyed row is claimed into `wt-<key>-<number>` (`claimNames`), so the reading was always `null` and the streak never started. It now builds the name from `row.repoKey`; an unkeyed row keeps `wt-<number>`.
- `work-gate.ts` cannot import `row-claim.ts` (a cycle), so the name is a pinned copy: a test compares the directory and the refusal's words with `claimNames` and `worktreeTargetReason`, keyed and unkeyed.

## How you verified it

Run with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json`; this worktree has no `tsx`, so `node --test` (type stripping) ran it. 4 of 4 pass: keyed `wt-agent-org-724` stamped is REFUSED naming `worker-agent-org-724`; the same keyed row with only `wt-724` is NOT; unkeyed rows unchanged; the name and words equal row-claim's. `work-gate-engineer-order-paths.test.ts` 16 of 16.

Mutation: the name made `wt-<number>` again: 3 of 4 fail. Source restored with `cp`.

Not done here: Done-when 2 (the live `ready-row-unclaimable` count for agent-org#724) needs the change deployed. The `kept` map is still keyed by the bare number, so a keyed row can read an unkeyed row's kept record; not changed (not in this row's text).

Acceptance: `node --import tsx --test src/work-gate-claim-refusal-keyed.test.ts`

Closes a11ign/agent-org#819
