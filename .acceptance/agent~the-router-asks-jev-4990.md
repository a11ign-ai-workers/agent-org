The router asks Jev once per row body: a start whose row body, title, labels and posted questions match a remembered provider answer reuses that answer and asks the provider zero times. `routeOnly` looks up `route-memory.jsonl` beside the decision log (`decisionLogPathFrom(ledgerPath)`, which `routesForStarts` passes through) by a sha256 key of the row id, title, body, labels and questions. A hit runs the first start's route and writes one line, `route reused`, to the model-routing log, which `provider-confidence` does not count (it counts request lines with `answers` only). A changed body, title, label or Region is another key and asks again. Only an answer the provider gave is remembered: a fallback, a refusal or a failing provider is not, so the next start asks again. A memory that cannot be read or written is said on the diagnostic and the start asks, which costs a call and never a route.

Acceptance: `bash -c 'cd /home/agent/repos/agent-org-wt-4990 && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/engineer-route.test.ts'`

Mutation: the memory never reused (`rememberedDecision` always `null`) failed `#4990: a second start of the same unchanged row asks the provider zero times ...` only (one test failing); the key made to ignore the body failed `#4990: a changed label or a changed Region asks again ...` only (one test failing); the key made to ignore the labels failed the same test only (one test failing). `src/engineer-route.ts` restored byte-identical after each (`cmp` against a copy of the good file).

Measured (2026-10-11, rebased on origin/main ae68ca33, which carries #884's repair of the 24 routing-declaration failures): the Acceptance command above prints `VERDICT pass: 70 tests in 1 file` with `failedTests: 0`, run against `/home/agent/repos/a11y-witness/.agent-org/host.json` as the row names. The mutation counts above (one test failing) were taken before that rebase, when 24 failed on the good code; the mutated tests each fail alone. `tsc --noEmit` exits 0. agent-org has no `lint` script.

Not here, and named: the switch is not re-read on a reused start (the first start's route stands for that row body); the memory never expires (a changed key is the only invalidation); a reused start adds an `asked: false` entry to `decisionsIn`; the memory is per row, because the row id is in the key.

Closes a11ign/a11ign#4990

platform: the memory is a file beside the decision log, read and appended by the same process that already reads that log; no new service and no new credential.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
