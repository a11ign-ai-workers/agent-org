A merged pull request whose none-valued `Closes` line has a reason that names its own claimed row closes that row as built and files the verify row for what it left (a11ign/agent-org#750). **The instance:** a11ign/agent-org#716's body gave `Closes` the value `none` with the reason `the row's Done-when 2 (tell a11ign#4623 the fix is in force, ...) can only be true after this merges`; GitHub resolved no closing reference, row #560 stayed open and claimed, and was closed by hand 2026-10-10 19:58:54Z (#475, the same shape, at 20:10:24Z; its leftover went to #748).

**Change 1, why `verify-row.ts` did not run for #712 (row #475) and #716 (row #560): two decisions, both measured.**
1. *No close-out pass ran for either.* agent-org's own CI has no close-out job, and the host's two sweeps that bracket the merges (runs 38078317928 at 19:04:09Z listing `4876 4872`, and 38079979426 at 19:29:09Z listing `4876 4872 4870 4868`) list only a11ign/a11ign pull requests; the deciding line is the one they print for those, `SWEEP: #4876 declared NO closing references.`, and neither run lists #712 or #716 at all. Obtained by reading the two runs' logs.
2. *Had one run, it would have filed nothing.* `planVerifyRow` returns `null` with `declined: []` for the bodies of rows #560 and #475: their leftover item is neither `future-time`, `live-check`, `seat-act` nor `row-outcome`, so "it fired correctly and found nothing to read" was true of the classifier and false of the row. Obtained by running `planVerifyRow` on both rows' bodies as fetched with `gh api repos/a11ign/agent-org/issues/<n>` (the scratchpad's `measure.ts`).

**What changes.**
- *`closesNoneOwnRow`* reads a line that starts with `Closes`, a colon and the word `none`, with a reason, that names (as `#N` or `owner/repo#N`, a bare number being the PR's own repository's) the row the branch ends in: the three together, never one. `planClosesNone` then reads that row and weighs it with the existing `closurePlan`: open and unclaimed is `unclaimed` and left, unreadable is named and fails, reopened after the merge is skipped, closed is `already`.
- *Both paths take it* when GitHub resolved nothing and the body lists no `Closes #N`: the dispatch path (`close-rows-for-merged-pr.ts` `main`) and the sweep (`close-rows-sweep.ts` `closeOnePr`, the one `trunk.yml` runs on every push). The sweep does not gain the #2822 body fallback.
- *`planLeftoverVerifyRow` / `fileLeftoverVerifyRow`* (`verify-row.ts`): the verify row carries the Done-when items the reason cites, else the reason; `blockedBy: null`; `Not-before:` only from a placed `future-time` item; the same marker as a reading row, so a second merge finds it. `VerifyPlan.blockedBy` and `.notBefore` become nullable and `filePlan` skips the edge when there is none.

**Mutation (four, each red in the tests it should be and no other, each restore byte-identical: copy in the scratchpad and `diff`):** the reason's naming not required (3 red: `docs only`, another row, the line/reason/branch case); `planClosesNone` never planning (5 red: both positives and the three negatives whose controls need it); the existing marker ignored (1 red: merged twice); an unclaimed row closed anyway (1 red).

**Evidence:** the Acceptance below, 25 of 25 (the ten new in `close-rows-for-merged-pr-closes-none.test.ts` and `verify-row.test.ts`'s original 15). `close-rows-sweep`, `packaging/close-rows-sweep` and `close-rows-full-form` 31 of 31 unchanged. `tsc --noEmit` reports only the two `mjs-ratchet.test.ts` errors `main` has. `docs/gh-call-inventory.json` regenerated (the sweep's second `api graphql`) and its test passes. Not run: `eslint` (no config in this repository's checkout) and the whole suite; `packaging/live-tree-independence.test.ts` fails here on `board-liveness | walk-scope.ts` (a file this change does not touch).

Not done: nothing runs a close-out for a11ign/agent-org's own merges (the host's `trunk.yml` and `nightly.yml` sweep a11ign/a11ign); that is the host's file and a token decision, filed as its own row, not in this diff.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import tsx --test src/close-rows-for-merged-pr-closes-none.test.ts src/verify-row.test.ts`

Outside-Region: src/close-rows-sweep.ts — the path `trunk.yml` runs on every push; a #719 lesson is that a change to the dispatch path alone is filed for no normal merge.
Outside-Region: docs/gh-call-inventory.json — the committed inventory of `gh` call shapes; the sweep's one new `api graphql` read is in it, regenerated with the generator.

platform: n/a (no GitHub, pnpm, systemd or git feature beyond `gh api graphql` and `gh issue close`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
