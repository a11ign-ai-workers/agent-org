`src/tick-scopes.ts` and `src/pr-list-memory.ts` (new, nothing calls them yet): `writeTickScopes`/`readTickScopes` carry the scopes a tick's events named to the gate (`null` for a missing, corrupt or half-written file, `[]` for a tick that named nothing); `writePrList`/`readPrList` remember one repository's open-PR list on disk (`ok: false` with `missing`, `unreadable` or `too-old`, never an empty list for a damaged file); `narrowedPrList` patches it from one `view` per named pull request, makes ZERO calls for a repository with no pull request scope, and answers `whole` with a reason of its own when it cannot. A remembered open-PR list can be patched from one `pr view` and says when it cannot.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/packaging/pr-list-memory.test.ts
git grep -q "NEGATIVE CONTROL" -- src/packaging/pr-list-memory.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/pr-list-memory.test.ts
```

Mutation: 19 single-line mutants of the two modules, each run and restored byte-identical, each turns a named test red: `age > maxAgeMs` to `>=` and dropping the negative-age check (age-limit test); dropping the `issue`-scope branch, or the `sha`-matches-a-head branch (named-three-ways test); keeping the view's `state`, dropping the sort, and not removing `CLOSED` (the MERGED/CLOSED/OPEN test); dropping the number-mismatch check and treating an unknown state as OPEN (the failed-view test); seeding the named set with every remembered number (four tests, including the ZERO-calls one); stamping the patch with `Date.now()` (three tests); writing over the whole file instead of one repository's entry (round trip); accepting an entry with no number (half-written test); dropping the repository filter (two tests); a parse error returning an empty list (every-way-whole test); `readTickScopes` returning `[]` for a corrupt file, accepting a malformed scope, and `writeTickScopes` not validating (the two tick-scopes tests).

platform: n/a (a persisted list and a patch over an injected `view`; GitHub has no memory of "the list I last read")
