Acceptance: `git grep -q "POSITIVE CONTROL" -- src/packaging/gitignore-covers-install.test.ts && git grep -q "NEGATIVE CONTROL" -- src/packaging/gitignore-covers-install.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/gitignore-covers-install.test.ts`

**The incident.** Every agent-org release tag from v0.155.5 carries 2,278 tracked `node_modules/` files, because the repository has never had a `.gitignore` and the release commit is staged with `git add -A`. A plain `npm install` of such a tag fails with `Cannot read properties of null (reading 'edgesOut')`, which is why a11ign/lab's nightly is red (incident:trunk-red).

**What changes.** A `.gitignore` naming `node_modules/` (three lines, one of them the rule). The chairman ruled fix-forward: the five tags are not rewritten, and the next release is the clean one.

**The test.** `src/packaging/gitignore-covers-install.test.ts` runs in a scratch project under `git init`, not in this checkout: the clone's `.git/info/exclude` already ignores `node_modules` on this machine, so a check run here would pass with the rule deleted. The scratch repository gets a copy of the repository's `.gitignore`, an installed `node_modules/left-pad/index.js` and `src/x.ts`, and global excludes off.
- POSITIVE CONTROL: `git check-ignore` says `node_modules/left-pad/index.js` is ignored (exit 0).
- NEGATIVE CONTROL: `src/x.ts` is not ignored (exit 1). Any other exit is an error, and an error is not an answer.
- A release-style `git add -A` stages exactly `.gitignore` and `src/x.ts`.

**Mutation**, each restored byte-identical (copy in the scratchpad and `diff`):
- Before the change (no `.gitignore`): the copy fails with ENOENT, all three red.
- Delete the `node_modules/` line: POSITIVE CONTROL red and the staging case red, NEGATIVE CONTROL green.
- Replace the file with `*`: NEGATIVE CONTROL red and the staging case red, POSITIVE CONTROL green.

**Evidence.** `rstest run` of the file: 3 of 3 pass at this head. `pnpm run typecheck` exits 0. The affected set (`--changed=origin/main`) is this file alone and passes 3 of 3.

**Not done here.** Done-when 3 of #931 is a reading of the next release tag (`git ls-tree -r <tag> --name-only | grep -c '^node_modules/'` reads 0). It needs the merge and a release cut, so it is not in this PR. The shared release workflow's `git add -A` in a11ign/toolchain is another repository and lane, as the row says.

Closes: #931

Outside-Region: .changeset/a-release-tag-carries-no-node-modules.md — the entry a project that pins a tag reads, as the other fixes in this repository carry one.
Outside-Region: .acceptance/agent~every-agent-org-tag-agent-org-931.md — this PR's Acceptance file (ADR 0044).

platform: git check-ignore and git add -A, which already do this; no tool added.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
