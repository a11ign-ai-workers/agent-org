## Acceptance

```bash
git grep -q "closes-mismatch-check" -- .github/workflows/ci.yml
```

```bash
git grep -q -F 'closes-mismatch-check.ts ${{ github.event.pull_request.number }} ${{ github.repository }}' -- .github/workflows/ci.yml
```

The row's `cd /home/agent/repos/agent-org` is dropped: that is the primary checkout, which does not hold this change until it merges (as with agent-org#836's file). The second command is the part the row's own grep cannot see: that the step passes the pull request's number AND its repository, which is the second argument without which the check judges the number against a11ign/a11ign.

The step is in `ci.yml`'s `suite` job, so the required check that carries it is `gate` (it `needs: [suite, ...]` and is green only on `success`). It runs on `pull_request` only.

## Mutation

Measured 2026-10-11 by running the step's command from a scratch project laid as the `suite` job lays it (this checkout's tool at `packages/agent-org` beside a11ign's `.agent-org/project.json`), against agent-org#856's real body:

- The step as written (`856 a11ign/agent-org`): `CLOSES MISMATCH: ok -- declared and resolved agree`.
- The second argument left off (`856`, the defect): `REFUSED` -- it judged #856 against a11ign/a11ign, where GitHub would close #749. The wrong repository reads as a refusal of a right body, so the argument is not decoration.
- A body declaring issue 1 of this repository (a closure GitHub would not make), second argument given: `REFUSED`, naming that GitHub will close #836 and not #1. The check refuses what it should.
- The step deleted from `ci.yml`: the first command prints rc=1 (the `git grep` finds no `closes-mismatch-check`), and restored byte-identical (`diff` of a copy) it prints rc=0. The comment above the step does not itself spell the name, so a deleted step cannot be held green by its comment.

- The step with `${{ github.repository }}` removed from its command (the defect, in the workflow): the second command prints rc=1 and the first, alone, still prints rc=0, so the second is the one that sees it. Restored byte-identical (`diff` of a copy).

The existing `src/ci-changeset-on-push.test.ts` (which runs `gate`'s script and pins its needs) and `src/ci-pins-the-project.test.ts` pass unchanged: `gate`'s needs are not touched.

Closes: a11ign/agent-org#863

platform: GitHub's own `closingIssuesReferences` is what the check compares against, and `github.repository` is the second argument rather than a literal; no machinery was built (one workflow step, 16 added lines, nothing deleted because nothing here duplicates it).
