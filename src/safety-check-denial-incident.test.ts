// no-token: gh -- no `gh`, `herdr` or network is touched; transcripts are fixtures, the live read is pointed at a temporary directory (a11ign/a11ign#4957 sixth class)
// A removal Claude Code's built-in safety check DENIED is a `safety-check-denied` ledger incident, one per session per UTC day, naming the command shape.
//
// WHAT COUNTS IS THE CONTROL THAT MATTERS: a `tool_result` whose content STARTS with the denial sentence. The QUOTE cases carry the same sentence in a place that is not a denial, and
// each has a twin (`line` below, with one thing changed) that IS one, so a reader that never fires and one that matches the phrase anywhere in the line both turn a test red.
// The mutations, both directions, are in the pull request.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FAILURE_KINDS, FAILURE_LEDGER_FILE, parseFailureLedger, recordFailures } from "./failure-ledger.ts";
import { buildReport, readSafetyCheckDenials, renderReport, retrospectiveTick } from "./org-retro.ts";
import { DENIAL_SENTENCE, SAFETY_CHECK_DENIED, denialShape, safetyCheckDenialEvents, safetyCheckDenialSummary, safetyCheckDenials } from "./safety-check-denial-incident.ts";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const DENIAL = `${DENIAL_SENTENCE} The check stops removals that can delete far more than intended. What was flagged: Dangerous rm operation detected: '/home/agent/repos/wt-3964/*'`;

const NESTED = `S=/tmp/x/scratch; mkdir -p $S/ao && bash -c 'cd $S/ao && rm -rf ./* && node -e "require(\\"fs\\").rmSync(\\"x\\")"'`;

/** One transcript record. `cwd` and `sessionId` are the harness's own fields on every record. */
const record = (over: Record<string, unknown>, message: unknown) => JSON.stringify({ type: "user", cwd: "/home/agent/repos/wt-3964", sessionId: "230c6775", timestamp: "2026-10-11T07:56:37.876Z", message, ...over });
const use = (id: string, command: string, over: Record<string, unknown> = {}) => record({ type: "assistant", ...over }, { role: "assistant", content: [{ type: "tool_use", id, name: "Bash", input: { command } }] });
const result = (id: string, content: unknown, over: Record<string, unknown> = {}) => record(over, { role: "user", content: [{ type: "tool_result", tool_use_id: id, content, is_error: true }] });
const transcript = (...lines: string[]) => `${lines.join("\n")}\n`;
const found = (text: string, rest: { file?: string, since?: number } = {}) => safetyCheckDenials({ text, ...rest });

test("POSITIVE CONTROL: a tool_result opening with the denial sentence, for a `bash -c '...; node -e \"...\"'` holding rm, is one nested-shell-c incident", () => {
  const incidents = found(transcript(use("t1", NESTED), result("t1", DENIAL)));
  assert.equal(incidents?.length, 1);
  assert.deepEqual(incidents?.[0], { cwdDir: "wt-3964", session: "230c6775", day: "2026-10-11", shape: "nested-shell-c", denials: 1, ref: "wt-3964/230c6775@2026-10-11 nested-shell-c" });
});

test("QUOTE: the same sentence in an assistant text block, a user message or the middle of a tool_result is not a denial", () => {
  const quoted = [
    record({ type: "assistant" }, { role: "assistant", content: [{ type: "text", text: `The check says: ${DENIAL}` }] }),
    record({}, { role: "user", content: `the order says "${DENIAL_SENTENCE}" and the engineer brief repeats it` }),
    record({}, { role: "user", content: [{ type: "text", text: DENIAL }] }),
    use("t1", "gh issue view 874"),
    result("t1", `Parent: a11ign#4957 ...\n\n**Claude Code's removal check denies a command with the text "${DENIAL_SENTENCE}"**`),
    result("t1", `  ${DENIAL}`),
  ];
  assert.deepEqual(found(transcript(...quoted)), [], "every line quotes the sentence and none is a denial");
  // THE TWIN: the one line that is a denial, among the same quotes, is the only incident.
  const withReal = found(transcript(...quoted, use("t2", NESTED), result("t2", DENIAL)));
  assert.equal(withReal?.length, 1);
  assert.equal(withReal?.[0].denials, 1);
});

test("a tool_result whose content is a list of text blocks is read by its first block", () => {
  const listed = found(transcript(use("t1", NESTED), result("t1", [{ type: "text", text: DENIAL }])));
  assert.equal(listed?.[0]?.shape, "nested-shell-c");
  assert.deepEqual(found(transcript(use("t1", NESTED), result("t1", [{ type: "text", text: `see: ${DENIAL}` }]))), []);
});

test("the four shapes, each with its twin that is another shape", () => {
  const shape = (command: string) => denialShape(command);
  assert.equal(shape("bash -c 'cd /x && rm -rf y'"), "nested-shell-c");
  assert.equal(shape("sh -lc \"rm -rf y\""), "nested-shell-c");
  assert.equal(shape("bash -c 'docker run --rm img'"), "other", "`--rm` is a flag, not a removal");
  assert.equal(shape(`node -e "require('fs').rmSync('x', { recursive: true })"`), "node-e-rm");
  assert.equal(shape(`python3 -c "import os; os.unlink('x')"`), "node-e-rm");
  assert.equal(shape(`node -e "console.log(1)"`), "other", "a `node -e` with no removal in the script");
  assert.equal(shape("rm -rf $DIR/build"), "variable-target");
  assert.equal(shape("cd /x && rm -rf ./*"), "variable-target");
  assert.equal(shape("rm -rf /x/build; echo $HOME"), "other", "the `$` is in another command, not rm's argument");
  assert.equal(shape("git clean -fdx"), "other");
  assert.equal(denialShape(null), "other");
});

test("a denial whose tool_use cannot be found is `other`, never dropped", () => {
  const incidents = found(transcript(result("never-seen", DENIAL)));
  assert.deepEqual(incidents?.map((i) => [i.shape, i.denials]), [["other", 1]]);
});

test("one incident per session per UTC day however many denials; another day or another session is another incident", () => {
  const text = transcript(
    use("a", NESTED), result("a", DENIAL),
    use("b", "rm -rf $X/y"), result("b", DENIAL, { timestamp: "2026-10-11T23:59:59.000Z" }),
    use("c", "rm -rf $X/y"), result("c", DENIAL, { timestamp: "2026-10-12T00:00:01.000Z" }),
    use("d", NESTED), result("d", DENIAL, { sessionId: "other-session" }),
    use("e", NESTED), result("e", DENIAL, { cwd: "/home/agent/repos/wt-4899" }),
  );
  const incidents = found(text) ?? [];
  assert.deepEqual(incidents.map((i) => [i.ref, i.denials]), [
    ["wt-3964/230c6775@2026-10-11 nested-shell-c", 2],
    ["wt-3964/230c6775@2026-10-12 variable-target", 1],
    ["wt-3964/other-session@2026-10-11 nested-shell-c", 1],
    ["wt-4899/230c6775@2026-10-11 nested-shell-c", 1],
  ]);
});

test("`since` reports a session-day only if one of its denials is in the window, and the ref is the day's first denial's shape whenever the window began", () => {
  const text = transcript(
    use("a", NESTED), result("a", DENIAL, { timestamp: "2026-10-11T01:00:00.000Z" }),
    use("b", "rm -rf $X/y"), result("b", DENIAL, { timestamp: "2026-10-11T20:00:00.000Z" }),
  );
  const refs = (since: number) => found(text, { since })?.map((i) => i.ref);
  assert.deepEqual(refs(Date.parse("2026-10-11T00:00:00Z")), ["wt-3964/230c6775@2026-10-11 nested-shell-c"]);
  assert.deepEqual(refs(Date.parse("2026-10-11T10:00:00Z")), ["wt-3964/230c6775@2026-10-11 nested-shell-c"], "only the later denial is in the window; the ref is still the day's first");
  assert.deepEqual(refs(Date.parse("2026-10-11T21:00:00Z")), [], "twin: nothing of the day is in the window");
});

test("a record with no cwd or sessionId is keyed by the transcript's own path, not dropped", () => {
  const text = transcript(use("a", NESTED), result("a", DENIAL, { cwd: undefined, sessionId: undefined }));
  const incidents = found(text, { file: "/home/u/.claude/projects/-home-agent-repos-wt-3964/abc-123.jsonl" });
  assert.equal(incidents?.[0]?.ref, "-home-agent-repos-wt-3964/abc-123@2026-10-11 nested-shell-c");
});

test("null is not zero: a line that is not JSON in a transcript that holds the sentence reads null; one that never says it is []", () => {
  assert.equal(found(`${transcript(use("a", NESTED), result("a", DENIAL))}{"half a line`), null);
  assert.deepEqual(found(`${transcript(use("a", "ls"))}{"half a line`), [], "no denial can be in a file that never says the sentence");
  assert.deepEqual(found(""), []);
});

test("events are keyed `safety-check-denied`, which is an event kind and not one of FAILURE_KINDS; a standing session-day is one ledger line", () => {
  assert.equal(SAFETY_CHECK_DENIED, "safety-check-denied");
  assert.ok(!FAILURE_KINDS.includes(SAFETY_CHECK_DENIED));
  const dir = mkdtempSync(join(tmpdir(), "safety-denial-ledger-"));
  try {
    const logPath = join(dir, "failure-ledger");
    const events = safetyCheckDenialEvents(found(transcript(use("a", NESTED), result("a", DENIAL))) ?? []);
    assert.equal(recordFailures({ logPath, events, now: NOW }).appended, 1);
    assert.equal(recordFailures({ logPath, events, now: NOW + 60_000 }).appended, 0);
    assert.deepEqual(parseFailureLedger(readFileSync(logPath, "utf8")).map((e) => [e.classKey, e.ref]), [[SAFETY_CHECK_DENIED, "wt-3964/230c6775@2026-10-11 nested-shell-c"]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the summary: denials, session-days, the first three refs and the unreadable count; an unread population is null, never 0", () => {
  const incidents = found(transcript(...["a", "b", "c", "d"].flatMap((id) => [use(id, NESTED), result(id, DENIAL, { sessionId: id })]))) ?? [];
  const summary = safetyCheckDenialSummary({ incidents, unreadable: 2 });
  assert.deepEqual({ count: summary?.count, denials: summary?.denials, unreadable: summary?.unreadable, first: summary?.first.length }, { count: 4, denials: 4, unreadable: 2, first: 3 });
  assert.deepEqual(safetyCheckDenialSummary({ incidents: [], unreadable: 0 }), { count: 0, denials: 0, unreadable: 0, first: [] });
  assert.equal(safetyCheckDenialSummary(null), null);
  assert.equal(safetyCheckDenialSummary(undefined), null);
});

// ---------------------------------------------------------------------------------------------------------------------
// The live read and the daily pass.

test("readSafetyCheckDenials: reads each transcript touched in the window, counts an unparseable one apart, skips a stale one, and is null for a root that cannot be listed", () => {
  const root = mkdtempSync(join(tmpdir(), "safety-denial-root-"));
  try {
    const put = (project: string, name: string, text: string, mtime: number) => {
      mkdirSync(join(root, project), { recursive: true });
      const file = join(root, project, name);
      writeFileSync(file, text);
      utimesSync(file, mtime / 1000, mtime / 1000);
    };
    const since = NOW - 24 * 3_600_000;
    const real = transcript(use("a", NESTED), result("a", DENIAL, { timestamp: "2026-10-11T08:00:00.000Z" }));
    put("-wt-3964", "s1.jsonl", real, NOW - 1000);
    put("-wt-4899", "s2.jsonl", `${real}{"torn`, NOW - 1000);
    put("-wt-old", "s3.jsonl", real, since - 3_600_000);
    put("-wt-clean", "s4.jsonl", transcript(use("a", "ls")), NOW - 1000);
    const reading = readSafetyCheckDenials({ since, root });
    assert.deepEqual(reading?.incidents.map((i) => i.ref), ["wt-3964/230c6775@2026-10-11 nested-shell-c"]);
    assert.equal(reading?.unreadable, 1);
    assert.equal(readSafetyCheckDenials({ since, root: join(root, "no-such-dir") }), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

const emptyReads = { merged: null, openPrs: null, journal: null, ledger: null, turns: null, handFixes: null };

test("the report prints the denials, the session-days and the first refs; unknown when the read was refused; names what could not be read", () => {
  const incidents = found(transcript(use("a", NESTED), result("a", DENIAL))) ?? [];
  const text = renderReport(buildReport({ ...emptyReads, safetyDenials: { incidents, unreadable: 0 } }, NOW));
  assert.match(text, /safety check denied in session transcripts: 1 in 1 session-days; first: wt-3964\/230c6775@2026-10-11 nested-shell-c\n/);
  assert.match(renderReport(buildReport({ ...emptyReads, safetyDenials: { incidents: [], unreadable: 0 } }, NOW)), /session transcripts: 0 in 0 session-days\n/);
  assert.match(renderReport(buildReport({ ...emptyReads, safetyDenials: { incidents: [], unreadable: 3 } }, NOW)), /: 0 in 0 session-days; 3 transcripts could not be read \(unknown, not counted\)\n/);
  assert.match(renderReport(buildReport({ ...emptyReads, safetyDenials: null }, NOW)), /session transcripts: unknown /);
  assert.match(renderReport(buildReport(emptyReads, NOW)), /session transcripts: unknown /);
});

test("the daily tick records each denied session-day once in the failure ledger", () => {
  const dir = mkdtempSync(join(tmpdir(), "safety-denial-tick-"));
  try {
    const incidents = found(transcript(use("a", NESTED), result("a", DENIAL))) ?? [];
    const inputs = { ...emptyReads, safetyDenials: { incidents, unreadable: 0 } };
    const tick = (now: number) => retrospectiveTick({ now, stateDir: dir, log: () => {}, read: () => inputs, readLedger: () => "", readUntiered: () => null, record: () => "recorded" });
    assert.equal(tick(NOW).length, 1);
    tick(NOW + 5 * 60_000);
    const entries = parseFailureLedger(readFileSync(join(dir, FAILURE_LEDGER_FILE), "utf8"));
    assert.deepEqual(entries.map((e) => [e.classKey, e.ref]), [[SAFETY_CHECK_DENIED, "wt-3964/230c6775@2026-10-11 nested-shell-c"]]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
