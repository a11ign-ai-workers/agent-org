An order the gate typed into a pane can be verified against the gate's own wake ledger with `agent-org order:verify <id>`, and a holder that ignores the same order twice with an unmoved head files ONE incident and wakes `orchestrator`, behind the decision switch `orders-verifiable` (off by default) (a11ign/a11ign#5147). `src/order-verify.ts` is new: `verifyOrder` and `deliveriesIn` read the ledger text the tick already writes (the id `wake:<session>:<epoch ms>` is the header id that `wake.ts` types, and the ledger line carries the same epoch ms and recipient), `repeatedOrdersIn` groups deliveries by (holder, causeKey), and `repeatedOrdersNow` files each repeat through `recordFailures` (which skips a pair already logged, so a repeat wakes `orchestrator` once) and returns the `orchestrator` order. `repeatedOrdersTick` is the gate's entry point, called from `src/work-gate.ts` as one `orders.push(...endGateSpan("repeatedOrders", ...))` line before `deadMansSwitch`. The module has its own `main`, registered as `order:verify` in `src/commands.ts`.

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/order-verify.test.ts
```

Closes a11ign/a11ign#5147

Measured at this head, in this checkout: the command above printed `VERDICT pass: 10 tests in 1 file`. `pnpm run typecheck` exits 0. The targeted set `src/order-verify.test.ts src/packaging/bin-commands.test.ts src/decision-provider.test.ts src/failure-ledger.test.ts src/public-interface.test.ts src/work-gate.test.ts` printed `VERDICT pass: 83 tests in 6 files`, run with a `gh` on PATH that refuses every call (see below).

Mutations, each applied to `src/order-verify.ts`, run, and restored byte-identical (`cmp` against a backup): (1) the verifier accepts any session: "a made-up id does not verify" fails; (2) the verifier ignores the time: the same test fails; (3) the detector counts one delivery as a repeat: the two controls "head moved" and "two holders" and the VOIDED case fail; (4) a VOIDED delivery still counts: the VOIDED verify case and the VOIDED repeat case fail; (5) the repeat key is the session alone, not the causeKey: the switch test, the off test and the two-delivery test fail; (6) the switch is ignored: "the detector is off unless its switch is on" fails; (7) the dedupe is ignored: "switch on ... ONE failure entry" fails.

Real reads, not fixtures: `node --experimental-strip-types src/order-verify.ts wake:worker-5147:1234` printed `NOT VERIFIED ... no delivery with that id in the wake ledger` and exited 1. The id of the last delivery in the real ledger at `~/.cache/a11ign/wake-ledger` (`wake:worker-5147:1791781235385`) printed `verified ... delivered to worker-5147 ... under engineers/ready-row-unclaimed/5147` and exited 0. `repeatedOrdersTick()` read the real (absent) switch file and returned `[]`.

NOT RUN: the full `pnpm test` (`rstest run` over every test). It was stopped after a few minutes because some existing `row-file` tests reach the real tracker through `gh`: their output said "FILED as #900 ... added to Project 1" (#900 is an old merged pull request by another author, so the read-back was wrong, not a new issue) and no new tracker issue was created in that window (the newest issue was #5167, 04:59Z, before the run). The targeted set above was run with a stub `gh` that refuses every call. Lint: this repo has no `lint` script (`pnpm run` lists only `typecheck` and `test`), so no lint was run.

Outside the Region, and why: `src/decision-provider.ts` (`"orders-verifiable"` added to `DECISION_USES`, because a decision switch is the org's only flag mechanism and there is no `orders.*` namespace); `src/commands.ts` (the `order:verify` registry entry, so `agent-org order:verify` resolves). The brief text is in a11ign's `.agent-org/roles/engineer.md` (a separate PR, the other half of the Region).

Not done: (a) health signals (the row names "repeated orders with no head change" and "approved PRs left unqueued for more than 15 min"): only the first has a detector here, and the second is not built. (b) First-contact orders carry no id: the id is added only to follow-up orders in `src/wake.ts` (outside the Region), so `order:verify` says "no delivery with that id" for them and does not claim more. (c) The reviewer and seat briefs are not updated; only the engineer brief is. (d) Done-when 2's live reading (the next conflict wake acted on within one turn) waits for the flag to be turned on and a conflict to happen; it cannot be read before merge. (e) The incident is filed from the failure ledger, so if the ledger refuses the write the orchestrator order is not sent, and the next tick tries again and sends it (the refusal is reported on stderr).

Platform: the wake ledger and the failure ledger are the gate's own state files; nothing new is written by `order:verify` (it reads only).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
