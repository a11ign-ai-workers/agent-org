// @ts-check
// module: what a spawned HAIKU seat's first order adds, behind `workers.haikuBrief` (a11ign#5113, the wake half of a11ign#5111; the Haiku push, chairman, 2026-10-11)
//
// A Haiku worker is sent the engineer brief a Sonnet one is, so nothing told it the two things Anthropic's "Prompting Claude Haiku 5.5" says the model gets wrong: at low effort it
// stops early and hands the task back, and at low and medium effort it reports a code change done without running a check. This is the page's own text for both, plus one line of ours
// on quoting; `addressed` (`wake.ts`) appends it after `blastTail` for a SPAWNED seat started on a Haiku model and for nothing else.
//
// THE STRINGS ARE THE PAGE'S, EXTRACTED BY COMMAND AND NOT RETYPED: the PR shows the `curl` and `grep` the three came from, and {@link PUBLISHED_TEXT_SHA256} is the
// digest of the three joined with `\n`, so a reader can re-derive it from the page and see this file still says what the page says.
//
// OFF BY DEFAULT, AND OFF IS BYTE-IDENTICAL (a11ign#5100's rule for machinery that touches waking): the flag is `workers.haikuBrief` in the host declaration, read HERE and not in
// `host-config.ts` (whose `HostConfig` has no such key, and whose parser ignores one), as exactly `true`. A flag that is absent, `false`, or anything else is off, and the file is read only
// for a seat that is already spawned AND on Haiku, so no other order pays for the read. The placement is the page's own caveat: new conversations only, never a mid-session system
// change, which is why this is in the first-contact preamble and a follow-up (which `addressed` returns before it) never carries it.
import { readFileSync } from "node:fs";
import { isHaiku } from "./engineer-escalation.ts";
import { hostConfigPath } from "./host-config.ts";

/** The flag's key in the host declaration, as `workers.haikuBrief`. */
export const HAIKU_BRIEF_FLAG = "workers.haikuBrief";

/** "Prevent early stopping in long agent prompts": the two sentences the page says to add to the system prompt. */
export const STOP_EARLY_TEXT = "Keep working until everything the user asked for is done, and only stop to ask when you can't go on without the user or before a risky step.\nWhen the work the user asked for is done and checked, stop and report. Don't add new features, docs, or refactors that weren't asked for. If you think one would help, mention it at the end instead of doing it.";
/** "Tell coding agents to verify their changes": the paragraph the page says to add to the system prompt. */
export const VERIFY_TEXT = "When you change code that can be run, built, or type-checked, run a real check that exercises the change before reporting it done: the project's tests, type-checker, or build, or the changed command itself. A syntax-only check, or a check command that failed to start, does not count; if all that is missing is the project's declared dependencies, install them with its own package manager and lockfile (e.g. npm install, pip install -r requirements.txt), never via sudo or the system package manager, unless told not to. Only if no real check can run here, say which one you did not run and why instead of reporting the change as done.";
/** Ours, not the page's, and the one line the row (a11ign#5113) adds to it: file text is quoted from what `sed` or `grep` printed. */
export const QUOTE_LINE = "When you quote text from a file, copy it from `sed` or `grep` output and never retype it from memory.";
/** `sha256` of {@link STOP_EARLY_TEXT} and {@link VERIFY_TEXT} joined with `\n`: what the page's three lines hash to, read off the page on 2026-10-11. */
export const PUBLISHED_TEXT_SHA256 = "aac0acc50654090556cfb8f2849082c583683e053376698be10445f0978c5a06";

/** The lines already written, so a host file that stays unreadable is said once per process and not once per delivery. */
const said = new Set<string>();

/**
 * Whether the host declaration turns the brief on: `workers.haikuBrief` is exactly `true`. An absent file or key is the ordinary case and says nothing; a file that cannot be read or
 * parsed, or a value that is present and not a boolean, is OFF and is SAID once, because a flag the operator meant to set that silently does nothing is the failure to see.
 * A wake is never refused for this.
 */
export function haikuBriefEnabled({ path = hostConfigPath(), read = (file: string) => readFileSync(file, "utf8"), log = (line: string) => process.stderr.write(`${line}\n`) }:
  { path?: string; read?: (path: string) => string; log?: (line: string) => void } = {}): boolean {
  const say = (line: string) => {
    if (said.has(line)) return;
    said.add(line);
    log(line);
  };
  let declared: unknown;
  try {
    declared = JSON.parse(read(path));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code !== "ENOENT") say(`haiku-brief: ${path} could not be read (${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}); ${HAIKU_BRIEF_FLAG} is off`);
    return false;
  }
  const workers = (declared as { workers?: unknown } | null)?.workers;
  const flag = typeof workers === "object" && workers !== null ? (workers as { haikuBrief?: unknown }).haikuBrief : undefined;
  if (flag !== undefined && typeof flag !== "boolean") say(`haiku-brief: ${HAIKU_BRIEF_FLAG} in ${path} is ${JSON.stringify(flag)}, not true or false; it is off`);
  return flag === true;
}

/**
 * THE TAIL, as the end of a SPAWNED seat's first order (`\n\n` first), or `""`. `model` is the id the seat was started with ({@link isHaiku}'s reading, the one the claim-orders record
 * and the escalation use); a seat with no profile (a resume into its worktree, #2470) has none and gets nothing, as does a Sonnet seat. The model is asked before the flag, so a Sonnet
 * seat never reads the host file. `enabled` is the seam a test hands.
 */
export function haikuBriefTail(model: string | null | undefined, { enabled = haikuBriefEnabled }: { enabled?: () => boolean } = {}): string {
  if (!isHaiku(model ?? null) || !enabled()) return "";
  return `\n\nTwo things Anthropic's guidance for Claude Haiku 5.5 says this model gets wrong, so they are said here once:\n\n${STOP_EARLY_TEXT}\n\n${VERIFY_TEXT}\n\n${QUOTE_LINE}`;
}
