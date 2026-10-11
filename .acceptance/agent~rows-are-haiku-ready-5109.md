**Rows are Haiku-ready (a11ign/a11ign#5109, the Haiku push).** A row that says `Tests-first: <test file>` carries its acceptance tests, written before the worker starts. The CLAIM refuses a marked row that names no test file; the MERGE GUARD refuses a PR that changes the named tests after its first commit (or whose first commit lacks them) unless a reviewer other than the author approves with `Tests-first: change approved` on a commit that already holds the tests as they will merge.

**What changes.**
- `src/merge-guard.ts`: `testsFirstOf` (the row's line, in the inline, bold and heading shapes), `testsFirstFlagOf` / `readTestsFirstFlag` (`rows.testsFirst`, exactly `true`, absent is OFF), `closedRowsOf` (the PR's own `Closes` line), `testsFirstEditReasons` (the pure verdict), `lookupTestsFirstFacts` (REST: the closed row, the first commit's files, `first...head`, and each reviewer's approval); composed into `mergeSafetyVerdict` (the required `--ci-gate`, skipped for a closed PR) and `mergeReadiness`. `undefined` is "nothing to ask", `null` is "could not read" and is `CANNOT_ASK`.
- `src/row-claim.ts`: `testsFirstClaimReason`, asked on every claim attempt beside the template-fields check; `claimRow` takes `testsFirst` and the CLI reads the flag.
- The tests are the first commit of this branch and were not edited afterwards.

**Not done, and named:** (1) a11ign's own `.agent-org/project.json` does not yet say `rows.testsFirst: true` (outside this row's Region); it takes effect for a11ign only after the release this change ships in. (2) `reason-kind.ts` does not yet classify the new `TESTS-FIRST` reasons, so `reasonKind` reads them `UNCLASSIFIED` in the verdict log; it is outside the Region. (3) No row-type classifier: a build row with NO `Tests-first:` line is not refused, because "decomposition, investigation, fleet" is not a field a row carries.

Mutation: thirteen, each red and each restore byte-identical (copy in the scratchpad, written back with `cp`, compared): claim never fires (2 red); claim always fires when on (2); edit rule never fires (5); approval ignored (3); any changed file counts (2); the author may approve (1); an approval needs no line (1); a stale approval counts (1); a closed PR not exempt in the gate (1); unread read as clear (1); the flag on for any value (1); the first-commit fault not named (1); the flag off still asks (1).

Evidence: `src/packaging/tests-first.test.ts` 18 of 18 (17 of 18 failed on the first commit, before the implementation). The whole suite at this head: 11 of 9777 fail, and the same 11 fail on a clean checkout of the release tag (measured: the 13 files that hold them were run on both trees, 9 + 2 failures each). `tsc --noEmit` cannot run in this environment: `Cannot find type definition file for 'node'` is printed on the unmodified checkout too.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/tests-first.test.ts`

Closes: a11ign/a11ign#5109

Outside-Region: .changeset/a-tests-first-row-names-its-test-file.md — the entry a project that pins a tag reads.

platform: GitHub's `closingIssuesReferences` is GraphQL and the required gate is REST-only on purpose, so the PR's own `Closes` line (which `pr:open` and CI already require) names the rows; review bodies carry the approval because GitHub has no per-file approval.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
