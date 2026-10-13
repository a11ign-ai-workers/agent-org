The reviewer reviews with a `row-review` skill (Spec item table, Tests and correctness, Standards). It is shipped as `skills/row-review/`, installed by `host:install`, named by `host:check`, and named in the reviewer's order only behind `review.rowReviewSkill` (agent-org#1268). It is proven by `scripts/review-eval.ts`, a re-runnable eval on the blind-labelled set.

Acceptance:

```bash
bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/review-eval.test.ts && node scripts/review-eval.ts --set blind-2026-10-12 --require 9/11'
```

Closes a11ign/agent-org#1268

Flag: `review.rowReviewSkill`, OFF by default (`agent-org machinery:flag on review.rowReviewSkill --session=<you>`; the switch row is a11ign/a11ign#5325). Off, the order names no skill.
Revert: `agent-org machinery:flag off review.rowReviewSkill --session=<you>`, or revert this PR; the installed skill is read by nothing until an order names it.

Eval (gpt-5.6-luna, effort medium, `--jobs 4`, nothing posted), the run that this head's SKILL.md produced:

```
row-review eval (gpt-5.6-luna, effort medium)
AGREE    agent-org#1243         blind: not convinced reviewer: not convinced
AGREE    agent-org#1138         blind: not convinced reviewer: not convinced
AGREE    agent-org#1060         blind: not convinced reviewer: not convinced
AGREE    agent-org#1211         blind: not convinced reviewer: not convinced
AGREE    agent-org#1057         blind: not convinced reviewer: not convinced
DISAGREE agent-org#1068         blind: convinced     reviewer: not convinced
AGREE    agent-org#1063         blind: convinced     reviewer: convinced
AGREE    agent-org#1100         blind: convinced     reviewer: convinced
AGREE    agent-org#1149         blind: convinced     reviewer: convinced
AGREE    agent-org#1078         blind: convinced     reviewer: convinced
DISAGREE a11ign#5289            blind: convinced     reviewer: not convinced
agreement 9/11 (not convinced 5/5), required 9/11 with every not-convinced agreeing
PASS
```

A second run of the same head: 9/11, not convinced 5/5, PASS; the disagreements were agent-org#1068 and agent-org#1149 (a11ign#5289 agreed). The first run, before the three SKILL.md clarifications below, was 8/11 with all five `not convinced` agreeing (FAIL): agent-org#1068, #1100 and #1078 were refused. Across the three runs the five `not convinced` agreed 15 of 15; the six `convinced` are the ones that move, #1068 refused in every run.

What the eval run measured, and what it did not: the reviewer is `codex exec` in a read-only sandbox in a depth-1 checkout of the head, handed the pull request, the row and the diff as files, with the skill installed under `.agents/skills/`. It does not run the Acceptance command and cannot post. A reading that fails (a pull request, a row, a diff, a checkout, a reply with no verdict) counts as a disagreement, never a skip.

Measured: `src/review-eval.test.ts` and the packaging tests for the skill's install, check and order; `npm run typecheck` exits 0. The full `pnpm test` printed `VERDICT fail: 4 of 11105 tests failed in 659 files` after the fixes below: `host-install-agent-org-launcher`'s launcher test, `live-tree-independence`'s two #3233 cases and `release-tag-on-merge`'s lockfile case, which fail the same way on `4e9bed32` (a detached checkout of main, run for this).

Mutation (each restored from a copy and compared byte-identical): `hostUnitDrift` without `...rowReviewSkillDrift(deps)` failed the wiring test (1 of 182); `host:install` without `rowReviewSkillInstall()` failed its test (1 of 182); `decide` handing `rowReviewSkill: false` failed the order test (1 of 7); the flag always on failed 2 of 7; the flag ignoring the canary state failed 1 of 7; `verdictOf` reading `not convinced` as `convinced` failed 7 of 23; `score` forgetting that every `not convinced` must agree failed 2 of 23.

Outside-Region: `src/work-gate/tick.ts`: `decide` reads the flag where orders are decided and hands it to `perPullRequestOrders` (`rowReviewSkillFlagOn`), which the row's `pr-orders.ts` alone cannot do.
Outside-Region: `src/machinery-flag.ts`: `review.rowReviewSkill` must be in `FLAG_REGISTRY` or `machinery:flag on` refuses it.
Outside-Region: `src/flag-switch-ledger.ts`: its ledger test requires every registered flag to have a declared switch, and this one's is a11ign/a11ign#5325.
Outside-Region: `package.json`: the `files` list ships `skills/`, which `host:install` copies from.
Outside-Region: `src/packaging/host-units.test.ts`: the install and check tests for the skill, and `identityHost` pins the skill's directory as it pins the door's, so two #2184 tests do not read the real host's `~/.codex`.
Outside-Region: `src/packaging/row-review-skill-order.test.ts`: the flag-off and flag-on orders and `decide`'s reading, kept out of the host-units file because its fixture project declares no `roles` for the order module to read.
Outside-Region: `src/packaging/machinery-flag-switch.test.ts`: the recorded registry now has ten flags.
Outside-Region: `src/packaging/multi-board-gate.test.ts`: the recorded prompt hashes of the three reviewer orders change by exactly the removed sentence (166 to 154 and 180 to 168 bytes).
Outside-Region: `src/packaging/project-config.test.ts`: `review-eval.ts` is declared as a file that names the repositories, because the labelled set is recorded pull requests of two named repositories.

Not done, and why:
(a) The flag is not turned on. The switch is a11ign/a11ign#5325, and the row's Done-when 4 is "merged flag-off".
(b) The eval is 9/11 at the threshold, and the six `convinced` move between runs. #1068 is refused every time because its Done-when asks for an injected spawn that records the environment and its PR says the spawn is not injectable; the skill now says a recipe-shaped item is met by the same boundary through the seam the code has, and the reviewer still judges that one partial. I did not tune the skill further against one pull request.

platform: not applicable; this is a skill file, an installer entry and an order sentence behind a flag.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
