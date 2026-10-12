The daily retro prints the two emergency-priority ledger kinds for its 24-hour window (a11ign/a11ign#5032 follow-up). The gate writes `emergency-priority-used` once per honoured use and `emergency-priority-not-honoured` once per misuse, and nothing read them, so the retro could not show how often the emergency path was used or misused.

**What changes.** `org-retro.ts` reads both kinds through the `parseFailureLedger` reader the retro already uses for the spec-lint kind. Each prints one line beside the spec-lint line: `- Emergency-priority honoured uses (24h): N` and `- Emergency-priority misuses (24h): N`. A distinct ref counts once, since the gate writes one line per row and incident. A readable ledger with none prints `0`; a ledger that was not read or does not parse prints `unknown`, never `0`. The numbers are printed, not added to `NUMBERS`, the same as the spec-lint line, because `ceo.md`'s bound for each `NUMBERS` id is `ceo`'s to word.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/org-retro-emergency-priority.test.ts`

Closes: a11ign/agent-org#990

Mutation: four mutations of `org-retro.ts`, each applied to the file and restored from a copy with `diff` proving the restore byte-identical. Dropping the window (`entry.at >= since && entry.at <= until` replaced by `true`) fails 2 of 5 tests. Counting lines instead of distinct refs fails 1 of 5. Counting misuses as uses fails 2 of 5. A readable empty ledger reading as `unknown` fails 1 of 5. Each mutation turns red only in the tests that name it.

**Evidence**, measured at this head. Before the change the new test file fails 5 of 5. After it, `src/org-retro-emergency-priority.test.ts` passes 5 of 5. `tsc --noEmit -p tsconfig.json` exits 0 with no output. The full suite (`rstest run --config scripts/rstest/rstest.config.ts`) reports 5 of 10620 tests failed in 613 files. The same five fail identically with `org-retro.ts` at HEAD (`live-tree-independence` x2, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`), none of which imports `org-retro.ts`, so they are not this change's.

**Open-check** (the row's): `git grep -c 'emergency-priority' -- src/org-retro.ts` is nonzero at this head, because the comment beside the new code names both kinds.

The row's own Acceptance wraps the command in `cd ~/repos/agent-org`, which is the main checkout and does not carry this change. The line above runs the same test file where the tests are, as a11ign/agent-org#5197's convention does.

platform: `parseFailureLedger` and the spec-lint reader in the same file are reused; no new ledger reader is written.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
