The `gh` wrapper no longer hands a reviewer the workers App's token: an explicit `GH_CONFIG_DIR` that is neither the workers' nor the leads' directory gets no app role (agent-org#817, parent a11ign#4924).

Closes a11ign/agent-org#817

Class: wrapper-role-by-fallthrough — any explicit `GH_CONFIG_DIR` the wrapper was not taught (the reviewer's, a unit's own) read as `workers` because the role's last branch was `else`; guard: `src/app-token.test.ts` pins that a third directory receives no app token and no `app:` ledger account, and that `AGENT_ORG_GH_ROLE` still wins.

## What changes, and why

`app_role()` in `host/gh` read `AGENT_ORG_GH_ROLE`, then the workspace id, then `GH_CONFIG_DIR = $LEADS_DIR/gh` (`managers`), and everything else was `workers`. A reviewer session sets `GH_CONFIG_DIR` to its own `a11ign-bot` account on purpose, but the block that exports `GH_TOKEN` then gave it the workers App's token, which `gh` prefers to `hosts.yml`: the reviewer was the author of the PR it reviewed and GitHub refused the approval (nine PRs at `REVIEW_REQUIRED`).

- **`app_role()`** names a role only when the config is the role's own: after `AGENT_ORG_GH_ROLE`, a `GH_CONFIG_DIR` that is not `$WORKERS_DIR/gh` or `$LEADS_DIR/gh` prints no role. A call with `GH_CONFIG_DIR` unset was given one of those two by the routing above, so it behaves as today; a spawned worker sets the workers' directory and stays `workers`.
- **The caller** takes an empty role as "no app" explicitly (`[ -n "$app_who" ]`), not by a pattern that happens not to match.
- **`AGENT_ORG_GH_ROLE`**, when a caller declares it, still wins (unchanged, pinned by the second new test).
- **Header comment** states the rule where the role is described.

One consequence to know: a unit that sets a `GH_CONFIG_DIR` of its OWN with no workspace id used to read as `scheduler` and now reads as no app. The row names "a unit's own" explicitly; a unit that wants an app declares `AGENT_ORG_GH_ROLE`. A unit pointing at the workers' directory is unchanged (pinned).

Platform first: this is the routing the header's rule 1 already states ("an explicit `GH_CONFIG_DIR` always wins"); the App block was the one place it did not. Net lines: about +10 non-test (the comment is most of it); nothing existing could be removed.

## How you verified it

Positive control, run FIRST against the unchanged wrapper (the two new tests added, `host/gh` as on `main`): the third call, a reviewer-like directory, received the workers token.

```
✖ #817: an explicit GH_CONFIG_DIR that is neither the workers' nor the leads' gets NO app: a reviewer acts as its own account
  AssertionError [ERR_ASSERTION]: a reviewer given the workers' token is the author of the PR it reviews, and GitHub refuses its approval
  + actual - expected
  + 'ghs_workers'
  - 'none'
✖ #817: `AGENT_ORG_GH_ROLE` still wins over a config of its own, and a unit's own config with no workspace is no app either
  AssertionError [ERR_ASSERTION]: no workspace and a directory of its own: the account the directory names
  + 'ghs_scheduler'
  - 'none'
ℹ tests 22   ℹ pass 20   ℹ fail 2
```

The first test's two control calls (workers' directory gets `ghs_workers`, leads' gets `ghs_managers`) passed in the red run, so the red is the third call alone and not a dead app. After the change: `ℹ tests 22   ℹ pass 22   ℹ fail 0`. The other suites that run the wrapper (`app-role-silent`, `org-health-app-spender`, `gh-ledger`, `pr-open-only-creates`, `reviewer-auth-detector`, `wake-reviewer-dead`) pass with `AGENT_ORG_HOST` naming a project declaration: 94 of 94 with `app-token.test.ts`.

Acceptance: `pnpm exec node --import tsx --test src/app-token.test.ts`

## Anything a reviewer should be sceptical of

- **`tsx` is not installed in this worktree** (no `node_modules`), so the Acceptance command exits `ERR_MODULE_NOT_FOUND` here. I ran the same file under `node --test` (Node 24 strips types), which is what the red and green readings above are. The command is the row's, kept verbatim.
- **Nothing here changes the installed wrapper.** `host:install` renders `host/gh` to the host (the host's act, `ceo`'s); until then reviewers still get the workers token. The row's Done-when 2 (`reviewer-agent-org-812` re-prompted and reading `APPROVED`) is after that.
- **This PR's own review will hit the defect it fixes**: its reviewer acts as the workers App through the unfixed wrapper, so a convinced review cannot post as approval. If so, it is said on the PR and the row, and `ceo` posts the approval as `a11ign-bot`.
- **The wrapper's scheduler path for a unit with its own config and no workspace** is the one behaviour change outside the reviewer case; the row asks for it, but I have not enumerated the host's units, so whether any carries such a config is for `host:check` to show.
