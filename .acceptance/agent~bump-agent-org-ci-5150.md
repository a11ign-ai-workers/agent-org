`PROJECT_REF` in `.github/workflows/ci.yml` moves from `eaebb69cd37fa053b78e2fee2fe152a545fe8ae7` to `54947391eb36ccf84ff7365e6530f13d180980de` (a11ign/a11ign `main`, the #5144 merge, 2026-10-11T21:07Z), so `copies-drifted` in the `suite` job compares agent-org's `src/lib/cli-flags.ts` and `src/lib/git-env.ts` against originals at `cc4dd7e09` or later and agent-org#1055 can go green (a11ign/a11ign#5150).

- `.github/workflows/ci.yml`: the pin line, and the lead-in comment above it, which names the commit the suite was last run against and so would otherwise name the old one. Nothing else in the file moves.
- Files: that one, and this one. No `src/` change, so no changeset is asked for.

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

Not done, and where it lives: the second Done-when line (agent-org#1055's `suite` passing on its re-run) can only be read after this merges, and is the gate's reading, not this PR's.

Mutation: none. The change adds no guard; the one test that reads the pin (`ci-pins-the-project`) is unchanged and already pins a full sha both ways.

Closes: a11ign/a11ign#5150

platform: nothing in GitHub, pnpm or git moves a commit pin; `ci-pins-the-project.test.ts` holds it to a full sha, and `ci.yml` itself says a bump is its own pull request.
