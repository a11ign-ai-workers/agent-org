`src/decision-run/apply.ts` (agent-org#901, Move 2/3 of a11ign/a11ign#4505): a decision is applied through the ticket port only to an item that has not changed since its brief, and one run holds an item at a time.

**What it is.** `applyDecision(port, input)` re-reads the item: `null` is `unreadable`, an event newer than `sinceAt` (or one whose time cannot be read) is `stale`, an answer outside `allowed` is `refused`, and each writes nothing. Otherwise it posts the decision with the role and run id and changes the declared `actions`. `leaseItem` / `releaseItem` keep one per-item lease file (`LEASE_MS` = 10 minutes, created exclusively); a live lease for another run is `{ held: true, by }`, a stale or unreadable one is taken, and release removes only the caller's own. Nothing here names a cause, and the module imports no adapter and spawns nothing.

Mutation: the staleness check made never fire (`if (false) return`) turns 2 tests red (`an event newer than sinceAt is stale ... wherever it sits in the tail`, `an event time that cannot be read is stale`) and no other; restore byte-identical (copy in the scratchpad, `diff`).

Rework (reviewer-agent-org-926, concurrent stale-lease takers): replacing a stale or unreadable lease is now done under an exclusive `.lock` file and the lease is read again inside it, so the second taker answers `held`. Mutation: the lock bypassed (`if (false) return`) turns 1 test red (`a stale lease being taken by another run ... is not also taken`); restore byte-identical.

Rework 2 (reviewer-agent-org-926, release vs takeover): `releaseItem` reads ownership and unlinks under the same `.lock`, and removes nothing when the lock is held. Mutation: the lock skipped in `releaseItem` turns 1 test red (`releaseItem while a takeover holds the lock removes nothing`); restore byte-identical.

Evidence: `src/decision-run/apply.test.ts` 13 of 13 measured at this head; `tsc --noEmit` reports nothing in `src/decision-run`.

Acceptance:
git grep -q "POSITIVE CONTROL" -- src/decision-run/apply.test.ts
git grep -q "NEGATIVE CONTROL" -- src/decision-run/apply.test.ts
npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/apply.test.ts

Closes: a11ign/agent-org#901

Outside-Region: .changeset/a-decision-is-applied-only-to-an-unchanged-item.md — the entry a project that pins a tag reads.

platform: n/a (a lease file with an exclusive create is what `node:fs` gives; the tracker is reached through the port)
