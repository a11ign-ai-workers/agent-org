The reopened clauses of a11ign/a11ign#5125. (1) The re-queue of an ejected pull request was asked of a pull request with NO holder (a11ign#5115's shape): the test is added and PASSES at `origin/main` as well as at this head, because `requeueEjected` never read a holder; the premise "`work-gate.ts` returns false for a PR with no holder" was not found on this path (what keeps a pull request out is a `hold:*` label, `armabilityOf`, which is not the absence of a holder). (2) A row closed under an open half of itself is now said once to `product-manager`, naming the half: `rowsClosedUnderOpenHalf` (pure, over lists the tick already holds) and `closedUnderHalfOrders` in `src/work-gate.ts`, behind the flag `rows.closedUnderOpenHalf`, default OFF.

Acceptance:

```bash
bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-ejected-requeue.test.ts'
```

Closes a11ign/a11ign#5125

Flag: rows.closedUnderOpenHalf
Health-signals: wakes-held, approved-unqueued
Revert: turn the flag `rows.closedUnderOpenHalf` off in `machinery-canary.json`; off reads and writes nothing and makes no order.

Measured: the command above printed `VERDICT pass: 16 tests in 1 file` at this head (12 before this change; this adds the #5115-shape case, two cases for the closed-under-half detector and its order, and one for the order's subject being the repository KEY, which reviewer-agent-org-1060 asked for at `6260c9a8`). `npx tsc --noEmit -p tsconfig.json` exited 0. The suites `src/work-gate*`, `src/packaging/gh-call*` and `src/packaging/work-gate*` printed `VERDICT fail: 1 of 1160 tests failed in 62 files`; the one is `work-gate-other-scopes-concurrent.test.ts`, which printed `VERDICT fail: 1 of 11 tests failed` on a detached worktree at `origin/main` 43c6d8a4 as well, so it is this environment's. `gh-call-ratchet.test.ts` passes: no `gh` call site was added (`src/work-gate.ts` stays at 39 against its baseline of 39).

Mutation: each run against this head and restored from a copy (byte-identical, checked with `diff`), each broke only its own case: (M1) the detector never finds -- 2 red; (M2) the open list is ignored -- 1 red, the "row is open" control; (M3) a refused list is read as empty -- 1 red, the control; (M4) the record is forgotten -- 1 red, the once-per-half case; (M5) the record is never pruned -- 1 red; (M6) the flag is ignored -- 1 red, the flag-off case; (M7) a draft counts as a half -- 1 red; (M8) the order's subject is spelled from the repository's basename instead of the half's key -- 2 red, the keyed-repository case (`layer` for `acme/other`, `layer2` for `elsewhere/other`) and the primary's `pr-5115` case. The #5115-shape case in clause (1) has no mutation: no code was changed for it, and it is a pin, not a fix.

Outside-Region: none. `.changeset/` and `.acceptance/` are exempt.

Not done, and why:
(a) THE RE-QUEUE IS DORMANT ON THIS HOST, and that, not a missing holder, is what left #5115 unqueued after 19:14. Measured 2026-10-11 from the host's state file: `~/.cache/a11ign/machinery-canary.json` reads `"flags": {}`, so `queue.reenqueueEjected` (#1029, merged 19:13:58Z) has never been ON, and `requeueEjected` returns before reading anything. Before that, #5115 carried a `hold:` label from 17:05 to 18:53 (`armabilityOf` keeps a held pull request out of `shouldBeMerging`, by design), and the newest merge group was green from 17:51 on (read from `actions/runs?event=merge_group`). Nothing in this tree writes a flag on: `withMachineryFlag` has callers only in tests. Turning `queue.reenqueueEjected` and `rows.closedUnderOpenHalf` on is the owner's decision and is routed on the row; Done-when 3 (a live reading) cannot be taken until it is.
(b) A ROW IS NOT KEPT OPEN, it is said once. The platform closes the row at the merge, and reopening is not one of the ticket port's four operations (ADR 0046) nor a `gh` call site `src/work-gate.ts` may add (`docs/gh-call-baseline.json` only goes down). `pr-open` already refuses the front door (agent-org#923). The clean form is a port operation that reopens, a `ceo` ruling.
(c) Absence is not proof: a tracker whose open list was refused, or came back at its `--limit` of 500, says nothing about a row missing from it, so a row beyond the first 500 open rows is never said. A pull request whose `Closes` is a bare `#n` is read as its own repository's row, as GitHub reads it.

platform: GitHub's own native close-on-merge is what closes the row, and it cannot be told to wait; `closedRowsOf` (`merge-guard.ts`) is the one parser of a body's `Closes` list, imported and not retyped.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
