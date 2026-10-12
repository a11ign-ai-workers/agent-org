The closed-claim read goes over REST, so an exhausted GraphQL pool no longer leaves a closed row's claim unread (a11ign/agent-org#1113).

The read was one `gh api graphql` call per tracker per tick. On 2026-10-12 the GraphQL pool of the account that runs the tick measured 0 to 30 of 5000 for 30+ ticks, so the call was refused and the closed row's claim went unread for as long as the pool stayed empty. REST is a separate pool (`core`) on the same token.

**What changes.**
- *Read the row over REST.* `readClosedClaimedRows` (`src/work-gate/causes/rows-claims-closed.ts`) reads each listed row with `issues/<n>` (state, labels, comment count). For a CLOSED row still carrying the claim label it reads the last 100 comments (`issues/<n>/comments?per_page=100&page=N`, the last two pages from the count), the timeline (`issues/<n>/timeline`, its `cross-referenced` pull requests, at most five), and each such pull request's head (`pulls/<n>`). No GraphQL call is made on this path.
- *Same answer.* The return is still `KeyedClosedClaimedRow[]`, with the tracker tag on keyed rows, and `null` for a refusal, never `[]`. An HTTP 404 on `issues/<n>` is an absent row, which is no claim, as GraphQL's `issue: null` was. Any other refusal, including one on the comments, timeline or pulls read, makes the whole read UNREAD and names the cause on the log (#948).
- *Say what it reads.* The description of the read in `GH_READS.conditionalOnListedWorker` (`src/work-gate/reads.ts`) now names the REST reads.

**What does not change.** The decision (`closedClaimsWhenWorkerListed` and the orders it hands the stall pass), the call-site count (`docs/gh-call-baseline.json` still allows one `api` call site for this file, and the inventory counts the REST read as that one site), and the ratchet.

**Known difference.** A timeline cross-reference names any pull request that mentions the row, where GraphQL's `closedByPullRequestsReferences` named only pull requests that closed it. The consumers decide by head branch (the claim's own check reads `headRefName`), so a mentioning pull request whose branch is not the claim's changes nothing. This is stated here, not changed.

**Mutation.** `src/closed-claim-rest-read.test.ts` fails 7 of 7 against the origin/main implementation (the GraphQL read), and fails when a GraphQL call is put back in the REST read. The implementation was restored byte-identical from a scratchpad copy and checked with `cmp`. Timeline pages: a second mutation drops `--slurp` from the timeline read, and test (8), a timeline on two pages, fails 1 of 8 (the reviewer's finding on #1115: `gh api --paginate` prints one array per page, which is not JSON once there is a second page). The fixtures of the three older suites were then moved from GraphQL to REST, which does not touch the implementation.

**Evidence.**
- `node --test src/closed-claim-rest-read.test.ts`: 8 of 8 pass.
- The 17 test files that reference the closed-claim read: 789 of 789 pass.
- `node --test src/packaging/gh-call-ratchet.test.ts`: 8 of 8 pass.
- `pnpm run typecheck`: clean.

Acceptance: `node --test src/closed-claim-rest-read.test.ts`

Closes: a11ign/agent-org#1113

platform: n/a (the endpoints it reads are GitHub's own REST `issues`, `pulls` and timeline paths; no GitHub, pnpm or CLI feature returns a closed row's claim)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
