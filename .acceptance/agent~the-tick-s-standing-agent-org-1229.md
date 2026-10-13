The tick creates its standing record row on the boarding path (a11ign#5275). `createTickRecordRow` in `src/work-tick.ts` files it with `lane:ceo`, `backlog` and `out-of-release` (the labels `row-file` writes for a Backlog row), so the gate's `settleOffBoardRows` boards it at Backlog and `rowOffBoardOrders` sends nothing; the off-board check is unchanged, so an ordinary bare-created row is still flagged.

Acceptance:

```bash
node --test src/work-gate/tick-record-row.test.ts
```

Closes #1229

Measured: the command above printed `pass 2, fail 0` at this head. Mutation (labels reduced to `lane:ceo`, restored byte-identical): the boarding test fails and the positive control still passes. `pnpm run typecheck` is clean; `work-tick-health`, `work-tick` and `gh-call-ratchet` tests pass (41). This repository has no `lint` or `verify` script.

Done-when 1: the tick creates the row through the boarding labels (the first of the two seams), not an exemption. Done-when 3, read now: `gh issue view 5275 -R a11ign/a11ign --json labels,projectItems` printed labels `backlog, out-of-release, lane:ceo` and 1 project item, so it is boarded.

platform: the gate's existing `settleOffBoardRows` (#490) boards by label; nothing new built, 2 lines of labels added.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
