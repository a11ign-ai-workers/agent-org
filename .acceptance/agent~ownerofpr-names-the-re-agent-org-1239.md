Closes a11ign/agent-org#1239

## What changed

`ownerOfPr` gets an `automation-writer` rung between `owner-gone` and `chairman-author` (`src/work-gate/pr-orders.ts`). A pull request the writer app (`octo-sts`, with the bare, `app/` and `[bot]` spellings read as `DEPENDENCY_BOT_LOGIN` reads them) opened on an `automation/` branch, with nothing above naming a session, now names `ceo` with source `automation-writer` instead of falling to the `ceo` rung and being recorded as `owner-unresolved`.

- The rung sits after `label`, `closing-row`, `branch-row`, `branch-name`, `stamp`, `dependency-bot` and `owner-gone`, so a standing `session:` label still outranks it.
- Both halves are required: the writer on a non-`automation/` branch, and a worker account on an `automation/` branch, both still reach `ceo` and are recorded.
- The ladder's sentences say who owns it: `ownershipSentence`, `ownershipOf` and `notConvincedBasis` each get a case, so a stalled, conflicted, verify, remedy or not-convinced order reads "the writer app opened it" rather than "its label names you" or "stamped by you".
- The rung list in the `ownerOfPr` comment is renumbered (`chairman-author` 9, `ceo` 10).

`src/packaging/pr-owner-automation.test.ts` is new: six tests, the #5283 fixture and its controls.

## Before and after (the #5283 shape)

Input: `author: { login: "octo-sts" }`, `headRefName: "automation/docs-pin-write"`, `labels: []`.

- Before: `{"session":"ceo","source":"ceo"}`. Measured by removing the rung (mutation M1 below), which is the same path the ladder took before this change for this input.
- After, run as the row's Open-check: `octo-sts {"session":"ceo","source":"automation-writer"}` and `app/octo-sts {"session":"ceo","source":"automation-writer"}`.

## Mutation

- M1, the rung removed (`if (isAutomationWriterPr(pr)) return` deleted): 2 of 6 red, the #5283 recorder test and the red-order test. The controls stay green, as they should.
- M2, the rung always fires (`if (true || isAutomationWriterPr(pr))`): 3 of 6 red, both branch and worker controls and the red-order test.
- Each restore was byte-identical (copy in the scratchpad, `diff -q`).

## Acceptance

```
node --test src/packaging/pr-owner-automation.test.ts
```

6 of 6 pass (`ℹ pass 6`, `ℹ fail 0`).

Also run: `rstest` on the seven owner and pull-request-owner test files (`pr-owner-automation`, `pr-owner-chairman-author`, `pr-owner-dependency-bot`, `pr-owner-gone`, `pr-owner-total`, `keyed-repo-review`, `engineer-brief-pr-open`): 83 of 83 pass. `pnpm run typecheck` exits 0.

## Not in this PR

- The failure-class index step (`guard` for `owner-unresolved` naming the new rung, and clearing the `guardNote` sentence that says a no-label pull request "falls to the `ceo` rung"). That is `ceo`'s follow-up on a11ign/a11ign, after this merges, and the class is not closed before it does.
- No changeset. `.changeset/` is outside the row's Region; a patch entry is a one-line add if `ceo` wants the release note.
- `src/work-gate/shared-file-orders.ts` (`ownerSentence`) is outside the Region and was not changed. For this source it reaches the `!unowned` branch and says "It is yours (its session label, or the row it closes, names you)", which is wrong for a writer's pull request. It is addressed to `ceo`, so the wrong sentence is the only defect; the order's session is right. No row is filed for it yet: it needs one in the lane that owns `shared-file-orders.ts`, named here for `ceo` to route.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
