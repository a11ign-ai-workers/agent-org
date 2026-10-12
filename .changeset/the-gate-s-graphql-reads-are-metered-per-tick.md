---
"agent-org": patch
---

The gate's GraphQL reads are metered per tick behind the `gate.restConditional` flag (a11ign/a11ign#5128). With the marker `gate-rest-conditional` present, each `gh pr|issue list|view` and GraphQL query read through the gate's `defaultRun`, `capturedRun` or batched `runBatch` is charged to a 60-point tick budget, and a read past the cap is refused as a failed `gh` is, so each reader's own refusal path takes it. Mutations, REST calls and writes are never charged. Each tick writes one `gate-budget: N/60 points (<cause> n, ...)` line on exit. With the marker absent the gate's reads are unchanged. The ETag/304 reader and the unchanged-PR skip are built and tested but not yet called by any gate read.
