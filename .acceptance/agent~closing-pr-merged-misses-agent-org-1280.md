`closing-pr-merged` reads the qualified `Closes owner/name#n` line: a merged pull request whose body says `Closes a11ign/agent-org#1204` names agent-org#1204 while it is open, as the row's own tracker. An unqualified `Closes #n` still means a row of the tracker the pull request is read for, and a row number named by another repository never closes this tracker's row (a11ign/agent-org#1280). The copied `closesOf` parser is unchanged, so its pin to `declaredRowsFromBody` holds.

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/board-truth-audit.test.ts
```

Mutation: the repository match in `closersOf` is broken to accept every qualified line, then the unqualified match is broken to accept none; each breaks its own assertion in `src/board-truth-audit.test.ts` and the restored file is byte-identical.

Consumer-declaration: none -- `closesOf` is unchanged and `BoardFacts` gains only an optional `repo`.
