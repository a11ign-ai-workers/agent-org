**One spec writer produces every build spec (a11ign/a11ign#5116, the Haiku push).** `src/spec-writer.ts` is the gate between a one-shot spec-writer run and a Ready row: the tests must FAIL on main, and their output is recorded as `errors:` before the row is promoted.

**What changes.**
- `src/spec-writer.ts` (new): `specWriterFlagOf` / `readSpecWriterFlag` (`rows.specWriter`, exactly `true`, absent is OFF), `readSpecWriterPrompt` (the file `.agent-org/roles/spec-writer.md`, 3–5 `### Example` headings, no built-in fallback), `proveTestsFail` (exit 0 refused as "no behaviour change specified"; non-zero with output is failing; no exit code or no output is `cannot-ask`; `errors:` bounded to 4000 characters), `writeSpec` (the order: prompt, draft, proof, commit tests, promote; every effect injected).
- `.agent-org/roles/spec-writer.md` in a11ign/a11ign (second pull request, same row): the prompt, with four examples.

**Not done, and named:** (1) no caller: the one-shot machinery (#4505) is not in this tree, so nothing yet invokes `writeSpec` when a row is marked `needs-spec`, and a11ign does not yet say `rows.specWriter: true`. (2) Done-when 2, the live reading of three rows built by Haiku, is not made here and cannot be until (1). (3) The cost target ($0.30) is a constant and an `overBudget` field; nothing aggregates it.

Mutation: three, each red in its own tests and the restore byte-identical (copy in the scratchpad, written back with `cp`, `diff` clean): a passing run never refused (2 red); every run refused (3 red); the proof skipped (2 red).

Evidence: `src/spec-writer.test.ts` 13 of 13 (the file was the first commit of this branch and failed 0 of 0 -- the module absent; a test-cleanup `after` hook was added in the second commit). `eslint` has no configuration in this checkout and `tsc` was not usable here, so neither is claimed.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/spec-writer.test.ts`

Closes: none -- first half of a11ign/a11ign#5116 (the module); the prompt half is its claimed PR and closes the row

Outside-Region: .changeset/one-spec-writer-produces-every-build-spec.md — the entry a project that pins a tag reads.

platform: n/a (no GitHub, pnpm, systemd or git feature reimplemented; the test run and the promotion are injected)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
