A row whose Acceptance runs `rstest run` against an agent-org path without `--config scripts/rstest/rstest.config.ts` is refused at filing (a11ign/agent-org#775). `bareRstestRunReason(body, tool)` sits beside `wholeSuiteAcceptanceReason` in `src/row-claim/template-fields-rule.ts` and `row-file` calls it once, after the whole-suite check; nothing at claim reads it, so a row already open is not shelved.

**What it reads.** A command is agent-org's from a `cd` before the `rstest run` (by the directory's name: `~/repos/agent-org`, `/home/agent/repos/agent-org`), and with no `cd` from the Region's `agent-org:` key (a test file an `agent-org:` entry covers, or a Region every entry of which is `agent-org:`). The refusal names the missing flag and quotes the corrected command. Any `--config`/`-c` makes a command not bare; a config naming a file that is not there stays `acceptancePathsReason`'s.

**The tests, each with its control** (`src/packaging/row-file-bare-rstest-run.test.ts`, 7 of 7): the bare form is refused in the three spellings plus `pnpm exec` and `bash -c` (positive); the same commands with `--config`, `--config=`, `-c` and a flag after the file are accepted (negative); `rstest run` after another repository's `cd`, a bare or other-keyed Region, and a mixed Region whose command names the other repository's file are not refused, with the mixed Region's agent-org file refused as the control (negative); `node --test` and `tsx --test` are not refused (negative); and `row-file.ts` is the only caller outside the rule's file and tests.

Mutation, six, each red in the tests named and each restore byte-identical (copy in the scratchpad, `diff`): the rule never fires (cases 1, 3, 5); the config flag ignored (0, 2); the `cd` ignored in favour of the Region (1, 3); the Region fallback always true (3); the call removed from `row-file.ts` (1); `node --test` read as `rstest run` (0, 4, 5).

Measured, not inferred: against the 66 open rows of the 2026-10-09 `open-rows.json` snapshot (27 carry `rstest run`), the rule refuses none; the three rows that carried the shape (a11ign#4900, #4902, #4904) are not in it. `row-file.test.ts` and the two `row-file-refuses-*` files have 9 failures of 196 that are identical on this tree's parent (measured with the two changed files restored from HEAD). `tsc --noEmit` reports only the two `mjs-ratchet.test.ts` errors the tree has without this change.

The row's own Acceptance (`bash -c 'cd /home/agent/repos/agent-org && node --import tsx --test src/packaging/row-file-bare-rstest-run.test.ts'`) runs in the primary checkout, which holds this change only once it is merged; the same file passes here with `node --import tsx --test` (7 of 7).

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/row-file-bare-rstest-run.test.ts`

Closes: a11ign/agent-org#775

Outside-Region: src/row-file.ts — the one call and its import; `fileRefusalReason` is where the other filing refusals are asked, and the rule itself is in the Region's `template-fields-rule.ts`.

platform: n/a (a string check on a row body; no GitHub, pnpm, systemd or git feature does it)
