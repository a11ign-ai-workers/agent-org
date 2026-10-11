// @ts-check
// module: a removal Claude Code's safety check DENIED is a LEDGER INCIDENT, class `safety-check-denied` (a11ign/a11ign#4957 sixth class, chairman 2026-10-11)
//
// CHAIRMAN, 2026-10-11 (#4957): 12 agent-org workers sat idle on claimed rows for up to 10 hours, three of them on a denied removal (`wt-4947`, `wt-4899` and one more), found by hand.
// Claude Code's critical-path removal check is deliberate and is NOT auto-allowed, so the control is the engineer brief (a11ign#4966); this leaf is the detector that says whether
// the brief is enough: a count above zero names the session and the command shape, so the brief's rule can be tightened.
//
// PURE: one transcript's text in, incidents and ledger events out; no file, no clock, no `gh`. The live read (which transcripts, the window, the `null` for a root nobody could list)
// is `org-retro.ts`'s `readSafetyCheckDenials`. The event shape is `failure-ledger.ts`'s `FailureEvent`, the one `idle-claim-incident.ts` imports and does not re-export.
//
// KNOWN UNCOVERED: a removal the chairman APPROVED leaves no denial in the transcript (worker-agent-org-852's was approved by a click), so only the DENIED ones are seen here.
// That is what the brief's rule is for.
import type { FailureEvent } from "./failure-ledger.ts";

/** The failure-ledger class key, an event kind like `row-not-finishable`; NOT in `FAILURE_KINDS`, for the reason `CHAIRMAN_LABEL_NOT_CHAIRMAN_KIND` (`failure-ledger.ts`) states. */
export const SAFETY_CHECK_DENIED = "safety-check-denied";

/** The sentence Claude Code's result opens with when its built-in safety check, and no person, denied a command. */
export const DENIAL_SENTENCE = "Permission for this command was denied by a built-in Claude Code safety check, not by the user.";

/** What the denied command looked like, as the brief's rules name them (`engineer.md`, "Removal commands the safety check cannot read"). */
export type DenialShape = "nested-shell-c" | "node-e-rm" | "variable-target" | "other";

/** One session's denials on one UTC day: `shape` is the FIRST denial's, `denials` how many there were. */
export type SafetyCheckDenialIncident = { cwdDir: string, session: string, day: string, shape: DenialShape, denials: number, ref: string };

// `rm` as a command word: not `--rm` (a docker flag), not `rmSync`, not `form`.
const RM = /(?<![\w-])rm(?![\w-])/;
const SHELL_C = /(?<![\w-])(?:ba|z|da)?sh\s+-[A-Za-z]*c\b/;
const INTERPRETER_E = /(?<![\w-])(?:node(?:js)?|python3?)\s+(?:[^\s'"]+\s+)*?(?:-e|--eval|-p|--print|-c)\s/;
const SCRIPT_REMOVAL = /(?<![\w-])(?:rm|rmSync|rmdirSync|unlink|unlinkSync|rmtree)(?![\w-])/;

/** Whether some `rm` in `command` has an argument that is a `$VAR` or a glob: the target the check cannot resolve statically. */
function hasVariableTarget(command: string): boolean {
  return command.split(/\r?\n|[;|&]+/).some((segment) => {
    const at = segment.search(RM);
    return at >= 0 && /[$*]/.test(segment.slice(at + 2));
  });
}

/**
 * THE SHAPE OF A DENIED COMMAND. Most specific first: a `bash -c`/`sh -c` whose script holds an `rm` is `nested-shell-c` even when the script then runs `node -e` (the quoting that nests
 * is what the check cannot read); then `node -e`/`python -c` with a removal in the script; then an `rm` whose target is a `$VAR` or a glob; anything else, and a command nobody could
 * find (`null`), is `other`: a denial is never dropped for want of a shape.
 */
export function denialShape(command: string | null): DenialShape {
  if (command === null) return "other";
  const shell = SHELL_C.exec(command);
  if (shell !== null && RM.test(command.slice(shell.index))) return "nested-shell-c";
  const interpreter = INTERPRETER_E.exec(command);
  if (interpreter !== null && SCRIPT_REMOVAL.test(command.slice(interpreter.index))) return "node-e-rm";
  if (hasVariableTarget(command)) return "variable-target";
  return "other";
}

type Block = { type?: unknown, id?: unknown, tool_use_id?: unknown, input?: { command?: unknown }, content?: unknown };

/** The text a `tool_result` carries: its string content, or the first text block of a list. `null` for anything else. */
function resultText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const first = content[0];
  return typeof first?.text === "string" ? first.text : null;
}

const basename = (path: string): string => path.split("/").filter((part) => part !== "").pop() ?? "";

/**
 * THE INCIDENTS IN ONE TRANSCRIPT. WHAT COUNTS is a `tool_result` block whose content STARTS with {@link DENIAL_SENTENCE}: a line that merely QUOTES the sentence (an assistant text
 * block, a user message, a file read that holds it mid-content) is not a denial, and a search of the whole line for the phrase over-counts exactly there.
 *
 * ONE PER SESSION PER UTC DAY of the result's `timestamp`, however many denials; the key is the record's `cwd` directory name and `sessionId` (the transcript's `file`, as
 * `<project dir>/<session id>.jsonl`, stands in for a record that carries neither). The shape is read from the `tool_use` with the matching `tool_use_id`, the FIRST denial of the
 * day's, so a later denial of another shape does not make a second ref. `since` (ms) reports a session-day only when one of its denials is at or after it, so a day's count is the
 * window's, and the shape is still the day's first denial, whenever the window began: the ref is the same on every pass that sees the day.
 *
 * @returns `null` for a transcript with a line that is not JSON (a lower bound must not look like a count, as `transcriptCounts` in `engineer-escalation.ts`); a transcript that does
 * not hold the sentence at all is `[]` without being parsed, since no denial can be in a file that never says it.
 */
export function safetyCheckDenials({ text, file = "", since = Number.NEGATIVE_INFINITY }: { text: string, file?: string, since?: number }): SafetyCheckDenialIncident[] | null {
  if (!text.includes(DENIAL_SENTENCE)) return [];
  const fileDir = basename(file.slice(0, Math.max(0, file.lastIndexOf("/"))));
  const fileSession = basename(file).replace(/\.jsonl$/, "");
  const commands = new Map<string, string>();
  const days = new Map<string, SafetyCheckDenialIncident & { latest: number }>();
  for (const line of text.split("\n")) {
    if (line.trim() === "") continue;
    let record: any;
    try { record = JSON.parse(line); } catch { return null; }
    const content = record?.message?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content as Block[]) {
      if (block?.type === "tool_use" && typeof block.id === "string" && typeof block.input?.command === "string") commands.set(block.id, block.input.command);
      if (block?.type !== "tool_result") continue;
      if (!(resultText(block.content)?.startsWith(DENIAL_SENTENCE) ?? false)) continue;
      const at = Date.parse(String(record.timestamp));
      if (!Number.isFinite(at)) continue;
      const cwdDir = (typeof record.cwd === "string" ? basename(record.cwd) : "") || fileDir || "unknown-dir";
      const session = (typeof record.sessionId === "string" ? record.sessionId : "") || fileSession || "unknown-session";
      const day = new Date(at).toISOString().slice(0, 10);
      const key = `${cwdDir}/${session}@${day}`;
      const seen = days.get(key);
      if (seen !== undefined) { seen.denials += 1; seen.latest = Math.max(seen.latest, at); continue; }
      const shape = denialShape(typeof block.tool_use_id === "string" ? commands.get(block.tool_use_id) ?? null : null);
      days.set(key, { cwdDir, session, day, shape, denials: 1, ref: `${key} ${shape}`, latest: at });
    }
  }
  return [...days.values()].filter(({ latest }) => latest >= since).map(({ latest: _latest, ...incident }) => incident);
}

/** The ledger events: one per incident (`recordFailures` skips a (key, ref) already logged, so a session-day the daily pass sees twice is one line). */
export function safetyCheckDenialEvents(incidents: SafetyCheckDenialIncident[]): FailureEvent[] {
  return incidents.map(({ ref }) => ({ classKey: SAFETY_CHECK_DENIED, ref }));
}

/** What the live read holds: the incidents, and how many transcripts it could not read (unknown, never counted as clean). */
export type SafetyCheckDenialReading = { incidents: SafetyCheckDenialIncident[], unreadable: number };

const FIRST_REFS = 3;

/** What the daily pass prints. `null` is a read nobody could make (`unknown`, never 0); `unreadable` is how many transcripts were skipped inside a read that was made. */
export function safetyCheckDenialSummary(reading: SafetyCheckDenialReading | null | undefined): { count: number, denials: number, unreadable: number, first: string[] } | null {
  if (reading === null || reading === undefined) return null;
  const { incidents, unreadable } = reading;
  return { count: incidents.length, denials: incidents.reduce((sum, { denials }) => sum + denials, 0), unreadable, first: incidents.slice(0, FIRST_REFS).map(({ ref }) => ref) };
}
