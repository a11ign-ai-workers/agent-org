`reviewer` is a fourth role in `github.identity`, default `user-accounts`, one-line revert (a11ign/agent-org#955, step 1 of a11ign/a11ign#5044). A host that declares it `github-apps` sends a reviewer instance's `gh` calls out on the reviewer App's installation token; a host that declares nothing, which is every host today, is unchanged byte for byte.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/reviewer-app-role.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/reviewer-app-role.test.ts
bash -c 'cd /home/agent/repos/wt-agent-org-955 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/reviewer-app-role.test.ts src/app-token.test.ts src/wake-reviewer-instance.test.ts src/packaging/keyed-repo-review.test.ts src/packaging/pipeline-lane-authorship.test.ts'
```

Printed `VERDICT pass: 131 tests in 5 files`, exit 0. The row's third command says `cd ~/repos/agent-org`, which is a different checkout (detached at the last release) that does not hold this branch; it is run here in this branch's worktree, as a11ign/agent-org#620's was, with `AGENT_ORG_HOST` set the same way. Nothing else in the command moved.

Mutation:
- Each restored from a copy and `cmp` showed it byte-identical; the counts are what running the five files printed.
- `reviewer` dropped from `GITHUB_ROLES` (`src/app-token.ts`): 6 red, `pipeline-lane-authorship.test.ts :: #816 (3): every App role is accounted for` and five of `reviewer-app-role.test.ts` (the declaration, the typo refusal, POSITIVE CONTROL, the config-alone case, the failed mint). NEGATIVE CONTROL stays green, which is right: with nothing declared the role is not read.
- `app_role` in `host/gh` stops naming `reviewer`: 3 red, all in `reviewer-app-role.test.ts` (POSITIVE CONTROL, the config-alone case, the failed mint). NEGATIVE CONTROL green.
- `app_role` names `reviewer` for ANY config of its own (the #817 fall-through, always firing): 1 red, `the reviewer config alone names no role`.
- `AGENT_ORG_GH_ROLE` removed from `reviewerEnvironment` (`src/wake.ts`): 6 red, `wake-reviewer-instance.test.ts :: #2401 (1b)`, `keyed-repo-review.test.ts :: the primary's instance is byte-identical`, and four of `reviewer-app-role.test.ts`.
- The default flipped to `github-apps` in `readGithub` (`src/host-config.ts`): 5 red, two in `app-token.test.ts` and `reviewer-app-role.test.ts` declaration, NEGATIVE CONTROL and the other-role case.
- `reviewer: null` removed from `APP_ROLE_LANE_OWNER` (`src/lane-ownership.ts`): 2 red, `#816 (3)` and the lane-owner case.

Judgement calls:
- **The wrapper is rendered through `templateValues` and `A11Y_APP_ROLES` is not overridden** in `reviewer-app-role.test.ts`, so the NEGATIVE CONTROL reads what an undeclared host actually renders (`appRoles` empty), and the POSITIVE CONTROL reads what a declared host renders. The role value the wrapper is driven with is `reviewerEnvironment("reviewer-7").AGENT_ORG_GH_ROLE`, not a retyped string, so the wake side and the wrapper cannot drift apart.
- **The reviewer is named only by `AGENT_ORG_GH_ROLE`, never by its config directory** (#817 stands). An instance started without the variable is `a11ign-bot` even on a host that declares the App; the test `the reviewer config alone names no role` pins it.
- **`src/packaging/host-project-paths.test.ts` moves `TODAYS_GH_WRAPPER`** (`a7599e35…` to `a7f56f9c…`). It pins the digest of the rendered wrapper for the recorded a11ign host and every earlier change to `host/gh` has moved it with a dated comment, as this one does. Outside the Region, declared below.

Outside-Region: README.md — the roles table said three roles and `AGENT_ORG_GH_ROLE=scheduler|workers|managers`; it now says four and names `reviewer`.
Outside-Region: src/packaging/host-project-paths.test.ts — `TODAYS_GH_WRAPPER` is the digest of `host/gh` as rendered; the row's own change to `host/gh` moves it, and main would be red otherwise.

Read off the runs, not inferred: `pnpm test` (the whole agent-org suite, 9810 tests in 550 files) printed 5 failures at this tree before the pin moved. Four are on pristine `origin/main` too (`git archive origin/main`, the same four files run: `live-tree-independence.test.ts` x2 needs `tsx` in `node_modules`, `release-tag-on-merge.test.ts` says there is now a `pnpm-lock.yaml`, `work-gate-other-scopes-concurrent.test.ts` counts 14 where 16 are expected); the fifth, `host-project-paths.test.ts`, is the digest above and passes after it moved. `pnpm run typecheck` exit 0. This repository has no `lint` or `verify` script.

What the reviewer App needs on the GitHub side (the chairman's brief; this PR does NOT create the App): Pull requests: Read and write, Contents: Read, Metadata: Read (implicit), installed on every repository the reviewer reviews (`a11ign/a11ign`, `a11ign/agent-org`). One App for the role; never a second App for the same role to get more rate limit (GitHub Terms, Section H). Its slug goes in `host.json`'s `github.identity.reviewer.slug` so the door's `gh api user` is answered `<slug>[bot]`.

Revert: `"mode": "user-accounts"` for `reviewer` in `.agent-org/host.json`, then `agent-org host:install`. Default OFF: no host declares the role, so nothing changes until `.agent-org/host.json` does (the next row).

Closes a11ign/agent-org#955
