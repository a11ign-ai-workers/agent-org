`copies-drifted` tripped again: `src/lib/cli-flags.ts` differed from `scripts/cli-flags.ts` by one comment line
(`a11ign/a11ign`, changed in a9ae7147d, #5171). The copy now carries it and its header names a9ae7147d.
The body after the 4-line header is byte-identical to the original. `PROJECT_REF` moves to a9ae7147d so CI compares against originals that match.

Acceptance:
```
grep -c "COPIED FROM .scripts/cli-flags.ts. at a9ae7147d" src/lib/cli-flags.ts
```

no-release: a comment line and a header in a copy, with the CI pin that matches it; nothing a pinned project runs changes

Closes: a11ign/agent-org#1119 -- clears the copies-drifted org-health trip for `src/lib/cli-flags.ts`.
