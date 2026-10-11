A daily reading of engineer starts by route (`routeShares`), the first-pass merge by route for haiku/high, sonnet/medium and sonnet/high joined through the decision `id` `row-<n>`, and a guard that files ONE failure-ledger incident per lower tier more than 5 points under Sonnet/high's at n >= `MIN_RATE_ROWS`; a CLI prints both readings and tells the day's post as an announcement (a11ign/agent-org#724, #4875 item 4).

Acceptance:
```bash
bash -c 'cd /home/agent/repos/wt-agent-org-724 && npx rstest run --config scripts/rstest/rstest.config.ts src/route-guard.test.ts'
```

The row's command, `npx rstest run src/route-guard.test.ts` without `--config`, exits 1 on EVERY test file in this repo: `src/engineer-route.test.ts` fails the same way ("No test suites found in file"), because the `node:test` suites need `scripts/rstest/rstest.config.ts`. The `--config` form above is the one that runs. The test needs no `AGENT_ORG_HOST` (run here with it unset): `route-guard.ts` imports `engineer-route.ts`, `decision-provider.ts` and `haiku-tier-report.ts` only from the CLI, since each resolves the host on import.

Printed `VERDICT pass: 16 tests in 1 file`. With `src/trace/haiku-tier-report.test.ts` and `src/engineer-route.test.ts`: `VERDICT pass: 90 tests in 3 files`, on this branch merged with `origin/main` at 2026-10-11T01:50Z.

Mutation: each applied to a copy of `src/route-guard.ts`, the file restored from it and `diff` byte-identical after the run:
- The guard never fires (`over: false`): red, the 6-under case and the exact-5 case.
- The guard always fires (`over: true`): red, the 4-under case and the exact-5 case.
- `>=` for `>` on the gap: 1 red, the exact-5 case.
- The gap taken in floats rather than integers: 1 red, the exact-5 case on rates a float gets wrong.
- The merged floor `>` for `>=` `MIN_RATE_ROWS`: red, the floor case.
- No floor at all: red, the floor case and the "read failed shows no figure" case.
- The baseline's own readability not required: 1 red, the floor case (a tier compared against an unreadable Sonnet/high).
- A day in the incident's ref (a second day files a second incident): red, the 6-under case and the second-day-skip case.
- An unrecognised `via` dropped from the parts: 1 red, the parts-sum-to-starts case.
- Another tracker's row joined to the first tracker's result of the same number (no tracker filter in `firstPassByRoute`): 1 red, the keyed-row case.
- A row's identity ignoring its tracker (`agent-org#724` and `#724` one row): 1 red, the keyed-row case.
- Keyed ids dropped, as `ROW_ID` did before this branch: 2 red, the keyed-row case and the one that prints it.
- The FIRST route line of a row kept rather than the last: 1 red.
- A non-`jev` start counted as the provider's: 1 red.

Judgement calls:
- **Only `via jev` rows are compared.** A fallback, refused or override start was not the provider's choice, so its first-pass rate says nothing about a tier's rule; they are counted apart in the starts reading and dropped from the merge reading.
- **A row is read under its LAST route line**, the one that took effect.
- **7-day window.** A lower tier rarely has 8 merged rows in a day; `--since` sets another. The incident's ref carries no day, so a breach is one line until someone clears it, even if fixed and returned; that cost is the row's "no second incident on a second day".
- **The baseline must be readable too.** A tier is not judged against a Sonnet/high that itself has under 8 merged rows.
- **"Raise `MEDIUM_MAX_P_SUBSYSTEMS`" in the row is the wrong direction**: it is a ceiling, so a breach names "lower `MEDIUM_MAX_P_SUBSYSTEMS`" (sends fewer rows to Sonnet/medium). The test pins every named constant to a name `engineer-route.ts` exports.
- **Another tracker's rows are starts, and not yet results.** After a11ign/agent-org#756 the log carries `row-agent-org-<n>` beside `row-<n>` (224 of 929 `model-routing` lines on the live log at 2026-10-11T01:54Z). The row's `row-<n>` join would drop them without a word and under-count the starts, and a join by bare number would give agent-org#724 the first tracker's #724's merge. They are now counted in the starts reading (and said so: "N of the lines are another tracker's rows"), identified by `(tracker, row)`, and NOT joined to a first-pass result, because `readClosedRows` reads the first tracker's closed rows only; each tier's line says how many such rows it left unread. **So the guard judges a tier on the first tracker's rows.** Reading the other trackers' closed rows (the host's tracker declaration, one `gh` read per repository) is a follow-up, named here and not done.
- **"By whatever #4748's reading uses"** is the announcement path of the decision-confidence post (kind `summary`, announcement audience, one per UTC day, messenger then chairman chat then epic #4627). That plumbing sits outside this row's Region, so it is COPIED into `route-guard.ts` with a comment; extracting it from `decision-confidence-post.ts` is a follow-up.
- **`pullOutcome` is exported from `haiku-tier-report.ts`** and `measuresOf` uses it, so "first-pass merge" has one definition for the Haiku report and the guard (the 90 tests above show the report unchanged).
- A first-pass read that failed (`gh` or the store) prints `NOT READ`, files nothing and exits 2, so a scheduled `--record` does not look as though the guard looked.

Done-when 2, `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node src/route-guard.ts` at 2026-10-11T01:54Z, over `~/.cache/a11ign/decisions` (1069 lines) and the default trace store, with `gh` reading the closed rows (no `--record`, no `--post`: nothing was filed or posted). The first attempt, 2026-10-10T19:46Z, was `NOT READ` on a GraphQL rate limit and printed no first-pass figure; this one read:
```
Engineer starts by route, 2026-10-04T01:54Z to 2026-10-11T01:54Z: 330 route lines on 126 rows; 112 of the lines are another tracker's rows.
  the provider's routes (via jev), 318: haiku/high 7 (2%), sonnet/medium 39 (12%), sonnet/high 272 (86%)
  not the provider's: refused 11, override 1
First-pass merge by route, rows the provider routed in the window (a pull request merged with no CHANGES_REQUESTED review):
  haiku/high: 4 routed, 3 of 3 merged first pass (100%); 0 closed with no merged pull request, 0 unresolved, 1 still open; 2 of another tracker's rows not read
  sonnet/medium: 16 routed, 13 of 14 merged first pass (93%); 1 closed with no merged pull request, 0 unresolved, 1 still open; 1 of another tracker's rows not read
  sonnet/high: 79 routed, 50 of 53 merged first pass (94%); 19 closed with no merged pull request, 0 unresolved, 7 still open; 13 of another tracker's rows not read
Guard (a tier is read at 8 merged rows or more; over the line is more than 5 points under sonnet/high):
  haiku/high: not readable -- haiku/high has 3 merged rows, under 8
  sonnet/medium: ok, 1 points under sonnet/high (the line is more than 5)
```
The log's earliest routing is 2026-10-10T09:00Z, so the window holds about a day and a half of routing. haiku/high is not readable (3 merged rows) and the guard files nothing on it; sonnet/medium is 1 point under sonnet/high's 94%, not a breach. Both rates are over the first tracker's rows only (see the judgement call above).

Neighbours: `tsc --noEmit` is clean on this branch.

Closes a11ign/agent-org#724

Outside-Region: docs/gh-call-inventory.json — generated by `src/packaging/gh-call-inventory.ts`; `route-guard.ts` posts through `gh` (api rest, issue comment), so `gh-call-inventory.test.ts` fails until the committed scan is rewritten (the one red on the first push, 82ffc2ee)

platform: n/a (no GitHub, pnpm, systemd or git feature beyond `gh` reads of closed rows and their pull requests, already used by `src/trace/haiku-tier-report.ts`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
