`PROJECT_REF` in `.github/workflows/ci.yml` is advanced by a Renovate regex rule (a11ign/a11ign#5153, item 1; replaces #5151's interim workflow). This is the FIRST of the row's two steps; the second (deleting `project-ref-bump.yml`) is its own pull request, because the row's own order puts it after a live Renovate bump and a bump cannot open before this file is on `main`.

- `renovate.json`: extends `local>a11ign/.github` (OFF until a repository says `enabled: true`, which this does), `enabledManagers: ["custom.regex"]`, `branchPrefix: "bot/"`. One `customManagers` regex reads the `PROJECT_REF` line of `.github/workflows/ci.yml` as `currentDigest`, `datasourceTemplate: git-refs`, `packageNameTemplate: https://github.com/a11ign/a11ign`, `currentValueTemplate: main`. One packageRule gives that dependency `branchTopic: project-ref-bump`, so the pull request opens from `bot/project-ref-bump`, the branch `src/ci-failure-class.ts` (`PIN_BUMP_BRANCH`) reads to class a drift-only red as waiting on the bump (Done-when 3: that file is untouched). The preset's automerge hands it to GitHub's auto-merge, so this repository's own `gate` and the merge queue decide it.
- `.github/workflows/ci.yml`: the lead-in comment above `env:` names the rule instead of "Dependabot cannot read a commit pin" alone, and the one `cp -r` that lays the tool into the project tree gains `renovate.json`, so the new test can read it there (without it that test is an ENOENT in `suite`).
- `src/packaging/renovate-project-ref.test.ts` (new, 4 tests): runs the rule's pattern over the real `ci.yml`, finds exactly the pin `ci-pins-the-project.test.ts` holds, and holds `branchPrefix + branchTopic` to `PIN_BUMP_BRANCH`. It is the guard `project-ref-bump-workflow.test.ts` was for the branch name, kept when that test goes with the workflow.
- `.changeset/renovate-advances-the-project-ref.md` and this file.

Acceptance:

```bash
npx --yes --package renovate renovate-config-validator renovate.json && node --test src/packaging/renovate-project-ref.test.ts
```

Measured at this head (base `58a673fd`):

- `npx --yes --package renovate renovate-config-validator renovate.json` printed `Config validated successfully against 1 file(s)`, exit 0 (renovate 44.151.5).
- `node --test src/packaging/renovate-project-ref.test.ts src/ci-pins-the-project.test.ts`: 7 pass, 0 fail.
- `pnpm run typecheck` exit 0; `node .github/scripts/workflow-paths.ts` ("4 workflows, 16 paths named, all present") and `node .github/scripts/leak-scan.ts` (0 leaks).
- The row's `npx --yes actionlint .github/workflows/ci.yml` CANNOT RUN here and is not in the command above: the npm package `actionlint@2.0.6` is a WASM library with no executable (`npm ERR! could not determine executable to run`, exit 1; the same finding a11ign/agent-org#5151's acceptance recorded). Read through the package's own WASM API instead (installed in the scratchpad): 0 findings on this head's `ci.yml` and 0 on `origin/main`'s; the positive control (a step using `${{ nope.x }}`) is reported as `undefined variable "nope"`.
- The rule run by Renovate itself, `renovate --platform=local --dry-run=lookup` over a copy of `ci.yml` with this config's preset keys inlined (the local platform cannot resolve `local>a11ign/.github`): extracted `depName` `a11ign/a11ign`, `currentDigest` `a9ae7147dba6c891844ec6ea16e41e6594c4292d`, looked up `newDigest` `b18b4faad6bc076e0f5e9193c958956bf11f4d8c` (a11ign/a11ign `main` at 2026-10-12T23:08Z), `updateType` `digest`, `branchName` `bot/project-ref-bump`. Without the `(?m)` prefix the same run said "No dependencies found in file for custom regex manager" and the config still validated, which is why the pattern is run in the test and not only validated.
- The pull request's TITLE was not read: `lookup` stops before it is composed. By the preset's `commitMessagePrefix`/`commitMessageAction` and this rule's topic and extra it should read `deps: bump PROJECT_REF from a9ae714 to b18b4fa`; that is inferred.

Mutation: `renovate.json` mutated one thing at a time, the new test run, restored byte-identical each time (`cmp` against a copy):

| mutation | tests that failed |
| --- | --- |
| `(?m)` dropped from the pattern | "finds exactly the pin" and its control; not the other two |
| `branchPrefix` `bot/` to `renovate/` | the branch/preset test only |
| `enabled` true to false | the branch/preset test only |
| `datasourceTemplate` `git-refs` to `github-tags` | the file-path/datasource test only |

Not done, and why:

- Done-when 2 (one Renovate pull request bumps `PROJECT_REF` and automerges) is a live reading after this merges: the engine finds a repository only by its `renovate.json` on the default branch, so it cannot be taken from this branch. Whether the engine's token reaches agent-org is UNREAD; the one dry run on record (`renovate.yml`, 2026-10-12T19:54Z) predates any config for this repository.
- Deleting `.github/workflows/project-ref-bump.yml`, `.github/chainguard/project-ref-bump.sts.yaml`, `src/packaging/project-ref-bump-workflow.test.ts` and the flag `ci.autoBumpProjectRef` is the follow-up row, `Waiting-for` this pull request's merge and gated on a merged bump. The first two of those paths are not in this row's Region either, which is why they are not here.
- `src/packaging/release-tag-on-merge.test.ts` "has neither a lockfile nor a packageManager" fails in this worktree and fails the same on a clean `origin/main` worktree (read both: 4 pass, 1 fail); `pnpm-lock.yaml` is tracked here and `ci.yml`'s `cp` does not lay it into the project tree, so it is a property of running it outside CI's layout. Not touched.

Closes: a11ign/agent-org#1171

Outside-Region: src/packaging/renovate-project-ref.test.ts — the one test that runs the new rule over the real `ci.yml` and holds its branch to `PIN_BUMP_BRANCH`; without it the config is only validated, and a pattern that stops matching is "valid" and finds nothing (measured above)

platform: checked GitHub (Dependabot cannot read a commit pin, as `ci.yml`'s own comment says), pnpm and git, none moves a commit pin; the org's shared Renovate preset and self-hosted run (a11ign/.github, #5221) already exist and this only adds a repository's config to it.

Revert: `"enabled": false` in `renovate.json` (the preset's own off switch), or revert this pull request. A bump pull request already open stays open and is closed by hand.

Net lines (`git diff --cached --numstat`): +116 additions and -3 deletions outside this file and the changeset (`renovate.json` 39, the test 73, `ci.yml` +4 -3). The 200-line interim workflow, its policy and its test leave in the follow-up, once the replacement has run live.
