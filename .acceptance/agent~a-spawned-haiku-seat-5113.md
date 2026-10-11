**A spawned Haiku seat's first order carries the stop-early and run-the-check text (a11ign/a11ign#5113, the wake half of #5111, the Haiku push).** With `workers.haikuBrief` on in the host declaration, `addressed` appends one tail after `blastTail` for a SPAWNED seat that was STARTED on a Haiku model: the two sentences and the paragraph from Anthropic's "Prompting Claude Haiku 5.5", then one line of ours on quoting file text from `sed`/`grep` output. Flag off, or any other seat, the order is byte-identical to before.

**What changes.**
- `src/haiku-brief.ts` (new): the three published strings, `haikuBriefEnabled` (reads `workers.haikuBrief` from the file `$AGENT_ORG_HOST` names, exactly `true`; an unreadable file or a non-boolean value is OFF and said once) and `haikuBriefTail(model)` (the model is asked before the flag, so a Sonnet seat never reads the host file).
- `src/wake.ts`: `addressed` takes `model` and appends `haikuBriefTail(model)` to the SPAWNED branch only; `promptTarget` hands it `target.profile.model`, the model the seat was started on. Three edited lines and one import.
- `src/wake-haiku-brief.test.ts` (new): 13 tests, positive control (Haiku seat, flag on) and negative control (Sonnet seat, flag on) named in the file, through the real `addressed`, the real `deliver` and the real flag reader.

**The text was extracted from the published page by command, not retyped** (fetched 2026-10-11 at this head; `strip.py` drops `<script>`/`<style>`, turns block tags into line breaks and unescapes entities):

```
$ curl -sSL https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5 | python3 -I strip.py /dev/stdin | grep -E '^(Keep working until everything|When the work the user asked for is done|When you change code that can be run)'
Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step.
When the work the user asked for is done and checked, stop and report. Don't add new features, docs, or refactors that weren't asked for. If you think one would help, mention it at the end instead of doing it.
When you change code that can be run, built, or type-checked, run a real check that exercises the change before reporting it done: the project's tests, type-checker, or build, or the changed command itself. A syntax-only check, or a check command that failed to start, does not count; if all that is missing is the project's declared dependencies, install them with its own package manager and lockfile (e.g. npm install, pip install -r requirements.txt), never via sudo or the system package manager, unless told not to. Only if no real check can run here, say which one you did not run and why instead of reporting the change as done.
$ ... | grep -E ... | head -c -1 | sha256sum
aac0acc50654090556cfb8f2849082c583683e053376698be10445f0978c5a06  -
```

The digest is `PUBLISHED_TEXT_SHA256` in `src/haiku-brief.ts`, and a test asserts the constants hash to it.

**The orders, built by the real `addressed` on a clean `origin/main` (d3fbb15a) and on this branch, flag on and flag off** (measured: one script, `node orders.mjs <root> <host.json>`, sha256 prefix and bytes):

| case | origin/main | this branch, flag OFF | this branch, flag ON |
|---|---|---|---|
| spawned, Haiku | 4793884d2ec22256, 999 | 4793884d2ec22256, 999 | **acb79e42f3381bba, 2202** |
| spawned, Sonnet | 4793884d2ec22256, 999 | 4793884d2ec22256, 999 | 4793884d2ec22256, 999 |
| spawned, no profile | 4793884d2ec22256, 999 | 4793884d2ec22256, 999 | 4793884d2ec22256, 999 |
| standing, Haiku | 676bc7bd961eec67, 1167 | 676bc7bd961eec67, 1167 | 676bc7bd961eec67, 1167 |
| reviewer, Haiku | 7719c29d97fa336f, 1126 | 7719c29d97fa336f, 1126 | 7719c29d97fa336f, 1126 |
| follow-up, Haiku | 49cdd459df43aef5, 57 | 49cdd459df43aef5, 57 | 49cdd459df43aef5, 57 |

The one cell that moves is the one the row names: +1,203 bytes on a spawned Haiku seat's first order.

**Mutation: seven, each red, each restore byte-identical (copy in the scratchpad, written back with `cp`, compared with `cmp`):**
- M1 the tail never fires (`return ""`): 3 red (the positive control, "the model is asked before the flag", the `deliver` positive control).
- M2 the model test dropped, so it fires for any model: 4 red (the negative control, "a spawned seat with no profile", "the model is asked before the flag", the `deliver` Sonnet comparison).
- M3 the flag test dropped, so it fires with the flag off: 2 red (the flag-off order, the `deliver` flag-off order).
- M4 the reader accepts any truthy value: 1 red ("the flag is exactly `true`").
- M5 `promptTarget` does not hand `addressed` the model: 1 red (the `deliver` positive control; the `addressed`-level tests cannot see a call-site loss, which is why those two `deliver` tests exist).
- M6 the spawned branch does not append the tail: 2 red (the positive control, the `deliver` positive control).
- M7 the standing branch also appends it: 2 red (standing seat, reviewer).

**Evidence:** `src/wake-haiku-brief.test.ts` 13 of 13. The whole suite at this head: 12 of 9850 tests fail in 565 files; the 17 files that hold them were re-run on a clean `origin/main` (d3fbb15a) and on this branch, 4 of 301 failing on each, the same 20 failure names on both (compared with `diff`), so none is this change's. `tsc --noEmit` needs `--typeRoots node_modules/.pnpm/@types+node@22.20.5/node_modules/@types` here (`Cannot find type definition file for 'node'` otherwise, on the primary checkout too): 63 errors on origin/main and 63 on this branch, none in `haiku-brief.ts` or `wake.ts`.

**Health signal and revert (a11ign#5100's rule).** The signal is Haiku "done without a check" as the reviewer counts it, on first orders that carried the tail against first orders that did not. Revert is the flag off: `workers.haikuBrief` removed or `false` in the host declaration, effective on the next delivery, no restart and no code change.

**Not done, and named:** (1) The flag is OFF everywhere: nothing here turns it on, and no live run is this row's; a VERIFY row is filed when it is first turned on, reading a live Haiku pane's first order. (2) The placement is the first-contact preamble only, as the page's caveat requires (new conversations only); a resumed seat (`profile` absent) and a follow-up get nothing, by the same reading. (3) `host-config.ts` does not know the `workers` key (outside this row's Region); `parseHostConfig` ignores it, which a test pins, and the module reads the raw file itself.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/wake-haiku-brief.test.ts`

Closes: a11ign/a11ign#5113

Outside-Region: .changeset/a-spawned-haiku-seat-carries-the-brief.md — the entry a project that pins a tag reads.
Outside-Region: src/remedies-say-pnpm.test.ts — one pinned exemption (`src/haiku-brief.ts: 1`): Anthropic's published verify paragraph says `e.g. npm install`, and the row requires the text verbatim, so the file is listed with its reason and count as that test asks (CI run 38161708363 named it).

platform: checked whether GitHub, pnpm, systemd or git already carry a per-seat prompt addition or a flag file: none does, the tail is a string in the order the wake already builds, and the flag is one key in the host declaration the wake already reads.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
