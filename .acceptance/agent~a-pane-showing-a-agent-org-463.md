A pane that shows a menu or dialog is raised on the next tick as a `tool-drift-interactive-prompt` incident to the seat that owns the session: the tick reads every live pane, a new reader (`src/pane-dialog.ts`) says whether it ends in a live menu waiting for a choice and quotes the question, and the first tick that sees one orders the owner once per dialog text.

Closes a11ign/agent-org#463

## What changes

- **`src/pane-dialog.ts` (new).** `readDialog(text)` returns `{question, choices}` or `null`. A dialog is a live block at the end of the pane (only blank, frame and key-hint lines after it) of at least two options, numbered 1..n or aligned under a `›`-marked one, that carries a selector or a key hint, with a question paragraph above it. `dialogOwner` (`reviewer-*` and `worker-*` to `product-manager`, a standing seat to itself), `dialogOrder` (the order text, first line `Class: tool-drift-interactive-prompt`), and `raisePaneDialogs` (the once-per-text memory, an unread pane keeps its memory, an order that was not accepted is not remembered).
- **`src/work-tick.ts`.** A `paneDialogs` phase at the end of `tidyRoster` reads each listed session through `paneReader(defaultRun)` and sends the order with `promptOrQueue` at `STANCE.DECISION`; the memory file is `pane-dialog-raised.json` under the host's state directory.
- **The ledger record is the order's own.** `promptOrQueue` records an order's `Class:` line with `recordFailure`, as `src/trace/freshness.ts` does, so there is one record per raised dialog and none from this module. `TOOL_DRIFT_KIND` already exists in `src/agent-tool-update.ts`; `FAILURE_KINDS` (pinned at six by its test) is unchanged.

## Verified

The acceptance command below, run with `AGENT_ORG_HOST` set as in this worktree: 14 of 14 pass.

- (1) The reviewer-lab-45 dialog is detected and its question extracted; (2) an idle Codex prompt, an idle Claude prompt, a numbered list in output, a code block, a working pane and an answered dialog are NOT dialogs, each with a twin one signature away that is; (4) the owner per session kind; (5) the second tick over the same text raises nothing, a changed text raises again, an answered and re-met dialog raises again; (6) with the real `promptOrQueue` and a scratch ledger the order is recorded under `tool-drift-interactive-prompt`, once per dialog, and a second dialog is a counted repeat (`repeatsIn`).
- **The reader over real panes** (read-only, through `paneReader(defaultRun)`, the tick's own call): 21 live sessions of the `org` herdr session read, 0 unread, **0 dialogs**. Printed for `reviewer-control-45` (a Codex pane): last lines `› Ask Codex to do anything` / `GPT-5.6-Luna medium · ~/reviews/reviewer-control-45` / `? for shortcuts` and `readDialog -> null`; for `worker-agent-org-754` (a Claude pane): `❯` between frame rules and `⏵⏵ bypass permissions on` and `readDialog -> null`. No pane was showing a dialog when this was run, so the positive is the fixture below, not a live pane.
- **The positive, from the row's quote** (`reviewer-lab-45`, reconstructed from the chairman's account: the pane is not live): `readDialog` printed `{"question":"Background server has incompatible feature settings. This session requires api_key_model_discovery to be disabled","choices":["Run without daemon this time","Restart the shared daemon","Cancel"]}`, and `dialogOrder` for it opens `Class: tool-drift-interactive-prompt`, names `reviewer-lab-45` and its owner `product-manager`.
- `tsc --noEmit` reports only the two `src/packaging/mjs-ratchet.test.ts` errors the base has. The four neighbouring files (`work-tick-cost`, `work-tick-health`, `failure-ledger`, `agent-tool-update`) and `prompt-session-caller-class` pass with this file (124 together). The whole suite: 33 of 8961 fail, in 11 files; each of the 11 was run alone on a clean checkout of the same base commit and fails identically there (2, 1, 4, 7, 1, 2, 1, 8, 5, 1, 1).

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/pane-dialog.test.ts`

Mutation: eighteen mutants of `src/pane-dialog.ts`, each red, source restored with `cp` and `diff`ed identical: the reader never firing; firing on any numbered list; the tail rule gone (a menu behind later output reads); a numbered list that may skip a number (red only after a control that repeats a number was added: the first version of the test let it survive); a list that may start at 2; a hint with no selector not enough; a selector with no hint enough; `esc to interrupt` counted as a hint; one option counted as a choice; the memory ignored; no order sent; a refused order remembered; an unread pane forgetting; an answered dialog staying remembered; the owner always the first reader; the owner always the session itself; the order without its `Class:` line; the signature the whole pane.

## Anything a reviewer should be sceptical of

- **The reader is conservative on purpose** (live block, selector or hint, a question): a dialog drawn in a shape none of the fixtures has is missed, and a miss is silent. The three shapes covered are Codex's `›`-numbered list with a hint line, Claude's framed permission box, and a selector with no numbers. A new TUI release can add a fourth; `src/agent-tool-update.ts`'s smoke start is the other net.
- **The reviewer-lab-45 fixture is reconstructed**, not captured: the pane is gone. The question line and the three choices are the chairman's words; the hint line is the Codex one.
- **A standing seat that owns its own pane is `blocked`**, so the queued order to itself is delivered when it unblocks, not while it sits at the dialog. The row asks for exactly this owner; the order says so in its own words and names the pane, and the ledger record and the stderr line (`PANE DIALOG <label> -- raised to <owner>`) are the signal until then.
- **One `herdr` read per session per tick** is new cost; the phase is metered as `paneDialogs`, so `work-tick-cost` shows it. Measured here: 21 reads in the all-panes run above (the wall was not timed).
- **Done-when's live tick is the separate VERIFY row**, filed after the merge.

platform: n/a (no GitHub, pnpm, systemd or git feature beyond `herdr agent list` and `herdr agent read`, read-only)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
