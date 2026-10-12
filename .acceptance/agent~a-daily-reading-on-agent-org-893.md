`src/approved-unqueued.ts` reads, once a day, the approved pull requests left unqueued over 15 minutes (each with its reason: `draft`, `hold` naming the holder, `failing check`, `not armed`) and the p90 of approval-to-queue over the last 40 merged pull requests per repository against 5 minutes, posts them as ONE keyed comment per day on #928 (a re-run edits it), and records one `approved-unqueued` failure-ledger incident, citing both days, when a count above 0 reaches a second consecutive day (a 0, a missing day or an unread day between them resets it).

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/approved-unqueued.test.ts
```

Mutation: each of the following 16 mutations was applied to `src/approved-unqueued.ts` alone and the test file run, and each fails only the tests named. Threshold read as inclusive (`waitingMs < 15 min`) fails 1 (the exactly-15-is-not-listed test); an armed pull request ignored in `listingOf` (always lists) fails 2 (the armed control and the arming-reads test); `armed` forced true (never lists) fails 13; `draft` and `hold` precedence swapped fails 1; the holder never named fails 3; the p90 target compared as `>=` fails 1; the p90 taken as the maximum fails 2; the incident fired on every day of a streak (`< PERSIST_DAYS`) fails 1 (the third-day test); the incident never fired fails 3; a `0` not resetting the streak fails 1; an `unread` day counted as above 0 fails 1; a re-run that creates instead of editing fails 1; the failing-check decider replaced by `false` fails 1, and the same decider asked without the hold's labels fails 1 (it is `red-pr.ts`'s `isBrokenRed`, #2956); the tick re-reading a posted day fails 1; the approval clock restarted at each approval fails 1.

Live: `node src/approved-unqueued.ts --dry-run` (read-only, posts nothing) printed today's reading against the real tracker repositories: 1 approved pull request unarmed over 15 minutes (a11ign/a11ign#5115, 149 min, `not armed`), and p90 approval-to-queue of 7.6 min (a11ign/a11ign) and 8.8 min (a11ign/agent-org), both over the 5-minute target, each measured over 40 of 40.
