// a11ign/a11ign#5043, agent-org#979: THE GATE'S SIDE OF THE EVENT QUEUE. `event-receiver.ts` appends one JSON line per accepted delivery; this reads them back, once, in order.
//
// THE CURSOR is a byte offset into the queue, kept in its own file, and it moves ONLY when `ackThrough` is called. A tick that crashes before acking re-reads the same events on the next
// read (at-least-once); the consumer is idempotent because reading a pull request again is harmless. A byte offset, not a line count, so that a half-written last line is simply not consumed.
//
// Reads only the queue and cursor files: no `gh`, no network (a test pins the import list).
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { QueueLine } from "./event-receiver.ts";

export type Scope =
  | { repo: string; kind: "pr" | "issue"; number: number; }
  | { repo: string; kind: "sha" | "merge-group"; sha: string; };

export type ReadResult = {
  events: QueueLine[];
  /** Complete lines after the cursor that did not parse as an event. Named on stderr; never thrown over, never silently dropped. */
  unreadable: number;
  /** The byte offset just past the last complete line read: what to hand `ackThrough` once the events are handled. */
  through: number;
};

const CHECK_EVENTS = ["check_suite", "check_run", "workflow_run"];
const NEWLINE = 0x0a;

/** The cursor, or 0 when there is none. A cursor that is not a whole number is a damaged file, and reading again from the start is harmless, so it is 0 and said. */
function readCursor(cursorPath: string): number {
  if (!existsSync(cursorPath)) return 0;
  const text = readFileSync(cursorPath, "utf8").trim();
  if (/^\d+$/.test(text)) return Number(text);
  process.stderr.write(`event-queue: cursor ${cursorPath} holds ${JSON.stringify(text)}, not a byte offset; reading from the start\n`);
  return 0;
}

function parseEvent(text: string): QueueLine | null {
  let value: any;
  try { value = JSON.parse(text); } catch { return null; }
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if (typeof value.deliveryId !== "string" || typeof value.event !== "string") return null;
  return value as QueueLine;
}

/** The queue lines after the cursor. A last line with no newline is the receiver mid-append: not read, not counted, left for the next call. */
export function readNewEvents({ queuePath, cursorPath }: { queuePath: string; cursorPath: string; }): ReadResult {
  const cursor = readCursor(cursorPath);
  if (!existsSync(queuePath)) return { events: [], unreadable: 0, through: cursor };
  const bytes = readFileSync(queuePath);
  let start = cursor;
  if (cursor > bytes.length) {
    // The queue is shorter than the cursor: it was replaced or truncated. Offsets of the old file mean nothing here, and a re-read is harmless.
    process.stderr.write(`event-queue: cursor ${cursor} is past the end of ${queuePath} (${bytes.length} bytes); reading from the start\n`);
    start = 0;
  }
  let lineNumber = 1;
  for (let index = 0; index < start; index += 1) if (bytes[index] === NEWLINE) lineNumber += 1;

  const events: QueueLine[] = [];
  let unreadable = 0;
  let through = start;
  for (let end = bytes.indexOf(NEWLINE, through); end !== -1; end = bytes.indexOf(NEWLINE, through)) {
    const text = bytes.toString("utf8", through, end).trim();
    if (text !== "") {
      const event = parseEvent(text);
      if (event === null) {
        unreadable += 1;
        process.stderr.write(`event-queue: ${queuePath} line ${lineNumber} is not an event; counted unreadable\n`);
      } else events.push(event);
    }
    through = end + 1;
    lineNumber += 1;
  }
  return { events, unreadable, through };
}

/** Moves the cursor to `through`, atomically (temp file, then rename). The only thing that moves it. */
export function ackThrough({ cursorPath, through }: { cursorPath: string; through: number; }): void {
  if (!Number.isInteger(through) || through < 0) throw new Error(`event-queue: cannot ack through ${through}: not a byte offset`);
  const temporary = `${cursorPath}.tmp`;
  writeFileSync(temporary, `${through}\n`);
  renameSync(temporary, cursorPath);
}

/** What one event names, or null where it names nothing the gate can read (no repository, or no number and no commit). */
function scopeOf(event: QueueLine): Scope | null {
  const { repo, number, sha } = event;
  if (typeof repo !== "string" || repo === "") return null;
  if (event.event === "merge_group") return typeof sha === "string" && sha !== "" ? { repo, kind: "merge-group", sha } : null;
  if (event.event === "issues" || event.event === "issue_comment") return Number.isInteger(number) ? { repo, kind: "issue", number: number as number } : null;
  if (event.event === "pull_request" || event.event === "pull_request_review" || CHECK_EVENTS.includes(event.event)) {
    // A check or workflow event with a pull request number is that pull request; with none it is the commit.
    if (Number.isInteger(number)) return { repo, kind: "pr", number: number as number };
    return typeof sha === "string" && sha !== "" ? { repo, kind: "sha", sha } : null;
  }
  return null;
}

/** The distinct things the events name, in first-seen order: two events for one pull request are one scope. */
export function scopesOf(events: QueueLine[]): Scope[] {
  const seen = new Set<string>();
  const scopes: Scope[] = [];
  for (const event of events) {
    const scope = scopeOf(event);
    if (scope === null) continue;
    const key = `${scope.repo}\n${scope.kind}\n${"number" in scope ? scope.number : scope.sha}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push(scope);
  }
  return scopes;
}

/** The repositories with at least one event, each once, in first-seen order. */
export function changedRepos(events: QueueLine[]): string[] {
  return [...new Set(events.flatMap((event) => (typeof event.repo === "string" && event.repo !== "" ? [event.repo] : [])))];
}
