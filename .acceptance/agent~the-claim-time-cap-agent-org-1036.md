A claim that would create a worktree is refused, before any write, when its checkout already holds 100 or more live worktrees (agent-org#1036, incident a11ign/a11ign#3846). The count is `git worktree list --porcelain`, the main one included, the same count the measurement used (97 on 2026-10-11, against 356 on 2026-10-06).

Closes #1036

Acceptance:
```bash
git grep -q "NEGATIVE CONTROL" -- src/row-claim-worktree-cap.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/row-claim-worktree-cap.test.ts
```

Mutation:
Each applied to a copy of the one line in `claimWithWorktree` (`if (live >= WORKTREE_CAP) return`), the test file run, the file restored from the copy and compared byte-identical.
- Never fires (`if (false && live >= WORKTREE_CAP)`): 2 of 4 red, "a checkout AT the cap" and "a checkout over the cap"; the NEGATIVE CONTROL stays green.
- Always fires (`if (true || live >= WORKTREE_CAP)`): 1 of 4 red, the NEGATIVE CONTROL (a checkout one under the cap); the three refusal tests stay green.

Judgement calls:
- **The cap is 100 and a checkout AT 100 is refused.** 97 against 100 leaves three claims of room, as the row says; the cap is a constant, `WORKTREE_CAP`.
- **A count git cannot read throws** rather than refusing with a message, as `rowBranchesOnOrigin` throws: a claim on an unreadable checkout is not a claim under the cap.
- **The refusal is a `patch`, as the other refusals in `.changeset/` are.**

platform: n/a (no git or GitHub feature caps the worktrees a checkout holds; `git worktree list` is the count the measurement already used).
