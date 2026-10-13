The claim path's two issue reads go over REST instead of GraphQL. `fetchLabels` reads the row with `gh api repos/<repo>/issues/<n>` and maps its lower-case `state` to the `OPEN`/`CLOSED` the callers read; `fetchClaimComments` reads the comments with `gh api repos/<repo>/issues/<n>/comments?per_page=100 --paginate --slurp` and keeps the last 100, as `comments(last: 100)` did. A failed read still refuses to guess, and its ledger line names the pool when gh says rate limit (`api-pool-exhausted`), keeping the `claim-refused` class. The pre-write read memo (`readsOnce`) recognises the REST paths.

Acceptance:
```bash
node --test src/row-claim-rest-read.test.ts
```

Mutation: the labels read put back on `gh issue view` turns cases 1 and 4 red; the state mapping dropped turns case 2 red; the comments window widened past the last 100 turns case 6 red.

Consumer-declaration: none -- the claim path's callers see the same `IssueClaim` shape; nothing a consumer sets changes.
