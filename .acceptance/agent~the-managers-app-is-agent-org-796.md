The managers App is recognised where a reader decides by the owner's login: the review-only-lane refusal, the pipeline CODEOWNERS cause and `pr:open`'s login read (a11ign/agent-org#796, follow-up of a11ign#4911).

Closes a11ign/agent-org#796

## What changes, and why

- **`src/lane-ownership.ts`**: `MANAGERS_APP_LOGINS` names the App in its three spellings (`a11ign-managers[bot]`, `a11ign-managers`, `app/a11ign-managers`) and `ROLE_LOGIN.ceo` is `a11ign-ai-leads` plus those. At `origin/main` the third was missing (measured: `[true,true,true,false]` for the row's four logins). `ownsReviewOnlyLane` also resolves `app:<role>`, the ledger's spelling, through `APP_ROLE_LANE_OWNER`.
- **`src/work-gate.ts`** (Done-when 2, `ceo`'s ruling on the row, 2026-10-11T11:35Z): `ownerHasReviewed` counts a review as the owner's when its author is `a11ign-ai-leads`, OR is one of `MANAGERS_APP_LOGINS` AND the body's LAST `decided-by` marker (`claim-stall.ts`'s `decidedBy`, the line `host/gh` appends) is `ceo`. The login alone does not clear it: the App is shared by `ceo`, `product-manager` and `orchestrator`. The head rule is unchanged (APPROVED or CHANGES_REQUESTED at the current head). **Authorship is not extended**: `pr.author?.login !== login` still compares with `a11ign-ai-leads` alone, so a PR the App authored fires the cause. GitHub will not take the App's approval of its own PR, so on that PR only `a11ign-ai-leads`'s own review settles it, which is a person's; the row comment brings this back to `ceo` as the ruling asks, and nothing here chooses.
- **`src/pr-open.ts`** (Done-when 3): `loginThrough(gh, role)` reads `gh api user`, then the GraphQL `viewer` (#811), then, when both fail and `AGENT_ORG_GH_ROLE` names a role `APP_ROLE_LANE_OWNER` declares, answers `app:<role>`. A `managers` role is then refused by the lane check ("Ruling item 7") and `workers` is not; no role, or a role the wrapper does not declare, still refuses "could not say who is opening it". The role is passed by `defaultLogin`, never read inside `loginThrough`, so a test's environment cannot reach it.
- **`src/reviewer/pr-review-verdict.sh`**: a comment at the `gh api user` read says what the door does when it is refused (`undetermined`, exit 4, nothing posted) and why no second read stands in for it.

## How you verified it

Done-when 1: the row's Acceptance, run as written, exits 0 (it exited 1 at `origin/main`). Done-when 2: `src/packaging/work-gate.test.ts` `#796 (a)`..`(f)`. Done-when 3: `src/packaging/pipeline-lane-authorship.test.ts` `#796 (1)`..`(5)`.

Acceptance: cd /home/agent/repos/agent-org && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node -e 'import("./src/lane-ownership.ts").then(m=>{const l={lanes:[{lane:"p",owner:"ceo",branchPrefixes:[],paths:[".github/workflows/"],why:"",reviewOnly:true}]}; if(["a11ign-ai-leads","a11ign-managers[bot]","a11ign-managers","app/a11ign-managers"].some(a=>!m.ownsReviewOnlyLane(a,l)))process.exit(1)})' && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/pipeline-lane-authorship.test.ts src/packaging/work-gate.test.ts src/pr-open.test.ts

Mutation: six, each restored with `cp` and `diff`ed byte-identical, run over `pipeline-lane-authorship.test.ts` and `work-gate.test.ts` (465 tests, all green unmutated). (1) the marker ignored, so the App's login alone clears the cause: 2 fail. (2) the App never counting: 3 fail. (3) the `AGENT_ORG_GH_ROLE` read removed from `loginThrough`: 1 fails. (4) any role string accepted, not only a declared one: 1 fails. (5) `app/a11ign-managers` dropped from `MANAGERS_APP_LOGINS`: 2 fail. (6) `app:<role>` not resolved by `ownsReviewOnlyLane`: 2 fail.

Outside-Region: src/packaging/pipeline-lane-authorship.test.ts — the `#796 (1)`..`(5)` tests for the lane predicate and `loginThrough`'s role read
Outside-Region: src/packaging/work-gate.test.ts — the `#796 (a)`..`(f)` tests for `pipelineCodeownerReviewMissing`
Outside-Region: src/reviewer/pr-review-verdict.sh — Done-when 3 names its `gh api user` read: a comment saying what it does when the call is refused

## Anything a reviewer should be sceptical of

- **`app:managers` is one login for three seats.** A `product-manager` or `orchestrator` session whose reads all fail and whose `AGENT_ORG_GH_ROLE=managers` is refused a workflow PR as `ceo` would be, the same as when the viewer answers `a11ign-managers[bot]` (#816). That is the population #816 ruled, not a new one.
- **`AGENT_ORG_GH_ROLE` is only the caller's declaration.** It is the same variable `host/gh` routes the token by, so it names the App `gh pr create` authors as; where it is unset (the workspace decides) the role read does not apply and an unreadable identity refuses as before.
- **Not run here:** `pnpm run verify` and `pnpm run lint` (this worktree's `node_modules` is the rstest/typescript subset; `npx tsc --noEmit -p tsconfig.json` exits 0 at this head, measured). CI's `gate` is the verdict for those.
