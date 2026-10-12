`copies-drifted` tripped on two copies: `src/lib/git-env.ts` (3418d7313, #5086) and `src/lib/cli-flags.ts` (a9ae7147d, #5171), each by one comment line. Both now carry it, their headers name those commits, and `PROJECT_REF` moves to a9ae7147d so CI compares against originals that match.
(`a11ign/control`, changed in a11ign/a11ign 3418d7313, #5086). The copy now carries it and its header names 3418d7313.
The body after the 4-line header is byte-identical to the original.

Acceptance:
```
grep -c "COPIED FROM .packages/guards/src/git-env.ts. at 3418d7313" src/lib/git-env.ts
```

no-release: comment lines and headers in two copies, with the CI pin that matches them; nothing a pinned project runs changes

Closes: none -- clears the copies-drifted org-health trip; no row was filed for a one-line comment sync.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
