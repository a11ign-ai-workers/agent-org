Closes a11ign/agent-org#827

## What it is
`src/decision-run/brief.ts`: `buildBrief(input, port)` returns `{ prefix, dynamic, boundary }`. Phase 2, first slice, of a11ign/a11ign#4505. Nothing is spawned, nothing is cut over, no wake cause moves.

- **`prefix`** is the shared instructions, the role excerpt and the named boundary line, and nothing else: no date, no run id, no item number.
- **`dynamic`** is the triggering event, the item snapshot (read through the port's `readItem` only; `null` throws `BriefUnreadableItemError` naming the item), the question with its default and allowed answers, the newest `RECENT_DECISIONS` (5) log entries, and the memory excerpt.
- **Caps:** the body is cut to `BODY_CAP_BYTES` (2048) on a character boundary; the dynamic part to `DYNAMIC_CAP_BYTES` (8192), trimming the memory excerpt, then the decision entries, then the body, and saying which. What cannot be trimmed being over the cap by itself throws `BriefTooLargeError` rather than cut a question. The prefix is never trimmed.
- **Signature:** the row's `input` is the seven fields it names; the port is a second argument, typed `Pick<TicketPort, "readItem">`, so the builder can be handed nothing it may not call.

## Acceptance
```bash
AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/decision-run/brief.test.ts src/ticket-port/ticket-port.test.ts
```

## Evidence
- Printed: `VERDICT pass: 30 tests in 2 files` (the 15 new cases and the port's 15). `tsc --noEmit -p tsconfig.json` exits 0.
- `AGENT_ORG_HOST` is set because this seat's shell had none and `ticket-port.test.ts` imports `work-gate.ts`, which resolves the project at import; the new test imports no project config.
- **Measured** (a script importing `brief.ts` with the test file's own fixtures; the fixtures are the only instructions that exist, since this row ships the builder and not the text): prefix 846 bytes (6 instruction lines plus a one-line role excerpt); dynamic part 563 bytes for a plain case, 4476 for five decisions, 1500 bytes of memory and a full 2048-byte body, and 8192 (the cap) for the overflow cases, which is the largest any case builds. The Phase 2 gate's 70% first-turn cache-hit share is NOT measured by this row: no run exists. What it gives is that the 846 leading bytes are identical for every run.

Mutation: five, each broken by editing `brief.ts`, each red in its own test only, each restored byte-identical (copy in the scratchpad, `diff` printed identical):
- the item number written into the prefix: 2 red (the identical-prefix case and the leak case);
- the cap never firing: 4 red (the three trim cases and the untrimmable case);
- the cap always firing: 1 red (the under-the-cap case);
- a `null` item returning an empty brief instead of throwing: 1 red;
- `node:child_process` imported into `brief.ts`: 1 red (the source check).

## For the later argv row
The `claude -p` argv builder must verify these against the installed `claude` (2.1.296 at the time of the row) before it relies on them, since the epic's sketch says "verify against the installed version":
- `--max-turns`: absent from `claude --help` at 2.1.296 (the row's Open-check counted 0), so the turn cap needs another form or a ruling;
- `--json-schema`, and the flag that sets the model;
- the flag the epic's sketch uses to drop dynamic system-prompt sections (`exclude-dynamic-system-prompt-sections`; the Open-check counted 0 uses of it in `src`, and this row did not look it up in `claude --help`);
- how settings are passed, and which flag carries the per-run caps.

I checked none of these against the installed CLI in this row; the list is what the row asks for, not a finding.

Outside-Region: none.

platform: n/a (pure string building from values handed in)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
