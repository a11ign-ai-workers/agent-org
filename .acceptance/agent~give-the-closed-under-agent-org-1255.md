The closed-under-open-half order has its own cause (a11ign/agent-org#1255, agent-org#1060). It was `ready-row-unclaimable`, which means a refused claim; it is now `row-closed-under-open-half`, declared as a JUDGMENT cause beside its neighbours. `ready-row-unclaimable` is unchanged.

Acceptance:

```bash
node --test src/packaging/work-gate-ejected-requeue.test.ts
```

Closes a11ign/agent-org#1255

Revert: restore `cause: "ready-row-unclaimable"` in `src/work-gate/causes/rows-closed-under-half.ts` and drop the declaration; the order returns to the old cause, and nothing else reads the new one.

Measured: the Acceptance printed `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0` at this head. Before this change the same file printed 16 of 16. `npm run typecheck` exited 0. `node --test` over `project-roles`, `work-gate`, `work-gate-engineer-order-paths`, `work-gate-ejected-requeue`, `worker-profile` printed `ℹ pass 488`, `ℹ fail 0`. The full `npm test` printed `VERDICT fail: 4 of 11056 tests failed in 654 files`: `host-config`'s launcher test, `live-tree-independence`'s #3233 cases, and `release-tag-on-merge`'s lockfile case. None of the three files reaches a changed module through its imports, and `pnpm-lock.yaml` is tracked at HEAD, which the lockfile case forbids; those failures are not from this diff, and I did not rerun them on a pristine base.

Mutation: the cause in `rows-closed-under-half.ts` was swapped back to `ready-row-unclaimable` and the Acceptance file run: `ℹ pass 16`, `ℹ fail 1`. The file was restored from a copy and `diff` showed it byte-identical.

Outside-Region: the row's Region names `src/work-gate.ts` and the Acceptance file, but since #5152 the order lives in `src/work-gate/causes/rows-closed-under-half.ts`, and a cause's group and profile live in `src/cause-declaration.ts`, which the `CAUSES` and `PROFILES` lists are computed from. Changed outside the Region, for that reason: `src/cause-declaration.ts`, `src/work-gate/causes/rows-closed-under-half.ts`, `src/packaging/project-roles.test.ts` (the recorded lists and the count of 46 tool causes), and `src/packaging/work-gate.test.ts` (the FINISH list). `.changeset/` and `.acceptance/` are exempt. `src/work-gate.ts` is unchanged, and its re-export hub already names the order's module.

Not done, and why:
(a) The row's Open-check greps `src/work-gate.ts`, which now holds 0 matches by design: the order's module is the one that changed.
(b) The keep-open behaviour in the row's Change item 2 is not implemented: the order is still a notice said once per (row, half), because reopening a row is not a ticket-port operation (ADR 0046). The notice stays and this paragraph says so.
(c) The cause key stays `product-manager/closed-under-half/...`, so a notice already recorded is not said again after the change.

platform: not applicable; this is a declaration and a string.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
