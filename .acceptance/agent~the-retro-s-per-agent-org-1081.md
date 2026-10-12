The daily retrospective's reads walk the merged pull requests only above a per-repository mark kept in the retro state entry, and cache the `.acceptance/` contents by merge commit there; a tick logs a `RETRO READS` line with its pages, lists and acceptance reads and their seconds. A first tick reads in full and writes the mark and the cache; a second tick over the same fixture makes no acceptance read and one top page per merged list; a missing or unreadable state entry is read in full and named in the line.

Acceptance: `bash -c 'cd /home/agent/repos/wt-agent-org-1081 && npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/org-retro-read-cost.test.ts'`

Mutation: the cache lookup removed from `acceptanceOf` in `src/org-retro.ts` failed 2 of 5 tests (the first tick's single acceptance read, and the second tick's zero-read check). `src/org-retro.ts` restored byte-identical (`diff` against a copy).

Measured: `VERDICT pass: 5 tests in 1 file` for the acceptance file; with `src/packaging/org-retro.test.ts`, `src/org-retro-dora-resumes.test.ts`, `src/org-retro-merged-repositories.test.ts`, `src/org-retro-release-reasons.test.ts`, `src/packaging/gh-call-ratchet.test.ts`, `src/merged-row-open-incident.test.ts` and `src/inert-option-incident.test.ts`, passing. `npx tsc --noEmit -p tsconfig.json` exits 0. Live before and after numbers are not measured here (no fleet read).

Not here, and named: `readMerged` (the 24-hour count) still walks its window each tick; the open pull request list is read twice per tick and not cached; DORA reads are outside the count.
