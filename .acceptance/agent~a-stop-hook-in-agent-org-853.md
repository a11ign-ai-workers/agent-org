A `Stop` hook in the worker settings refuses to end a claimed worker's turn while its row has no open pull request and no fresh `worker:state` declaration, at most twice in a row (a11ign#4957 cause 4, agent-org#853).

Acceptance:
```bash
git grep -q "POSITIVE CONTROL" -- src/worker-stop-hook.test.ts
node --test src/worker-stop-hook.test.ts
node -e 'const s=JSON.parse(require("node:fs").readFileSync("src/worker-settings.json","utf8")); if(!s.hooks||!s.hooks.Stop) process.exit(1)'
```

Printed: the grep exits 0; `node --test` prints `tests 9, pass 9, fail 0`; the settings check exits 0. `pnpm run typecheck` is clean.

Mutation: six mutants of `src/worker-stop-hook.ts`, each from a copy in the scratchpad, restored with `cp` and `diff`ed byte-identical, run with `node --test src/worker-stop-hook.test.ts` (9 cases):
- The bound never firing (`refusals >= MAX_REFUSALS` made false): the BOUNDED case red.
- `stop_hook_active` ignored: the allowances, the stdin-driven entry case and the real-process case red (3 of 9).
- The hook never fires (always allows): the POSITIVE CONTROL, BOUNDED, the run-clearing case, the entry case and the twins case red (5 of 9).
- Always fires, an own open or merged pull request ignored: the allowances and the run-clearing case red.
- Declaration freshness ignored (any declaration allows): the twins case red, and only it.
- A declaration never allowing: the allowances and the twins case red.

Neighbours: `pnpm test` over the whole package printed `VERDICT fail: 60 of 9580 tests failed in 532 files`; the same 60 fail in 13 files (`engineer-route`, `row-file`, `milestone-clock`, `tick-heartbeat-is-written`, ...) on a detached worktree of `HEAD` `59ff0d03` without this change, so none is this row's. `bin-commands`, `gh-call-inventory` and `gh-call-ratchet` pass.

Done-when 1 is the case set above: refused (exit 2, stderr naming `agent-org pr:open` and `agent-org worker:state blocked <row> <reason>`); allowed on a fresh declaration, an open pull request, `stop_hook_active: true` and a non-worker session; the third refusal in a row is not issued and one `stop-hook-bound` line is on the failure ledger.

## Judgement calls

- **"Fresh" is the gate's own boundary**: a declaration made since the last delivery to the session (`lastDeliveredTo`, the wake ledger), so the hook and `declarationReading` agree. Whether what it names still holds stays the gate's reading. With no delivery on record any declaration counts.
- **A MERGED pull request of the row also allows the stop** (the row words only "open"): the deliverable landed, the gate ends the instance, and a refusal then would send the worker looking for something to declare. The read is one `gh pr list --state all --limit 100`, owned by `ownsPr`'s rungs.
- **The count is in `worker-stop-hook/<session>.json`, not `worker-state/`**, because `readDeclarations` reads every `*.json` there as a declaration and would list a count as unreadable. It is cleared by a satisfied turn, so "in a row" means in a row. A count that cannot be read or written ALLOWS the stop and says so.
- **The row is the session's name** (`worker-<key>-<n>`, `claimNames`' grammar), so no second read is paid. A name carrying no declared tracker's key (`worker-capture-2407`) holds no claim here and is allowed.
- **Known limit**: the pull request is looked for in the row's own repository; a row whose work goes to another repository is refused up to the bound, then allowed. Said in the file's header.
- **The ledger line is a `failure-ledger` entry** (`stop-hook-bound`, ref `<repo>#<row>`), like the other readings that are counted and not seeded in `FAILURE_KINDS`.
- A live smoke of the real seams (`--session=worker-agent-org-853`, real `gh`, real state directory) refused as designed; it wrote one count file under `~/.cache/a11ign/worker-stop-hook/`, which I removed.

platform: Claude Code's own `Stop` hook (exit 2, stderr) is the mechanism; no GitHub, pnpm or systemd feature does "refuse to end a turn".

Outside-Region: src/commands.ts — the command table gets `worker:stop-hook`; a hook command in the static settings file can only name the program through `agent-org`, and `bin-commands.test.ts` requires a `// command:` program to be in the table.
Outside-Region: .changeset/a-stop-hook-in-worker-settings-853.md — the entry a project that pins a tag reads.

Closes a11ign/agent-org#853
