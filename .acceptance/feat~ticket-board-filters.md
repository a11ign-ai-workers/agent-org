A ticket-mode worker chooses its repository and makes its worktree with `ticket:worktree` (`src/ticket-mode/worktree-command.ts`, `pool.ts`); the Pick tab gains project filters and foldable status groups, whose logic is the tested module `src/ticket-mode/board-view.ts`.

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ticket-mode
```

Consumer-declaration: none -- no new setting; `POST /api/queue` drops `repos`, which only the board's own page sent.
