The acceptance-command scan charges a file `corpus` only for a `runsRoot()` CALL in its code. A sentence that names the call inside a string literal reads nothing, so it no longer refuses the row. The two env-var spellings stay charged even as strings, because `process.env["A11Y_RUNS_ROOT"]` is a real read. Closes agent-org#1327.

Acceptance:
```bash
node --test src/packaging/acceptance-commands.test.ts
```

Closes a11ign/agent-org#1327

Mutation: before the change, the string-mention case fails on the unmodified scan (it is charged `corpus`). With string content never blanked (`return text;` first in `blankStringContent`), that case alone goes red. With the blanking applied to the env-var pattern too, the env-var control alone goes red. `acceptance-commands.ts` restored byte-identical each time (`cmp` against a copy).

Consumer-declaration: none -- the scan verdict changes only for a file whose only `runsRoot()` mention is inside a string.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
