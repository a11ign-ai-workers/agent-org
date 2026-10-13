`denialShape` names `nested-shell-c` for a `bash|sh|zsh|dash|ksh -c` whose script holds a `$` or a backtick, whether or not an `rm` is in it, so a denied `bash -c` with a `$` and no removal is no longer `other`. The shell set and the `-c` option form match `scripts/claude-hooks/refuse-unreadable-command.ts`. `variable-target`, `node-e-rm` and `other` are unchanged.

Acceptance:
```bash
node --test src/safety-check-denial-incident.test.ts
```

Mutation: the nested-shell rule never firing (HEAD's `denialShape`) fails `THE FIXTURE` and `the nested-shell-c rule ...` and no other test in the file; the rule always firing fails `the four shapes ...` and `the nested-shell-c rule ...` and no other.

Consumer-declaration: none -- the shape names are the same set; a denial whose command is a nested shell with a `$` or backtick and no `rm` now reads `nested-shell-c` in its ledger ref instead of `other`, for denials from this change on.
