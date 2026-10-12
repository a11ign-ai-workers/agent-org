A refused closed-claim read says why: `readClosedClaimedRows` names gh's own first stderr line, or its exit status or signal, on the log as `closed-claim: the read of <repo> was refused: <cause>`, and the tick's UNREAD line names the same repository. A `JSON.parse` failure and a null `data.repository` say so in their own words. The read still answers `null` (UNREAD), never an empty list.

Acceptance:

```bash
node --test src/closed-claim-unread-cause.test.ts
```

Mutation: the refusal log removed from `readClosedClaimedRows` (`refused` no longer logs) fails cases 1, 2 and 3 (refused call, answer not JSON, null repository) and leaves the control green. A cause line printed on a successful read fails case 4 (the control) and leaves 1 to 3 green. Each mutant was run with the file restored byte-identical after (`cmp` against a scratchpad copy).
