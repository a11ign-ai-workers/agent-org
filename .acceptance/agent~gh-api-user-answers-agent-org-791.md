`gh api user` under a role that authenticates as a GitHub App is answered `<slug>[bot]` from the declaration instead of reaching GitHub, which refuses an installation token `GET /user` (agent-org#791, parent a11ign/agent-org#788).

Closes a11ign/agent-org#791

## What changes, and why

`host.json`'s `github.identity.<role>` gains an optional `slug` (the product-manager's ruling on the premise gap, option 1: the one source the wrapper can read with no network call and no cache file). `a11ign/a11ign#4926` already carries it on `scheduler`, `workers` and `managers`.

- **`src/app-token.ts`**: `AppIdentity` gains `slug?`. The minter never reads it.
- **`src/host-config.ts`**: `slug` is read when present and refused BY FIELD NAME when it is not an app slug (written with `[bot]`, a path, a blank, a number) or when it sits on a `user-accounts` role (it would be ignored, as `appId` is). The rendered `appDeclared` arm sets `app_slug` beside `app_id`, `app_key` and `app_inst`, empty for an app declared without one.
- **`host/gh`**: after the app block, a call that goes out as a role's App (`app_account` is set, which means the token is read or minted and is in `GH_TOKEN`) and asks `api user` or `api /user`, bare or with `--jq .login` (`-q .login`, `--jq=.login`, `-q.login`, `-q=.login`), prints `{"login":"<slug>[bot]"}` or `<slug>[bot]` and exits 0 without calling GitHub. The ledger line is `app:<role>`, resource `declared` (`gh-ledger.ts` `poolOf` counts no pool for it, as for `cache` and `queue`).
- **Unchanged, each pinned**: an app declared with no `slug`; any other argument (`--jq .id`, `-i`, `-H`, `--hostname`, `--method`, another endpoint); an explicit `GH_TOKEN`; a role with no App; a mint that failed (the call goes out as the account, so its own login is the true answer and the App's is not claimed).
- **`src/packaging/host-project-paths.test.ts`**: the pinned digest of the rendered wrapper moves, deliberately, with the comment line that file keeps for each such move (`TODAYS_GH_WRAPPER`; the same move #817 and #741 made). See `Outside-Region` below.
- **`README.md`**: the `github.identity` section names `slug` and the answer.
- **`src/gh-identity.ts` is not touched.** It answers "which `hosts.yml` account would this process use" for the gate's CANNOT ASK report and is read only on that refusal path; the row's change is the wrapper's answer. Noted so the Region entry is not read as an omission.

Outside-Region: src/packaging/host-project-paths.test.ts — pins the sha256 of the rendered `host/gh`, which this row changes; its digest is derived from the tree (the failing run printed the new one) and moved in the same PR, as #817's `b35f93f5` did.

## How you verified it

Measured on this host, at this head. This worktree holds no `node_modules` and no `.agent-org/project.json`, so I ran with per-entry links to `a11y-witness`'s `node_modules`, and `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json` where a suite needs a project (the new file sets its own).

- The Acceptance, as written: `VERDICT pass: 9 tests in 1 file`.
- **Positive control, the new tests against the wrapper as on `origin/main`**: the 3 tests that expect an answer go red (the stub is reached with `api user --jq .login`); the 6 others stay green.
- `app-token.test.ts` 22 of 22 and `host-units.test.ts` 171 of 171 (they render and run the wrapper); `gh-identity-declared`, `host-tool-install`, `work-tick-crash-exit`, `pr-open-only-creates`, `ticket-port`, `adopter-docs`, `installed-layout`, `pr-open`, `gh-call-ratchet` pass with `AGENT_ORG_HOST` named. `host-project-paths.test.ts` failed with this change and passed without it (the digest), and passes with the pin moved.
- `tsc --noEmit`: 4 errors, none in a file this touches (the same 4 as on `origin/main`).
- **Not measured: Done-when 2.** The installed `~/.local/bin/gh` is the old render until `host:install` or the tick's `tickRerenderGhWrapper` (#790) writes it; `wrapperIdentity` compares the `app_declared()` body, which this changes, so the tick re-renders it on its own. The live reading, `gh api user --jq .login` as a worker printing `a11ign-workers[bot]`, is after that and is not claimed here.

Acceptance: `pnpm exec rstest run --config scripts/rstest/rstest.config.ts src/gh-identity.test.ts`

Mutation: the answer never fires -> 3 red (the three that expect an answer), the 6 others green; the argument filter dropped -> 4 red (the three, and the case that sends another filter, a header, `-i` and a host through); fires without a slug -> 1 red (the no-slug case); fires with no App token in use (`app_who` stands in for `app_account`) -> 1 red (the explicit-token, no-App and failed-mint case); the `.login` form prints JSON -> 3 red; the ledger names the account and not the App -> 1 red; `slug` never read -> 6 red; `slug` accepted unchecked -> 1 red (the refusal case); the `app_slug` arm not rendered -> 4 red. Each file restored from a copy taken before and compared byte-identical.
