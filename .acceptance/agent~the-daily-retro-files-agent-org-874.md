The daily retro files a `safety-check-denied` ledger incident for every session-day whose transcript holds a removal-check denial, naming the command shape: `src/safety-check-denial-incident.ts` is the pure leaf (a `tool_result` whose content STARTS with the denial sentence; a quote of it does not count), `org-retro.ts` reads the Claude transcripts of the 24-hour window, prints one line and records each session-day once through `recordFailures`.

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/safety-check-denial-incident.test.ts
git grep -q "QUOTE" -- src/safety-check-denial-incident.test.ts
AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/safety-check-denial-incident.test.ts src/org-retro.test.ts
```

Mutation: the reader matching the phrase ANYWHERE in the content (`startsWith` to `includes`) fails 2 of 14: the QUOTE case and the list-of-text-blocks case (its mid-content twin). The reader never firing fails 12 of 14. The reader counting every `tool_result` fails the same 2 as the anywhere mutation. The day left out of the key fails 8 (the one-per-day case and every ref assertion). A denial with no found `tool_use` dropped instead of `other` fails 1 (its own case). `safety-check-denial-incident.ts` restored byte-identical each time (`diff` against a copy).

Measured: `node --test src/safety-check-denial-incident.test.ts` 14 of 14. The row's third Acceptance line names `src/org-retro.test.ts`, which does not exist in this repository; `node --test` skips a path it cannot find and exits 0, so that half of the line proves nothing. The org-retro tests that exist were run in its place: `src/packaging/org-retro.test.ts`, `src/org-retro-*.test.ts`, `src/idle-claim-incident.test.ts`, `src/merged-row-open-incident.test.ts` and `src/inert-option-incident.test.ts` with the new file, 137 of 137 pass. `pnpm run typecheck` is clean and `node -e "import('./src/org-retro.ts')"` imports. There is no `lint` or `verify` script in this repository. `pnpm test` (whole suite): `VERDICT fail: 4 of 9805 tests failed in 549 files`; the four are `src/packaging/live-tree-independence.test.ts` (2, `Cannot find module 'tsx/package.json'`), `src/packaging/release-tag-on-merge.test.ts` (1, expects no `pnpm-lock.yaml`) and `src/work-gate-other-scopes-concurrent.test.ts` (1). None of the three files imports `org-retro` or the new leaf (`grep`), and I did not run them on `origin/main`, so "pre-existing" is inferred from that, not measured. The fixture's denial shape is the real record of a denial in `wt-3964`'s transcript of 2026-10-07 (`toolu_01MSJHyiKcJSWWx1Xpw6ze7x`), read read-only.

Known uncovered: a removal a person APPROVED leaves no denial in the transcript (worker-agent-org-852's was approved by a click), so this detector sees only the denied ones. Codex transcripts are not read (the check is Claude Code's). The 24-hour window is the retro's; a session-day with denials either side of the window's start is reported by each pass that sees one of them and is one ledger line (same ref).

Closes a11ign/agent-org#874
