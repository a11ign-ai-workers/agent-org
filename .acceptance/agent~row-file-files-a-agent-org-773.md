`rowTracker` files a row whose Region entries ALL carry the key of a declared `code` repository other than the tool's (`control:ansible/...`, the lab) in the HOME tracker, not the org tracker: agent-org#771 and #772 were filed in a11ign/agent-org for a `control:ansible/...` Region and refiled with `--tracker=`. A Region naming the tool's own key, an empty or absent Region, any bare path, a key the declaration does not name, and a mix of these with a control path file in the org tracker exactly as before; `--tracker=` still overrides (`trackerNamed` is untouched). `rowKind` is not touched: the same Region is still `org` by `ceo`'s share rule (#3820, #4399), and a test pins that.

One existing assertion moved: `worker:docs/x.md` (a non-releasable path of a PRODUCT repository, keyed) used to be asserted as filed in the org tracker. It is a keyed entry of a declared non-tool code repository, which is what this row's Change names, so it now files in the home tracker; its `rowKind` reading is still `org` and is asserted as such. A bare `docs/runbook.md` is unchanged. Bare paths are deliberately not counted: they belong to the project's first repository by position, and a row written from inside the tool's own tree (this row's own Region) carries bare paths.

Evidence (measured on this branch): `src/row-tracker.test.ts` 15 of 15 pass; with `src/row-file*.test.ts` and `src/class-repeat*.test.ts` 99 of 99 pass. Open-check re-run at this head: `grep -q "control repository" src/row-tracker.test.ts` finds the case and the file passes, exit 0 (it read 1 at `ec83e43d`). `tsc --noEmit` reports no error in either file (the errors it prints are `@a11ign/toolchain` imports unresolved in this checkout, in files this change does not touch).

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-773 && grep -q "control repository" src/row-tracker.test.ts && npx rstest run --config scripts/rstest/rstest.config.ts src/row-tracker.test.ts'`

Mutation: the control-repository case never fires -> 1 red; it fires for every org row -> 5 red; `every` becomes `some` (a mix goes home) -> 1 red; the tool's own key counts as another repository -> 2 red; a bare path counts -> 2 red; an empty Region counts -> 2 red; a key the declaration does not name counts -> 2 red. Each was applied to `src/row-tracker.ts` from a copy and the file was restored from it and diffed byte-identical.

Closes a11ign/agent-org#773

platform: n/a (a pure function of a Region and the declared trackers)
