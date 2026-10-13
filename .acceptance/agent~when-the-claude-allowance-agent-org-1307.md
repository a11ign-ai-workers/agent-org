When one Claude session is out of allowance, the account is limited (`gate.accountLimitPause`, default off): no row is claimed for a Claude spawn, no Claude worker or manager is started, no `claude -p` decision run is made and no prompt is sent to a Claude seat until the reset recorded in `account-limit.json`. Codex reviewers, review orders and the sweeps go on, and a claimed row keeps its claim (`src/account-limit.ts`, `wake.ts`, `serve-by-run.ts`, `claim-stall.ts`).

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/account-limit.test.ts
```

Consumer-declaration: none -- the flag is switched by `machinery:flag` and is off by default; a project that never switches it is unchanged.
