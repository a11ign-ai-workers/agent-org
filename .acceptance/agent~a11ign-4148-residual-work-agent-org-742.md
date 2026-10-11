The gh call ledger names WHY a read missed the read cache (a11ign/agent-org#742, residual of a11ign#4148). **The gap:** the ledger holds the subcommand and never the arguments, so a11ign#4765's reading ("the cache answers only an identical read repeated within 20 s and these callers repeat once per tick") could not be tested: "the same key asked again" and "a different key every tick" print the same line. This change adds the measurement; the reduction the row asks for is NOT in it (see Not done).

**What changes (`host/gh`).**
- *The 10th ledger field* is the cache's verdict for a read it looked at, `<hit|miss>-<why>:<argument digest>:<key digest>:<repository slug>` (`-` for any other call). `why` is `read_cache_fresh`'s: `absent`, `no-snapshot`, `no-generation`, `generation-moved`, `generation-old` (misses), `ttl` and `snapshot` (hits). The argument digest is the same under two keys when PWD, GH_REPO or the branch moved, and two digests are two questions: that is the test the row named.
- *A line from before it reads unchanged*: `gh-ledger.ts` takes the session id from the 9th field and ignores the rest, and the hourly roll-up counts a line by `NF >= 8`.
- *The call is not changed*: same arguments, stdin, stdout, stderr and status.

**What the measurement of 2026-10-11 found (on the row).** The ledger window 10:50Z-11:36Z, `app:scheduler`: `work-gate.ts [pr list]` 639 + `[issue list]` 317 + `work-tick.ts [issue list]` 246 floor points, 99 of 1,317 calls served from the cache (7.5%). The tick's 246 are `tearDownSpares` (12.5 `gh issue list` a tick, one per live spare, in `wake.ts`), outside this row's Region. The snapshot generation moved on 163 of 163 ticks for `a11ign/a11ign` and 125 of 163 for `a11ign/agent-org` (journal, 06:39Z-12:36Z), against a 133 s median tick and a 20 s TTL: those two repositories are never served across ticks.

Mutation: three, each red in its own test and no other, each restore byte-identical (copy in the scratchpad and `diff`): the `generation-moved` verdict never named (1 red: the verdict test); the TTL hit path naming `generation-moved` (1 red: the same test, the other direction); the argument digest a constant (1 red: the digest test, which first SURVIVED because it only asserted equality for one question; it now also asserts two questions have two digests).

Evidence: `src/packaging/gh-read-cache.test.ts` and `src/packaging/gh-call-ledger.test.ts` 24 of 24 (the original 22 and two new). The ledger pin of #3589 (nine fields, the id last) is moved to ten fields with the id the 9th, in the same change. `tsc --noEmit` clean. The wrapper-reading suites (`gh-ledger`, `tick-snapshot`, `gh-ledger-per-hour`, `app-role-silent`, `gh-identity`, `app-token`, `gh-comment-attribution`, `gh-identity-declared`, `org-health-app-spender`) 121 of 121 under `node --test`.

Not done, and filed as its own rows (one deliverable per row): the reduction to 700 points an hour (Done-when 2 of #742). Its measured causes lie in `src/wake.ts` and `src/tick-snapshot.ts`, outside this row's Region. a11ign/agent-org#942 takes the tick's own 12.5 `issue list` a tick (`tearDownSpares`, one per live spare); a11ign/agent-org#944 reads the new field so the gate's ~57 reads a tick can be named by argument digest. #742's Acceptance command also names `--account a11ign-ai-workers`, which the ledger no longer carries for these callers (they are `app:scheduler`), and the ledger is a 2 MiB ring holding about 46 minutes, so "one complete UTC hour" cannot be read from it: both are in #942's text.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/gh-read-cache.test.ts src/packaging/gh-call-ledger.test.ts`

Closes a11ign/agent-org#742

Outside-Region: src/packaging/gh-read-cache.test.ts -- the wrapper's cache tests, where the verdict is pinned.
Outside-Region: src/packaging/gh-call-ledger.test.ts -- pins the ledger's field count; ten, with the session id the 9th.
Outside-Region: .changeset/the-ledger-names-why-a-read-missed.md -- the entry a project that pins a tag reads.

platform: n/a (no GitHub, pnpm, systemd or git feature records a read cache's verdict; the ledger is this wrapper's own)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
