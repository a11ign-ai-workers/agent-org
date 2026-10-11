---
"agent-org": patch
---

A worktree `row-claim claim --branch --worktree` makes is provisioned from the repository's committed lockfile (a11ign/agent-org#851, a11ign#4957 cause 2): when the new tree has a `package-lock.json` and no `node_modules`, the claim, once recorded, runs `npm ci --ignore-scripts` in it and its line ends `/ installed` or `/ install failed: <first error line>`. A failed install does not fail the claim; a repository with no lockfile, a tree that already has its modules and an adopted tree are claimed as before. The repository now commits `package-lock.json`; `ci.yml` still installs by name (a follow-up joins the two).
