Closes a11ign/agent-org#804

## Cause
The org records a keyed-tracker worker's row as the bare number (`worker-agent-org-804` has `rows: [804]` in `~/.cache/a11ign/spare-cycles` / `spare-instances.json`). `measure` joins on `agent-org#804`, so no claimant was found and 83 of 176 rows read `UNMEASURED: no claimant recorded`.

## Change
- `keyInstanceRows`: a `worker-<declared key>-<n>` instance has its bare row numbers keyed to that tracker; keyed refs and unkeyed workers are untouched.
- Summary line `merged rows: N (measured M of N, UNMEASURED K = P%)`; over 10% UNMEASURED prints `PARTIAL` beside the mean (and `partial` / `unmeasuredShare` in the JSON).

## Acceptance
```bash
node --import tsx --test src/wakes-per-row.test.ts
```

## Evidence
- `src/wakes-per-row.test.ts` with AGENT_ORG_HOST set: 45 pass, 0 fail. Without it, 5 command/`gh`-reading tests fail on the sandbox environment, not on this change.
- The new test builds merged rows of both trackers with one instance each and asserts zero UNMEASURED among them; a row with no instance is still UNMEASURED (positive control).
- Mutation: disabling the keying fails exactly the two new keying tests; restored byte-identical.

Mutation: made `keyInstanceRows` return every instance unchanged; the two new keying tests went red and nothing else did; restored byte-identical.

## Open
Done-when 2 (live count after release) cannot be quoted before the release. Command: `agent-org wakes:per-row --from 2026-10-10T00:11:12Z --to 2026-10-11T00:11:12Z --repos a11ign/a11ign,a11ign/agent-org --json 1`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
