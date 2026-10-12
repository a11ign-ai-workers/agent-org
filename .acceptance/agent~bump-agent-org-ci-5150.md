`PROJECT_REF` in `.github/workflows/ci.yml` moves from `eaebb69cd37fa053b78e2fee2fe152a545fe8ae7` to `54947391eb36ccf84ff7365e6530f13d180980de` (a11ign/a11ign `main`, the #5144 merge, 2026-10-11T21:07Z), and the same pull request carries the two copies' comment lines and one test line that the pin needs, because neither goes green alone (product-manager's ruling, a11ign/a11ign#5150 comment 6114449078 and 6115740886): at the old pin `copies-drifted` is clear and at the new one it trips until `src/lib/cli-flags.ts` and `src/lib/git-env.ts` follow `cc4dd7e09`, and at any merge-commit pin `closes-mismatch-check`'s CLI subtests die on an ENOENT unless `runCheck` runs in its scratch directory.

- `.github/workflows/ci.yml`: the pin line, and the lead-in comment above it, which names the commit the suite was last run against.
- `src/lib/cli-flags.ts`, `src/lib/git-env.ts`: the copies' header and comment lines as the originals stand at `cc4dd7e09` (the content of agent-org#1055's commit `1f7d0802`, a11ign/agent-org#1049), and nothing else; `.changeset/copies-follow-cc4dd7e09.md` is that change's changeset.
- `src/packaging/closes-mismatch-check.test.ts`: `cwd: dir` on `runCheck`'s `spawnSync`, so the check reads the PR's added `.acceptance/` files from the scratch directory, not from the tool's directory in the project.
- Files: those, and this one. Outside the row's Region (`.github/workflows/ci.yml`) are the four after the first; each is under its own `Outside-Region:` line in the pull request body.

Acceptance:

```bash
git grep -qE "^  PROJECT_REF: 54947391eb36ccf84ff7365e6530f13d180980de$" -- .github/workflows/ci.yml
```

This is the row's command (`git show origin/main:.github/workflows/ci.yml | grep -q <sha>`, run from `~/repos/agent-org`) turned to read the PR's own tree, because CI's acceptance job runs before the merge and the row's form reads `origin/main`, so it exits 1 until the merge and 0 after (run at the base it printed exit 1, the Open-check's FALSE side). The row's form is the post-merge reading and stays the done-when's.

Measured: the command above printed exit 0 at this head, and exit 1 at the base `1924bdb9` (`git grep` of the same pattern at `origin/main`); the old full sha `eaebb69cd37fa053b78e2fee2fe152a545fe8ae7` appears 0 times in the file now and 1 time before.

How the rest was read:
- a11ign `54947391e` is a11ign/a11ign `main` at the time of writing (`git rev-parse origin/main` in the a11ign worktree), committed 2026-10-11T21:07:04Z.
- The row asks for a green a11ign gate at that commit. Read from the commit's check-runs (`gh api repos/a11ign/a11ign/commits/<sha>/check-runs`): `trunkGate` and `trunkBuildTest / run` are `success`. Two other runs on that sha are `failure` and are not the gate: `e2e` (workflow `auth0-e2e`, "the repository secret AUTH0_DOMAIN is not set") and `install` (workflow `registry-consumer-gate`, `[duplicate-copy] @a11ign/evidence`, a published-package reading); both are `workflow_run` watchers that read the registry or a secret, not the tree at the sha.
- `node --test src/ci-pins-the-project.test.ts`: 3 pass, 0 fail (the pin is a full 40-character sha and the checkout reads it).
- No other open agent-org PR or unmerged `agent/*` branch carries a newer `PROJECT_REF` (each of the nine that touch `ci.yml` holds `main` or an older sha).

The second Done-when line (agent-org#1055's `suite` passing on its re-run) is this pull request's own `suite`, since #1055's content is carried here and #1055 is closed as superseded.

Suite, read in CI's layout (a11ign `54947391e` laid with the lab, this tool at `packages/agent-org`, run from the project root, `AGENT_ORG_HOST` unset): at the old head `1948a188` CI's `suite` failed 7 (4 `org-health-queued-lab-jobs` and 2 `wait-condition` = `copies-drifted`; 1 `tmp-fixtures-are-removed` LIVE, which spawns the 7 `closes-mismatch-check` CLI subtests). At this head, on a merge of `main`, the full run is 13 failed of 10394 and none of the 7 is among them. Eleven of the 13 are this host's own ledger leaking in (`claim-refusal-storm`, 77 refusals read from the host, gh 502s); the same 8 files rerun with an empty `HOME`, as on a runner, fail 2, both in `live-tree-independence` with `Cannot find module 'tsx/package.json'`, which is this scratch layout's install (the test is green in CI's own run 38178483999 at the old head). The `closes-mismatch-check` file alone: 24 pass 7 fail before the `cwd` line, 31 pass 0 fail after.

Mutation: the `cwd: dir` line is the guard-side repair. Without it the 7 CLI subtests fail at this pin (24 pass, 7 fail, read above), and with it they pass, which is the mutation read both ways. The copies' lines carry no guard of their own: `copies-drifted` is the guard, and its tripped and clear readings are the 6 tests above before and none after.

Closes: a11ign/agent-org#1049
Closes: a11ign/a11ign#5156
Closes: a11ign/a11ign#5150

platform: nothing in GitHub, pnpm or git moves a commit pin; `ci-pins-the-project.test.ts` holds it to a full sha, and `ci.yml` itself says a bump is its own pull request.
