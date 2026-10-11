The blocking-impact readout below its incident threshold is allowed by the repeating-log-line detector, so a holder shelving 1 to 4 rows stops being offered to `orchestrator` every hour (agent-org#818). The episode form, which is the incident at 5 rows for 30 minutes, is not allowlisted.

Closes a11ign/agent-org#818

Class: repeating-log-line allowlist — a line that is a readout of a count with its own threshold and owner, not a fault; guard: `src/repeating-lines-blocking-impact.test.ts` pins that the shipped allowlist matches the unkeyed, keyed and `behind` forms, does not match the `(episode open)` form or a line with no row list, and that the line IS offered at 40 ticks with an empty allowlist.

## What changes, and why

- **`src/repeating-lines.allowlist.json`**: one entry, `^blocking-impact: \S+ shelves N rows( behind \S*#N( \S*#N)*( \+N more)?)?: \S*#N( \S*#N)*$`, with its reason. The `behind` list is widened from the row's single `#N` to the list `rowList` prints, because `heldRows` accumulates across ticks and a holder held behind two rows would otherwise still repeat.
- **`src/repeating-lines-blocking-impact.test.ts`** (new): the lines come from `holdingLines` (the formatter's own output), so a wording change fails here. The keyed form is a literal, because `holdingLines` prints numbers only.
- **`.changeset/`**: a patch entry.

Why the entry cannot swallow an incident: `blocking-impact.ts` sets `episodes[holder]` in the same tick whenever a holder shelves at least `BLOCKING_MIN_ROWS` (5), and `holdingLines` appends ` (episode open)`, which the `$` anchor refuses. So every line with 5 or more rows carries the suffix and no count of 5 or more reaches the allowlisted form.

## How you verified it

Done-when 1: the test's assertions, as run:

```
✔ UNKEYED, KEYED and BEHIND readouts below the threshold are allowed by the SHIPPED allowlist
✔ the SHIPPED allowlist does NOT allow the episode form, a line with no row list, or the unattributed line
✔ 40 ticks of the below-threshold readout are offered with an empty allowlist and not with the shipped one
✔ 40 ticks of the episode form and of the no-list line are still offered with the shipped allowlist
ℹ tests 4
ℹ pass 4
ℹ fail 0
```

Acceptance: `node --import tsx --test src/repeating-lines-blocking-impact.test.ts`

Red before the entry: the first run, before the allowlist change, failed at `the unkeyed form` and `not offered with the entry`.

Mutation: in both directions, with `repeating-lines.allowlist.json` restored byte-identical after each (`diff` against a copy):

- the entry widened to `^blocking-impact: ` — the episode-form test and the offered-at-40-ticks test fail (2 of 4);
- the entry narrowed to one row and no `behind` — the unkeyed/keyed/behind test and its offered-at-40-ticks test fail (2 of 4).

The other `src/repeating-lines*` tests still pass (`repeating-lines-keyed-shelved`, 2 of 2; `repeating-lines-primary-update-echo`, 4 of 4). `tsc -p tsconfig.json` exits 0.

Not run here: `src/packaging/repeating-lines.test.ts` fails in this worktree before any test runs, because `AGENT_ORG_HOST` is unset and no `.agent-org/` exists here (`ProjectDeclarationRefusal`, from `project-config.ts`'s import). That is the environment, not this change. Its fault-line assertions (`NOT RELEASED`, `UNDELIVERED`, `nowhere to go`, the `github-status` lines) are anchored on text this entry does not start with, but that is read from the pattern, not measured.

Done-when 2 (the journal count after the change is live) cannot be read until the change is deployed; it is not measured here.

## Anything a reviewer should be sceptical of

- **The Acceptance needs `tsx` on the path.** `node --import tsx` fails with `ERR_MODULE_NOT_FOUND` in a clean tree, and `tsx` is not a declared dependency of this package. It was installed `--no-save` in this worktree to run the command as written.
- **The entry allows 1 to 4 rows and the pattern cannot count them**: the line is normalised, so `N` stands for any count. The separation from an incident is the `(episode open)` suffix, argued above, not the pattern.

Platform: the detector and its allowlist already exist here; the change is one JSON entry and a test, with no new machinery.
