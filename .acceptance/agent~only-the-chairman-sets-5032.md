Only the chairman sets priority; in an org-blocking emergency `ceo` may set `priority:emergency` on the fix row, honoured only while the incident is open (a11ign/a11ign#5032).

**What changes.**
- `work-gate.ts` knows `priority:emergency`. OFF unless the host declaration carries `emergencyPriority.enabled: true`; with it off nothing is read, ordered, recorded or removed (a test counts the reads).
- Honoured only while ALL hold, read from the tracker each tick and never from the label: (1) the newest `labeled` event names the managers App or the leads login; (2) the row's body has an `Incident: <ref>` line naming an OPEN item labelled `incident`; (3) that item's own `Incident: <key>` is an org-blocking key. An honoured row is ordered ahead of every `priority:chairman` row, with a fresh instance.
- It expires by itself: the gate removes the label when the incident reads CLOSED. A history or incident that cannot be READ fails closed (not honoured, label NOT removed).
- Misuse (no setter, no link, no open org-blocking incident) is ignored, written once to the failure ledger as `emergency-priority-not-honoured`, and told to `ceo`. An agent's `priority:chairman` is unchanged: still ignored and recorded (#730, #4524).
- Each honoured use is one `emergency-priority-used` ledger line, and a new `messaging:watch` source (`sources/emergency-priority.ts`) announces it once to the chairman's channel with the row, the incident and `ceo`'s `Emergency-reason:`.
- The org-blocking keys are the ones the tracker carries, measured 2026-10-11 against the open and closed `incident` items: `incident:trunk-red`, `incident:gate-crash`, `incident:ci-permission` (emitted by `messaging/sources/incidents.ts`) and `incident:claim-refusal-storm`, `incident:release-run-failed` (the org-health signals the chairman named, named `incident:<signal>` for the fix row that links them).

Acceptance:

```bash
bash -c 'npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/work-gate-emergency-priority.test.ts src/messaging/sources/emergency-priority.test.ts'
```

Measured: the row's own command (`work-gate-emergency-priority.test.ts` and `packaging/work-gate.test.ts`, with `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json`) was also run, together with `messaging/sources/readers.test.ts`: `VERDICT pass: 502 tests in 4 files`. The whole suite at this head: `VERDICT fail: 5 of 9901 tests failed in 557 files`; the four files that hold them (`live-tree-independence`, `release-tag-on-merge`, `work-gate-other-scopes-concurrent`, `worker-stop-hook`) were run in a second worktree at `ed899e85` (origin/main before this branch) and fail there too (`Cannot find module 'tsx/package.json'`, `14 !== 16`, the project declaration refusal), so they are the checkout's and not this diff's. `tsc --noEmit -p tsconfig.json`: no output.

Mutation (each run by a script that copies the file aside, mutates, runs the two test files, restores and asserts the restore byte-identical):
1. a verdict that is never `honoured`: 6 red (every ordering, use, expiry and chairman-beside-emergency test).
2. an incident that always qualifies: 1 red, the "no open org-blocking incident" table.
3. the setter not checked: 2 red (the actor test and the unknown-actor test).
4. the expiry never removing the label: 2 red (the expiry test and the option-on control).
5. emergency tier tied with a plain row: 3 red (the ordering tests).
6. the option on by default: 2 red (the off-by-default test and the option reader).
7. the source announcing a day-old use: 1 red.
8. the source announcing any ledger class: 1 red, the misuse test.

Not done in this change, and why:
- Done-when 2 (a real incident showing the label applied, the announcement and the removal at close) needs this merged and released, the option turned on in a11ign's `.agent-org/host.json`, and a real org-blocking incident; it cannot be quoted before one happens. The option's default is OFF, so the merge changes nothing until a11ign turns it on.
- `row-claim.ts` does not know the label, so B4 can still refuse an emergency row that shares a file with a holder; the chairman's rows yield there (#4793). Filed as a row.
- The daily retro does not yet COUNT the two ledger kinds (`org-retro.ts`). Filed as a row.
- The setter test is by identity, so `product-manager` and `orchestrator`, which write as the managers App beside `ceo`, pass it. "Only `ceo`" is not enforceable from the actor alone; `Emergency-reason:` and the announcement make a misuse visible to the chairman.

Closes: a11ign/a11ign#5032

Outside-Region: src/failure-ledger.ts — the two ledger kinds are named beside `CHAIRMAN_LABEL_NOT_CHAIRMAN_KIND`, where the messaging source can import them without importing the gate's recorders.
Outside-Region: src/messaging/sources/emergency-priority.ts — the announcement to the chairman (change 4 of the row), a source reading the ledger line the gate writes.
Outside-Region: src/messaging/sources/emergency-priority.test.ts — its test.
Outside-Region: src/messaging/sources/readers.ts — `readFailureLedger`, handed only when a path is given.
Outside-Region: src/messaging/watch.ts — the source, and the failure ledger's path for a real host.
Outside-Region: docs/gh-call-inventory.json — generated, regenerated with `node src/packaging/gh-call-inventory.ts`.
Outside-Region: .changeset/the-gate-honours-priority-emergency.md — a merge with no changeset is never live.

platform: GitHub's own issue events and issue state (`issues/<n>/events`, `issues/<n>`) are the history and the incident; the messaging layer's existing announcement path and ledger dedupe tell the chairman. Nothing built beside them.
