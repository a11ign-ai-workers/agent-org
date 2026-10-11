`worker:state blocked <row> --on <n> <reason>` writes a native `blockedBy` edge from <row> to <n> (REST, cross-repo allowed), posts the reason as a comment, and applies NO `answer:` label. Without `--on` the behaviour is unchanged. A closed `--on` row, or the row itself, is refused by name and labels nothing. A failed edge write falls back to the label.

Acceptance: `bash -c 'git grep -q "POSITIVE CONTROL" -- src/worker-state.test.ts && git grep -q "NEGATIVE CONTROL" -- src/worker-state.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/worker-state.test.ts'`

Mutation: the edge branch forced to label (`if (declaration.on !== undefined && false)`) failed 2 of 36 tests (the POSITIVE CONTROL and the failed-edge fallback twin); the no-`--on` branch made never to label (comment kept, label call dropped) failed 3 of 36 (the `blocked` label-and-comment test, the bare-number POSITIVE CONTROL that names the first tracker's row, and the no-`--on` NEGATIVE CONTROL). Both restored byte-identical.

Measured: `VERDICT pass: 70 tests in 4 files` for worker-state.test.ts, ticket-port.test.ts, gh-call-ratchet.test.ts and gh-call-inventory.test.ts; `npx tsc --noEmit -p tsconfig.json` exits 0.
