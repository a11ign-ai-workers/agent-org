`host/gh` told a false incident for every hourly app-token mint: "app-token managers failed, fell back to the account: no reason given". The mint had succeeded. GitHub installation tokens contain dots (a measured 383-byte token has two `.`, at byte offsets 48 and 296), and the wrapper's shape check `[!A-Za-z0-9_-]` rejected any token containing one. So each successful mint was treated as a failure, the call fell back to the account, and the ledger recorded an incident with an empty stderr as its reason. The premise that token expiry was the cause is refuted: `managers.token` and `managers.failed` were written 0.1 s apart on the same mint (21:48:03.559 and 21:48:03.657), and the token is already refreshed before use when fewer than 300 s remain (`A11Y_APP_REFRESH_MARGIN`).

The fix: the token check accepts any non-empty token without whitespace (the token is opaque, so the wrapper no longer decides what a valid token looks like). An incident now names the reason as the first non-empty stderr line, with token-shaped words replaced by `<token>`, and the exit status: `app-token managers failed, fell back to the account: <reason> (exit <n>)`. A mint that exits 0 without a usable token says `exited 0 but printed no usable token`; a mint with nothing on stderr says `nothing on stderr`.

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/gh-ledger.test.ts`

Mutation: against the original `host/gh` (`git show HEAD:host/gh`), the four new tests (a11ign#4777) fail and the other 24 pass: `VERDICT fail: 4 of 28 tests failed`, exactly F01 to F04. Each guard was then removed from the fix in turn: dropping the redaction `sed` failed only the redaction test (`VERDICT fail: 1 of 28`), and removing the empty-token check failed only the exit-0 test (`VERDICT fail: 1 of 28`). `host/gh` was restored from a backup and confirmed byte-identical with `cmp` each time.

Measured: `VERDICT pass: 28 tests in 1 file` for the acceptance file with the fix. `pnpm run typecheck` exits 0. The repository has no `lint` or `verify` script. Full `pnpm test`: `VERDICT fail: 12 of 10236 tests failed in 580 files`, in seven files (`src/packaging/host-project-paths`, `live-tree-independence`, `org-health-queued-lab-jobs`, `release-tag-on-merge`, `wait-condition`, `src/work-gate-other-scopes-concurrent`, `src/worker-stop-hook`). None of those files references `host/gh` or the ledger test. Run alone they fail the same 12 of 83 tests, with `ProjectDeclarationRefusal: AGENT_ORG_HOST ... is unset` from `resolveHomeCheckout`, which this change does not touch.

Not here, and named: the installed `~/.local/bin/gh` is still the old rendered wrapper. It stops producing the false incident only after an orchestrator re-renders and installs `host/gh` from this branch; this change does not install it.

Closes a11ign/agent-org#1006

platform: no platform feature replaces this shell check; the fix is in the wrapper that GitHub calls through.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
