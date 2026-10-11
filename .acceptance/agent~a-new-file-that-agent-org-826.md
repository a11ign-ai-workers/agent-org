A new non-test file that calls `gh` outside `src/ticket-port/`, or a baselined file that gains a call site, now fails a named test, and the files that call it today are a baseline that cannot grow. This is the whole of a11ign/agent-org#826 (Phase 0b of a11ign/a11ign#4505).

Closes a11ign/agent-org#826

## What changes, and why

- **`docs/gh-call-baseline.json`** (new): for each file in `buildInventory(judgedRoot())` that is not under `src/ticket-port/`, `{ spawns, calls }`, `calls` being the sum of its shape counts. Written once from the inventory of the tree this merges into (`1a682ec2`). **95 entries, 136 spawns, 389 calls.** The row said 94 at `0aa5fc33`; the 95th is `src/route-guard.ts` (spawns 1, calls 2), which #820 merged after the row was filed. The first write at `c399b1e7` was 94 entries, 135 spawns, 387 calls, and merging `main` into the branch reproduces the queue's red with exactly that file (the run's own log could not be read, so this is inferred from the reproduction, not read from it): the ratchet reported it as a new file, as it should. It is today's tree, so it is baselined; it is the only entry the second write added or moved. The inventory lists 96 files, and the one under the port is `src/ticket-port/github-adapter.ts`.
- **`src/packaging/gh-call-ratchet.test.ts`** (new): reports, by file name and both numbers, a file of a fresh inventory that is outside the port with no entry, or above its entry in `spawns` or `calls`. The failure says where new code goes (the ticket port or the code-host port, ADR 0046). `src/ticket-port/` is exempt by path. A count below its entry and a file that is gone are not reported, which the header states and two cases assert. The header names ADR 0046's ruling (item 4 / decision 5) as the rule held, and why a failing check was chosen over a filed row.
- **A merge with `main` after the queue's ejection** (`aa42c4b6`) added `src/route-guard.ts` to the baseline and nothing else.
- **`.changeset/a-new-gh-call-outside-the-ticket-port-fails-826.md`**: a patch.

`gh-call-inventory.ts` and `docs/gh-call-inventory.json` are not touched.

## Cases (all in the one file)

The committed baseline admits today's tree (with positive controls: more than 90 baseline entries and more than 90 inventory files outside the port); the adapter is in the real inventory and not in the baseline; a new file spawning the command is reported by name; a baselined file gaining a call site is reported with both numbers; either number rising alone is reported (a shape beside an existing spawn, and a spawn with its arguments built elsewhere); the same new file under `src/ticket-port/` is not; a fallen count and a vanished file are not; a test file is not counted.

## How you verified it

Measured on this host, at this head. This worktree holds no `.agent-org/project.json` and no `node_modules`, so I ran with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json` and a `node_modules` of per-entry links to `a11y-witness`'s. The Acceptance is the row's command without its `cd ~/repos/agent-org`: that path is `main`, which carries this change only after the merge.

- The Acceptance (the two files): all pass (`VERDICT pass: 15 tests in 2 files`, re-run after the merge with `main`).
- End to end on the real tree: a throwaway `src/zz-new-gh-caller.ts` that spawns the command turned the first case red with `src/zz-new-gh-caller.ts: a new file that calls the tracker's CLI (spawns 1, calls 1) and has no entry in docs/gh-call-baseline.json` and the where-it-goes line; removed, green.
- `src/packaging`, the whole directory: 32 of 4961 fail, in 8 files that do not mention these. Those 8 files fail the same 26 tests with this change moved out of the tree and with it in (the failing sets are identical), so they are this host's, not this change's.
- `tsc --noEmit`: no error in the new file; 4 errors elsewhere in `src/`, none of them in files this touches.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/gh-call-ratchet.test.ts src/packaging/gh-call-inventory.test.ts`

Mutation: the check never fires -> 5 red (the four negative controls and the port case), the real-tree case stays green; fires on equality (`>=`) -> 5 red (the real-tree case, the new-file case, the port case, the shrink door, the test-file case); `calls` ignored -> 1 red (the either-number-alone case); `spawns` ignored -> the same 1; the port exemption removed -> 2 red (the real-tree case, which then flags the adapter, and the port case); a fall also refused (`!==`) -> 1 red (the shrink door). Each file restored from a copy taken before and `diff`ed byte-identical.
