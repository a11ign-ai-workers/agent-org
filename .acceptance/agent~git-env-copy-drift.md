`copies-drifted` tripped: `src/lib/git-env.ts` differed from `packages/guards/src/git-env.ts` by one comment line
(`a11ign/control`, changed in a11ign/a11ign 3418d7313, #5086). The copy now carries it and its header names 3418d7313.
The body after the 4-line header is byte-identical to the original.

Acceptance:
```
test "$(git show origin/main:src/lib/git-env.ts | head -1 | grep -c 3418d7313)" = 0 && grep -c 3418d7313 src/lib/git-env.ts
```

Closes: none -- clears the copies-drifted org-health trip; no row was filed for a one-line comment sync.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
