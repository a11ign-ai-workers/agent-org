A CI failure shared by two or more open pull requests is ONE incident row and no wake per worker, and the merged fix refreshes every PR it turned red (a11ign/a11ign#5008). `src/ci-failure-class.ts` gains `sharedFailureTick`, called from `holdForIncidentNow` in `src/work-gate.ts`: red `pr-checks-failing` orders whose failing check, failing step and first error line (normalised) match across two or more open PRs, or whose failing step is the runner's own setup, are withheld, and ONE `ci-shared-failure` row is filed or joined whose body lists the PRs (`Shared-failure-prs:`). When the PR closing that row has merged, each noted PR still open and behind is updated through `PUT /pulls/{n}/update-branch`; a refusal is written as `Refresh-failed:` and releases that PR to its worker. The detector takes an unnoted PR red since before the fix merged, 10 minutes after it. A refused read, a hung check or a PR with a second, own red check is never held.

Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/ci-failure-class.test.ts
git grep -q "NEGATIVE CONTROL" -- src/ci-failure-class.test.ts
bash -c 'cd ~/repos/agent-org-wt-5008 && npx rstest run --config scripts/rstest/rstest.config.ts src/ci-failure-class.test.ts'
```

Closes a11ign/a11ign#5008

Measured: the command above printed `VERDICT pass: 22 tests in 1 file` at this head. Mutations, each run and reverted byte-identical: (1) the hold never fires -- POSITIVE CONTROL and three more tests fail; (2) the hold always fires -- NEGATIVE CONTROL and three more tests fail; (3) the refresh never updates -- the refresh, refused and detector tests fail; (4) the 10-minute grace removed -- only the detector test fails.

Outside-Region: `docs/gh-call-inventory.json` (generated, regenerated with `node src/packaging/gh-call-inventory.ts`) and `docs/gh-call-baseline.json` (`src/ci-failure-class.ts` calls 2 -> 13). `gh-call-ratchet.test.ts` fails a file holding more call shapes than its entry and the module now writes the incident row and the update-branch itself; moving those calls behind `src/ticket-port/` is a follow-up row, not this one. The rise is plain in the diff for the reviewer.

Not done: the live reading (done-when 2) waits for the next shared failure. A LONE PR whose failing step is a setup step is not held: it is red alone, so no log is read for it and its order goes out as today (a log read per lone red PR per tick was not worth it).

platform: GitHub's own `PUT /pulls/{n}/update-branch` and `closedByPullRequestsReferences`; nothing built beside them.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
