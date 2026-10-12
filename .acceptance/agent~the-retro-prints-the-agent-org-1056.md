The retro prints the rows the spec lint refused in the last 24 hours, on the line after the underspecified-stops line (a11ign/agent-org#1056, follow-up to #1017). The lint's refusals were one ledger line each (`recordSpecLintRefusals`, kind `spec-lint-refused`) and nothing read them, so a lint that was too strict was invisible.

**What changes.**
- `failure-ledger.ts`: `SPEC_LINT_REFUSED_KIND` is now defined here, beside `CLAIM_REFUSED_KIND`, so the retro can name it without importing the CLI `row-file.ts`. It stays out of `FAILURE_KINDS`, for the reason `CLAIM_REFUSED_KIND` gives.
- `row-file.ts`: imports the kind from `failure-ledger.ts` and re-exports it, so `spec-lint-promotion.test.ts` and any other importer keep their name (the `OUT_OF_RELEASE` pattern).
- `org-retro.ts`: a pure reader over the failure-ledger text `buildReport` already holds (`specLintRefusalsOf`, window `since <= at <= until`, the same 24 h as the rest of the report), and the line renderer (`specLintRefusedLines`). It prints the distinct rows, the total of refused findings, and the count by field (most first).
- `spec-lint-retro.test.ts` (new): the Acceptance file, with a hand-checked fixture written through the real `recordSpecLintRefusals`.

**Assumptions, said so.**
- A missing ledger file is treated as unreadable and prints `unknown`, matching the existing `readText` convention, not `0`. A host with no spec-lint refusal ever recorded therefore shows `unknown` until the first refusal line exists. This is the one judgment call to redirect if `0` is wanted for an absent file.
- Each ledger line is one refused finding. "Rows" counts distinct `#<row>` values in the window; "findings" counts lines. A second finding on one row is one row and two findings.
- The reader lives in `org-retro.ts`, not `spec-lint.ts`, because `spec-lint.ts` is outside this Region. The only lint-side name it uses is `UNNAMED_FIELD`, imported read-only.
- No trended NUMBERS entry, as the row asks.
- No changeset: the change is under `src/`, and the changeset rule applies to `host/` only.

**Evidence, measured on this branch.**
- Acceptance: `src/spec-lint-retro.test.ts` 6 of 6 pass.
- Against HEAD's three source files: 5 of 6 fail, measured earlier in this session.
- Mutations: five one-occurrence changes, each turning the verdict red. Each file was restored byte-identical from a `cp` backup, checked with `cmp`.
- `npx tsc --noEmit -p tsconfig.json`: exit 0.
- Full `pnpm test`: 19 failures in 11 files. The same 19 fail on HEAD's three source files, so they are not caused by this change. They come from this host's live claim-refusal ledger ("More than 10 claims were refused inside 15 minutes").
- Not run: `pnpm run verify` and a lint script (neither is a script in this repository).

Acceptance: `cd /home/agent/repos/wt-agent-org-1056 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/spec-lint-retro.test.ts`

Closes a11ign/agent-org#1056.

platform: n/a (a line in the retro's text report and a constant's home; no platform feature reads it)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
