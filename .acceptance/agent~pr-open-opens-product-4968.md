`pr:open create` opens every pull request READY and armed unless the author passes `--draft`; the product-PR draft step is no longer the default (a11ign/a11ign#4968).

Closes a11ign/a11ign#4968

## What changes, and why

- **`pr-open.ts` never adds `--draft`, so a create without it is armed at creation by `armAfterCreate`**, as docs-and-tests PRs already were. The behaviour was already there; what changes is the stated rule (the `armAfterCreate` comment no longer says a product PR opens as a draft, #912) and that it is now pinned by tests. Nothing else in the code moved.
- **Outside this Region, not done here:** the sentence "A product PR opens as a DRAFT" in a11ign's `.claude/rules/org-routing-and-timers.md` and `docs/operational-lessons.md`, and the engineer brief, are in the a11ign repository. They are named on the row for `product-manager`.

## How you verified it

Acceptance runs from this worktree, because the row's literal `cd ~/repos/agent-org` is the primary checkout and does not hold this change.

Done-when 1: three new `#4968` tests in `src/pr-open.test.ts`: a create without `--draft` sends no `--draft` and `pr merge --auto --merge <head>` follows; an explicit `--draft` is passed through and nothing follows; `edit` never arms.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/pr-open.test.ts`

Mutation: source restored with `cp` each time. (a) `armAfterCreate` without the `--draft` check: 1 of 9 fail. (b) without the `mode !== "create"` check: 2 of 9 fail. (c) `armAfterCreate` always `[]`: 3 of 9 fail. Baseline 6 of 6; after, 9 of 9.

## Anything a reviewer should be sceptical of

- Done-when 2 (the 24h verify row) is a separate row and is not met by this PR.
- Lint and `verify` were not run in this worktree, whose `node_modules` is linked from the primary checkout.
