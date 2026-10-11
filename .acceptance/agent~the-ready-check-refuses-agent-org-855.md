The `--ready` filing refuses a `## Region` path whose top-level directory the entry's repository does not have: `packages/guards/src/x.test.ts` is refused, naming the path, the tracker's repository, and the repository that does have `packages/`; `src/new-file.test.ts` is accepted; a keyed entry is checked against its own clone (a primary-only read turns the keyed cases red).

Closes a11ign/agent-org#855

## What changes, and why

A `--ready` row whose Region names a directory its repository lacks is refused at filing, not after a worker has built against the wrong tree. `absentRegionTopDirReason(body, deps)` in `src/row-file.ts` reads each path token in the Region, takes its first segment as the top-level directory, and asks `git ls-tree --name-only origin/main <top>` in the entry's own clone whether that directory exists. Empty output means absent. A single new top-level file (`CHANGELOG.md`) is not a directory and is never read. The refusal names the path, the entry's repository, the tracker, and the declared repository that does have the directory (or says that none does).

A keyed token (`nvda-worker:packages/...`) is checked against the clone that key names, through `cloneOfKey` in `claim-stall.ts`. A keyed entry whose clone is not declared on this host is skipped, not refused, so hosts that have not yet moved to the installed form (#2623) keep filing as they do today. That is a trade-off, see below.

Deviation from the row's own rule: `src/region-paths.ts` is not in the row's Region, so I did not change it. Its `unrecognisedRegionPaths` cannot see a keyed `key:path` token at all (checked with and without a declared key), so a keyed-aware token reader sits in `row-file.ts` beside the new check. Region-paths is the owner of that reader; the duplication should go when it is fixed there.

The gate half (the `ready-row-incomplete` checks in `work-gate.ts`, `cause-declaration.ts` and `region-paths.ts`) is not changed; it needs a product-manager Region amendment. `promoteRefusalReason` (`row-file.ts`, about line 2307) is not covered by this change: a backlog row promoted to Ready there does not get this check.

## How you verified it

- `node --test src/ready-region-repo.test.ts` (with `AGENT_ORG_HOST` unset): 10 tests, 10 pass. The file sets its own hermetic host and project from recorded fixtures; every read it makes is injected, so no test runs git against a real checkout.
- `git grep -q "POSITIVE CONTROL" -- src/ready-region-repo.test.ts`: exit 0 (the file is tracked; `git grep` does not see untracked files).
- `pnpm run typecheck` (`tsc --noEmit`): exit 0.
- The eight row-file suites (`src/packaging/row-file.test.ts`, `src/row-file-board.test.ts`, `src/row-file-roadmap.test.ts`, `src/packaging/row-file-bare-rstest-run.test.ts`, `src/packaging/row-file-refuses-duplicate-title.test.ts`, `src/packaging/row-file-refuses-unreadable-wait.test.ts`, `src/row-tracker.test.ts`, `src/packaging/pr-open-region.test.ts`), run with the same fixture host on HEAD and on this change: 221 pass on both, and the set of failing test names is identical. The failures come from the fixture host, not from this change; I did not fix them.

Mutation: the keyed read made primary-only, `const checkout = checkoutOf(key);` → `checkoutOf("")`, turns three of the ten tests red: the keyed refusal (`nvda-worker:docs/guide.md`), the keyed acceptance (`nvda-worker:packages/...`), and the undeclared-clone case (the primary's lack of `packages/` is then refused). The check disabled (`if (section === null || section !== null) return null;`) turns four red. `src/row-file.ts` was restored byte-identical each time (`diff` against a copy).

Acceptance: `git grep -q "POSITIVE CONTROL" -- src/ready-region-repo.test.ts && node --test src/ready-region-repo.test.ts`

Mutation: `const checkout = checkoutOf(key);` → `checkoutOf("")` (three tests red, including both keyed cases); `if (section === null || section !== null) return null;` (four tests red).

## Anything a reviewer should be sceptical of

- Undeclared clones are not checked. A keyed row whose clone is absent from this host's `clones` passes this check. That keeps the 2623 hosts filing, but it means the check is weaker on those hosts; it is the first thing to tighten once every host has its clones declared.
- Bare prose with a slash in a Region (`and/or`, `I/O`) is read as a path, and its first segment is treated as a directory. Such a Region is refused unless the first segment exists in the repository. I did not check existing rows for this, and it is the most likely false refusal.
- The keyed-aware token reader is a second Region parser in `row-file.ts`, which the file's own comment says not to have. It is there because `region-paths.ts` cannot read keyed tokens; the fix belongs in `region-paths.ts`.
- The eight row-file suites are green only in the sense that they fail the same way before and after. Under the real host they may behave differently; I could not run them against the real host from this worktree.
- The check reads the local `origin/main` ref. A clone that has not been fetched recently can refuse a directory main has just added; fetching that repository clears it.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
