A red check's class is read from its failing assertions, behind `CI_CLASS.assertionsOnly`, shipped OFF. With the flag ON, `readCiFailure` reads the rate-limit and lost-runner text from the failing assertion lines when one is named, and from the whole log when none is. A passing test that prints "rate limit" or "502" beside a real assertion failure is now `own-defect`, routed to `owner`; a runner lost before any assertion ran stays `infrastructure`. With the flag OFF the classifier is unchanged.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --test src/ci-failure-class-assertions.test.ts`

Measured: `pass 5, fail 0` for the acceptance file (node 24, native TS). Mutations: each of four breaks at least one test, and `src/ci-failure-class.ts` was restored byte-identical each time (`diff` against a copy). Regression: `src/ci-failure-class.test.ts` and `src/wake-ci-class-review-depth.test.ts` pass with the three files together, 47 of 47. `pnpm run typecheck` exits 0.

On HEAD's classifier the acceptance file does not load (`does not provide an export named 'CI_CLASS'`), so the "fails before the change" evidence is a load error, not an assertion failure.

Not here, and named: the same-head dedupe of the owner order is keyed `pr-checks-failing/pr-<n>/<head8>` in `src/wake.ts` (`RED_CHECK_KEY`), outside this Region; a same-head re-fail is likely deduplicated there. `pnpm test` shows five failures in four packaging files (`host-install-agent-org-launcher`, `live-tree-independence`, `org-health`, `release-tag-on-merge`); they fail identically with HEAD's classifier restored, so they are not caused by this change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
