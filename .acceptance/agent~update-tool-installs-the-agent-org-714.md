`update-tool` installs the `dependencies` a release adds BEFORE it moves the host's agent-org checkout (a11ign/agent-org#714). It installed nothing, so agent-org#522's release (`@a11ign/toolchain` at `^0.7.0`, imported by the tick, the gate and the launcher) would have moved the checkout onto a `node_modules` holding toolchain 0.1.2: the tick crash of 2026-10-09 again.

Closes a11ign/agent-org#714

## What changes, and why

- **`update-tool.ts`.** `dependenciesAt` reads `package.json` at a ref; `satisfies` judges an installed version against the ranges this tool declares (exact, `^`, `~`, `*`) and answers `null`, never `false`, for one it cannot read; `dependencyDrift` is the question "which of the release's dependencies does `node_modules` not hold". `installDependencies` runs `pnpm install --prod --no-frozen-lockfile --ignore-scripts --ignore-workspace` (pnpm through `pnpmCliInvocation`; see the first caveat) in a worktree beside the checkout (`<tool>-deps-<tag>`), renames the finished `node_modules` into the checkout only if that succeeded, and removes the fresh tree. `updateTool` asks for it AFTER the programs-lost hold and BEFORE `git checkout`; a failed install returns a `HELD ... (host-install-pending)` line naming the command and leaves HEAD and `node_modules` alone. `main` passes the real installer and restarts the long-running units when `node_modules` changed even though HEAD did not.
- **The check runs on every run, not only when the checkout moves.** An older mover that advanced onto a release without installing leaves a checkout AT the release whose dependencies are missing; a check that only looked when it moved would never mend it (case D4).
- **`installPendingFindings` (read by `host-units.ts`'s `hostInstallPending`).** One `package.json` finding, `host-install-pending`, naming the command and what is missing, from the same `dependencyDrift` the move asks. It stands only after the install failed, because the tick's `update-tool` runs before its gate in the same tick.
- **`host-units.ts`.** Comment only: `hostInstallPending` now says it carries the dependency finding.
- **`update-tool.ts`'s own imports stay `node:*` and local.** Measured with a walk of its static import closure (193 files, still 193 with the new import: `lib/npm-cli-executable.ts` was already in it and is `node:*`-only): none imports `@a11ign/toolchain`, so the mover still runs on a host that lacks it. Adding such an import to it would reintroduce the incident.

## How you verified it

```
$ npx rstest run --config scripts/rstest/rstest.config.ts src/update-tool.test.ts src/packaging/host-units.test.ts src/packaging/tick-survives-a-renamed-program.test.ts
VERDICT pass: 200 tests in 4 files   (the three above plus src/packaging/no-npm-spawn.test.ts)
$ npx tsc --noEmit -p tsconfig.json     # clean
```

Acceptance: `npx rstest run --config scripts/rstest/rstest.config.ts src/update-tool.test.ts src/packaging/no-npm-spawn.test.ts`

Mutation: the install step dropped from `updateTool` -> 4 red (D1, D2, D4 and the source pin); the install moved AFTER the checkout -> 3 red (D1, D2, pin); a failed install no longer holds -> 1 red (D2); `dependencyDrift` always reports drift -> 3 red (D1, the negative control D3, D5); the dependency finding not returned -> 1 red (D2). Each restored with `cp` and `diff`ed byte-identical.

## Anything a reviewer should be sceptical of

- **The row's acceptance names `src/host-units.test.ts`, which does not exist** (the file is `src/packaging/host-units.test.ts`); rstest filters by path, so as written it silently runs only `update-tool.test.ts` and still passes. The Acceptance above names the real path. The row's text should be amended by `product-manager`; I did not edit it.
- **pnpm, not the row's `npm install --omit=dev --no-save`-shaped line.** `src/packaging/no-npm-spawn.test.ts` refuses any `npm`/`npx` spawn in `src/` (its `ALLOWED` is pinned empty) and wants `pnpmCliInvocation` for pnpm, so the npm form failed that guard. I kept the guard and used pnpm: `--prod` is `--omit=dev`; there is no `--no-save` on `pnpm install`; `--no-frozen-lockfile` because there is no lockfile and a frozen install is pnpm's CI default; `--ignore-workspace` so a `pnpm-workspace.yaml` above the host's checkout cannot turn it into a workspace install. The child's `PATH` starts with `dirname(process.execPath)` so pnpm's `env node` shim finds a node under systemd. Checked by hand that a pnpm-installed `node_modules` still resolves after being renamed into another directory (relative symlinks). If the row meant npm, the guard is the thing to amend, not this file.
- **The package manager is a stand-in in every test.** A test may not reach the registry, so what is proven is the ORDER, the cwd, the swap and the hold, with real git; it is not proven that `pnpm install --prod --no-frozen-lockfile --ignore-scripts --ignore-workspace` resolves `@a11ign/toolchain@^0.7.0` from a fresh worktree with no lockfile on the host. I did not run it against the registry and did not touch the host.
- **`--ignore-scripts` is my addition.** Nothing in the installed set (agent-org's own `dependencies`, toolchain 0.7.1 and its peers, as installed in a sibling checkout) has an install-time script, and an unattended tick should not run one. If a future dependency needs one, this is the line to change.
- **`--prod` replaces the host's `node_modules` rather than adding to it.** Anything the host had there that is neither a production dependency nor a peer of one (a dev dependency a unit loads, `tsx` by name in a stale unit) is gone after the swap. The programs-lost check reads unit text, not `node_modules`, so it does not see that. I judged the row's own `--omit=dev` to intend it (`--prod` here).
- **The pre-fix mover cannot install for itself.** The host at v0.141.3 runs its OWN `update-tool.ts` for the move onto the release carrying this fix, which installs nothing. This PR is safe only if that release is cut before #522's, or both are in one release (then D4 mends the host on the next tick, after one crashed tick). The release order is not this row's to decide; it is the one thing I would want checked.
- **The role file `.agent-org/roles/engineer.md` is not in this repository's tree**; I read the newest copy in a sibling checkout (`wt-4906`, the a11ign/a11ign repository).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
