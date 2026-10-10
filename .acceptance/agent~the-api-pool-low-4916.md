`api-pool-low`'s Spender sentence names an App's calls: a `[bot]` pool is read from the `app:<role>` ledger lines, in every ledger the role writes to (a11ign#4916).

Closes a11ign#4916

## What changes, and why

- **`ledgerAccountOf(login, appRoles)`** (`src/gh-ledger.ts`): an ordinary login is its own ledger account; `<slug>[bot]` is `app:<role>` for the declared `github-apps` role the slug names; a `[bot]` login no declared role owns is `null`. `spenderPhraseFor` answers for it, and `spenderPhrase` (one ledger, ordinary account) is a thin wrapper, so its callers and tests are unchanged.
- **`ledgerSpender`** (`src/org-health.ts`) reads the ledger of this process's own config directory AND the workers', leads' and reviewer's (`ledgerPathsOf`), each distinct file once. A directory that does not exist is not a ledger of this host; one that exists with no `gh-calls.tsv` has had no calls.
- **"No graphql point is recorded" is said only when every ledger named was read.** An unread one reads `UNREADABLE`, naming it; an unowned `[bot]` login reads `UNREADABLE`, never "nobody".

## How you verified it

Acceptance below runs from the repository root: the row's literal command `cd /home/agent/repos/agent-org && …` runs the primary checkout, which does not hold this change.

Done-when 1: `src/org-health-app-spender.test.ts` (positive: `app:scheduler` lines + an `a11ign-scheduler[bot]` pool name `work-tick.ts` through the real `poolLowReading` default; negatives: the lines under an unowned role read "no graphql point" only when the leads ledger was read too, and `UNREADABLE` when it was not; an unowned `[bot]` login reads `UNREADABLE`; workers + leads lines summed once). Done-when 2 is the next `api-pool-low` for an App pool, the claimant's to quote.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/org-health-app-spender.test.ts src/gh-ledger.test.ts`

Mutation: six mutants, each killed by named tests of `org-health-app-spender.test.ts` and no other file: the login never mapped to `app:<role>` (3 fail), an unowned `[bot]` read as an ordinary account (1), ledger paths not deduped (1), an unread ledger never recorded (1), "none recorded" never said (1); a mutant that broke the template literal failed every file at load and is not counted. Source restored with `cp` and `diff`ed identical. The 11 files that fail in this worktree's full run fail identically on `origin/main` (35 of 315 there, 34 here), measured in `agent-org-wt-4899`.

## Anything a reviewer should be sceptical of

- **The declaration holds no App slug**, only `appId`, `keyPath` and `installationId` (`src/host-config.ts`), so "the role whose declared App has that slug" cannot be read literally. `ledgerAccountOf` matches the slug to the role by name (`a11ign-scheduler` is `scheduler`'s). A slug that ends in no declared role reads `UNREADABLE`, which is the safe side. Declaring a `slug` in `github.identity` would replace the convention and is outside this row's Region (`host-config.ts`).
- **The reviewer directory is derived** (`<home>/reviewer/gh`) because `wake.ts` imports `org-health.ts`; the test pins it to `REVIEWER_GH_CONFIG_DIR`.
