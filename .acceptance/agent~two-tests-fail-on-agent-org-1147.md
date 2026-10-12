Two tests that failed from a clean worktree depended on the host, and each now carries its own (agent-org#1147). Test files only; no source is touched.

**What changed.**
- `src/work-gate-other-scopes-concurrent.test.ts`: `readTrunkRed` keeps a repository's "has no such workflow" marker in the host's state directory and does not ask again for 24 h. The host's marker for `a11ign/.github` (`trunk-workflow-a11ign-.github-ci.yml`, `absent`, stamped 2026-10-11T16:36Z, read from the marker file itself) skipped that repository's push and schedule reads, so the wave made 14 calls where the file counts `OTHER_CODE.length * 2` = 16. The file now points `A11IGN_SHADOW_STATE_DIR` at a directory of its own (the seam `work-gate-truncated-pr-files.test.ts` and `spec-lint-promotion.test.ts` already use, and the one that wins over both `$HOME` and a declared `stateDir`), and a POSITIVE CONTROL asserts `stateEntryPath("")` is that directory, so the isolation cannot be dropped without a red that does not depend on what the host has met. It also stops the file writing `present` markers, from fake answers, into the host's state directory.
- `src/worker-stop-hook.test.ts`: the test spawns the program with `env: { PATH }`, and the hook's imports reach `board-snapshot-scope.ts`, which reads the project's declaration at import. In the project's tree (CI) `beside` holds it; in the tool's own checkout nothing does, so the child exited 1 with `ProjectDeclarationRefusal ... AGENT_ORG_HOST ... it is unset`. The file now follows `org-health.test.ts`'s #3233 rule: a recorded fixture project (`packaging/fixtures/org-health/project`) and a host file are made first, `AGENT_ORG_HOST` is set to it, the hook is imported after, and the program is handed the same file. The file no longer needs the host's declaration at all.

**Cause, measured and not inferred.** CI runs the suite in-project (`.github/workflows/ci.yml`, `working-directory: project`), so neither failure reproduces there; both are layout and host state. Reproduced at c7cf5286 with the row's command: `ℹ pass 18`, `ℹ fail 2`.

Mutation (each run with the row's `AGENT_ORG_HOST`, restored with `cp` and `diff -q`, byte-identical):
- the `process.env[SHADOW_STATE_DIR_ENV] = STATE;` line removed: 2 red, the POSITIVE CONTROL (`actual: '/home/agent/.cache/a11ign'`) and `each other repository's \`main\` is asked in the same wave` (`actual: 14, expected: 16`, the row's original failure);
- an `absent` marker for `a11ign/agent-org` planted in the file's own directory: 1 red, the `main` wave (`actual: 14`), the POSITIVE CONTROL still green, which shows the marker is the mechanism and the file's directory is the one read;
- `AGENT_ORG_HOST: HOST_FILE` removed from the child's env: 1 red, `the program itself, run as the hook is` (`[1, ...ProjectDeclarationRefusal...]` for `[0, '']`);
- `process.env.AGENT_ORG_HOST = HOST_FILE;` removed with `AGENT_ORG_HOST` unset: the file crashes at import with `ProjectDeclarationRefusal`.

Measured: the acceptance command below, `ℹ tests 21`, `ℹ pass 21`, `ℹ fail 0`; `pnpm test --changed=origin/main` with the same host, `VERDICT pass: 21 tests in 2 files`; `src/worker-stop-hook.test.ts` alone with `AGENT_ORG_HOST` unset, `ℹ tests 9`, `ℹ pass 9`; `pnpm run typecheck` exit 0. Not true, and said so: `src/work-gate-other-scopes-concurrent.test.ts` still needs a declaration at import with `AGENT_ORG_HOST` unset, by its own header ("the population is the declaration's: a third repository is covered the day it is declared"), which the row's Acceptance supplies; that was not what failed. This repository has no `lint` or `verify` script, so neither was run.

Acceptance:
```bash
bash -c 'AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import=./src/lib/crash-exit.ts --test src/work-gate-other-scopes-concurrent.test.ts src/worker-stop-hook.test.ts'
```

no-release: two test files only; nothing a pinned project runs changes

Closes a11ign/agent-org#1147

platform: n/a (a test's own fixture; the state-directory override and the fixture project already exist and are reused)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
