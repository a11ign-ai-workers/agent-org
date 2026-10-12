A review order for a keyed repository's pull request names the reviewer's role file by its absolute path under the project root (`HOME_CHECKOUT`), so the reviewer finds it from its own review checkout instead of searching the home directory (a11ign/agent-org#1142). The project's own pull requests keep the relative `.agent-org/roles/reviewer.md`, which is correct there.

**What changes.**
- `src/work-gate/pr-orders.ts`: `awaitingVerdictPrompt` names the role file through `reviewerRoleFile(pr)`. A pull request with a non-empty `repoKey` gets `join(HOME_CHECKOUT, ".agent-org/roles/reviewer.md")`; the primary project's keeps the relative literal. The only other code mention of the path is a comment in `orders.ts`, so no other order carries it.
- `src/packaging/reviewer-order-role-path.test.ts` (new): builds the real order through `perPullRequestOrders` for a keyed pull request and asserts the absolute path is in the prompt, is absolute, and exists under the project root; the control is the project's own pull request, which keeps the relative path.

Acceptance: `bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/reviewer-order-role-path.test.ts'`

Mutation: the keyed check made always false (the keyed test fails, the control passes) and always true (the control fails, the keyed test passes); each restore is byte-identical, proven by `diff` against a copy in the scratchpad.

Evidence: the acceptance run gives `VERDICT pass: 2 tests in 1 file`, exit 0; `tsc --noEmit -p tsconfig.json` exits 0. The full `pnpm test` gives `4 of 10753 tests failed in 3 files` (host-install-agent-org-launcher, live-tree-independence ×2, release-tag-on-merge). The same three files with `origin/main`'s `pr-orders.ts` give `4 of 15 tests failed in 3 files`, so those failures predate this change. This package has no lint script, so lint was not run.
