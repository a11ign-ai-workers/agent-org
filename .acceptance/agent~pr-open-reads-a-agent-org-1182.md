A bare Region path of a row QUALIFIED to another repository is read against that repository's tree (a11ign/agent-org#1182). `readRegions` in `src/pr-open.ts` keys a bare entry to the tree when the row's stated repository, or else the repository its `Closes owner/repo#N` names, is the `--repo` the PR is opened in. A path keyed to another repository still covers nothing in that tree. The new cases are in `src/packaging/pr-open-region.test.ts`.

Acceptance:

```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/pr-open-region.test.ts
```

Closes a11ign/agent-org#1182

Measured: the command above printed `VERDICT pass: 39 tests in 1 file` at this head. Before the fix, three of the four `#1182` tests failed (done-when 1, done-when 2's "only one refused" case, and the keyed-elsewhere case); the `#1182` home-repository case passed before and after. Mutation, each run and restored byte-identical: (1) the key always fires (`keyBare = tree.key !== ""`) -- the `#3083` "another repository does not widen this tree" test and the `#1182` home-repository test fail.

Not run: `pnpm test` shows 5 failures in `host-install-agent-org-launcher`, `live-tree-independence` (x2), `org-health` and `release-tag-on-merge`. The same 5 fail with the base `pr-open.ts` and `pr-open-region.test.ts` restored, so they predate this change; the cause is the environment (a `@@eventsPort@@` host placeholder with no value, and `tsx/package.json` not resolvable from a temporary tree).

platform: no platform feature covers the Region matcher; the change is one predicate in the existing reader.
