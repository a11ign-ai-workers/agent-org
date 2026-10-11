An Acceptance runs in the claimed worktree, and a leading `cd` into the primary checkout is run in the worktree instead (a11ign/agent-org#859, a11ign#4957 cause 2). `runAcceptanceCommand` (`src/acceptance-commands.ts`) is the one runner `pr-open.ts`'s check and CI's `main` both call: `cwd` is the top level of the worktree the process was started in, and a `cd` that opens a command (or its `bash -c '...'` string) into the primary checkout of that repository, found as the parent of the common `.git`, is run as `cd .` / `cd ./sub` with a `RUN-IN-WORKTREE:` line first. The file check before a `tsx --test` line resolves the same target to the worktree.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/acceptance-runs-in-worktree.test.ts
AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/acceptance-runs-in-worktree.test.ts
```

Mutation: five, each red and each restore byte-identical (`cp` to the scratchpad and back; `git diff` of the file unchanged): the rewrite never firing (4 red: the POSITIVE CONTROL, the subdirectory and `bash -c` case, the pure function, `pr:open`'s route); the rewrite always firing, so a `cd` into another repository's checkout is moved too (2 red: the REFUTATION and the pure function); `execSync` given no `cwd` (1 red: the cwd-printing Acceptance); the pre-run file check not mapped to the worktree (1 red: the file check); `pr:open`'s runner given a different `cwd` (1 red: its own route). Each turns its own test red and no other.
