// agent-org#478: a compaction's SUMMARY CALL is in the trace store with its tokens and cost, where the usage is readable, and is `unmeasured` (never 0) where it is not.
// WHERE THE USAGE IS, measured on Claude Code 2.1.296 and on the 1,351 compactions of the transcripts of the last 14 days: NOT in the transcript (the summary is a `user` record with no
// `usage`, `compact_boundary` carries `preTokens`/`postTokens`/`durationMs` only, and no record inside the call's window has a usage), and IN the exporter's `api_request` with
// `query_source: "compact"`. The `REQUEST` below is that request, field for field, from a live `/compact` of a probe session (its transcript holds the same compaction with none).
// Fixtures only: nothing here reads `~/.claude`, `~/.cache/a11ign` or GitHub.
// no-token: none -- no test here calls `gh`
import assert from "node:assert/strict";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { aggregate, renderAggregate } from "../trace/aggregate.ts";
import { eventsOfOtlpLogs } from "../trace/otel-receiver.ts";
import { appendToStore, costOf, eventsOfTranscript, measureCompactions, NO_USAGE_RECORD, openStore, readStore, repriceEvents, SUMMARY_MATCH_MS, withCompactionUsage } from "../trace/store.ts";
import type { SummaryRequest, TraceEvent } from "../trace/store.ts";
import { ingestTranscripts } from "../trace/trace.ts";
import { tmpDir } from "../lib/tmp-fixture.ts";

const ROW_REPO = "a11ign/a11ign";
const SESSION_ID = "d932fffc-b627-42b0-bb1a-5a69060624ef";
const FILE = `/projects/-probe/${SESSION_ID}.jsonl`;
const T0 = Date.parse("2026-10-10T22:17:00Z");
const stamp = (seconds: number) => new Date(T0 + seconds * 1000).toISOString();
const lines = (records: object[]) => `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
const near = (actual: unknown, expected: number) => assert.ok(Math.abs(actual as number - expected) < 1e-9, `${actual} is not ${expected}`);

const order = { type: "user", timestamp: stamp(0), message: { role: "user", content: "<pasted_content id=\"a\">You are `worker-agent-org-478`. Row #478.</pasted_content id=\"a\">" } };
const turn = (id: string, seconds: number, usage: { input: number; output: number; read: number; write: number; }) => ({
  type: "assistant", timestamp: stamp(seconds), isSidechain: false,
  message: { id, model: "claude-sonnet-5-5", role: "assistant", content: [{ type: "text", text: "ok" }],
    usage: { input_tokens: usage.input, output_tokens: usage.output, cache_read_input_tokens: usage.read, cache_creation_input_tokens: usage.write } },
});
// What a transcript holds of one compaction (measured): the boundary and the summary, both stamped when the call ended, and no assistant record for the call.
const boundary = (seconds: number) => ({ type: "system", subtype: "compact_boundary", timestamp: stamp(seconds), compactMetadata: { trigger: "manual", preTokens: 7300, postTokens: 2570, durationMs: 3628 } });
const summary = (seconds: number) => ({ type: "user", timestamp: stamp(seconds), isCompactSummary: true, message: { role: "user", content: "This session is being continued from a previous conversation" } });

const BEFORE = turn("m-before", 5, { input: 2, output: 70, read: 8890, write: 13525 });
const AFTER = turn("m-after", 40, { input: 1000, output: 100, read: 50_000, write: 0 });
const ONE_COMPACTION = lines([order, BEFORE, boundary(21.465), summary(21.464), AFTER]);

const read = (text: string) => eventsOfTranscript({ text, file: FILE, ledger: [], rowRepo: ROW_REPO }).events;
const compactionsOf = (events: TraceEvent[]) => events.filter((event) => event.kind === "compaction");

/** The probe's request, as `otel-receiver.ts` stores it: 5 ms before the summary record, `query_source: "compact"`. */
const REQUEST = {
  id: "otel:req_011CfuL9492Jj3AarsEuAEvr", kind: "api_request", source: "otel", at: T0 + 21_459, session: "worker-agent-org-478-probe", role: "worker-agent-org-478-probe", pane: null,
  row: null, pr: null, repo: null, cause: null, causeKey: null, wakeId: null, requestId: "req_011CfuL9492Jj3AarsEuAEvr", promptId: "835e208e-03b7-47eb-ace6-7d531ccc4bae", sessionId: SESSION_ID,
  model: "claude-haiku-5-5", usage: { input: 1998, output: 646, cacheRead: 22415, cacheCreation: 70 }, clientCostUsd: 0.0007557, durationMs: 3545, effort: "high", querySource: "compact",
} as unknown as SummaryRequest & TraceEvent;
// Haiku 5.5 is $0.10 in, $0.50 out, $0.01 read per MTok and a cache write at the 1-hour rate (x2), as the store's COST definition says: (1998 x 0.1 + 646 x 0.5 + 22415 x 0.01 + 70 x 0.2) / 1e6.
const REQUEST_COST = (199.8 + 323 + 224.15 + 14) / 1e6;

test("a compaction with a readable summary usage stores its tokens, its model and a priced costUsd", () => {
  const [made] = measureCompactions(compactionsOf(read(ONE_COMPACTION)), [REQUEST]);
  assert.equal(made.kind, "compaction");
  assert.deepEqual(made.tokens, { input: 1998, output: 646, cacheRead: 22415, cacheWrite5m: 0, cacheWrite1h: 70 });
  assert.equal(made.model, "claude-haiku-5-5");
  near(made.costUsd, REQUEST_COST);
  assert.equal(made.costUsd, costOf("claude-haiku-5-5", made.tokens as NonNullable<typeof made.tokens>), "priced by costOf, as a turn is");
  assert.equal(made.unmeasured, undefined, "a measured compaction carries no unmeasured marker");
  assert.equal(made.id, compactionsOf(read(ONE_COMPACTION))[0].id, "the same event, corrected: it replaces the stored one and adds none");
});

test("NEGATIVE CONTROL: a compaction with no usage record stores costUsd null and the unmeasured marker, not 0", () => {
  const [bare] = compactionsOf(read(ONE_COMPACTION));
  assert.equal(bare.costUsd, null);
  assert.equal(bare.unmeasured, NO_USAGE_RECORD);
  assert.equal(bare.tokens, undefined, "no tokens are invented for a call nobody recorded");
  const [still] = measureCompactions([bare], []);
  assert.deepEqual(still, bare, "no request at all leaves it as it was");
  // What is NOT the summary call, each one a request the join must pass over: a turn's own request (query_source repl_main_thread), another session's compaction, one too far from
  // the summary record, and a request that cannot be priced because a count is missing.
  const others: (SummaryRequest & TraceEvent)[] = [
    { ...REQUEST, id: "otel:turn", querySource: "repl_main_thread" } as never, { ...REQUEST, id: "otel:other", sessionId: "another-session" } as never,
    { ...REQUEST, id: "otel:late", at: bare.at + SUMMARY_MATCH_MS + 1 } as never, { ...REQUEST, id: "otel:partial", usage: { ...REQUEST.usage, output: null } } as never,
  ];
  assert.deepEqual(measureCompactions([bare], others), [bare], "none of them is its call");
  assert.equal(measureCompactions([bare], others)[0].costUsd, null, "and a compaction nothing measured is never priced 0");
});

test("a compaction whose model has no price is costUsd null with its tokens kept, never 0", () => {
  const [made] = measureCompactions(compactionsOf(read(ONE_COMPACTION)), [{ ...REQUEST, model: "claude-unpriced-9" } as never]);
  assert.equal(made.costUsd, null);
  assert.equal(made.tokens?.output, 646);
  assert.equal(made.unmeasured, undefined, "the usage was read; only the price is missing");
  const [nameless] = measureCompactions(compactionsOf(read(ONE_COMPACTION)), [{ ...REQUEST, model: null } as never]);
  assert.equal(nameless.costUsd, null, "a request that names no model cannot be priced either: null, not 0");
  assert.equal(nameless.tokens?.output, 646);
  assert.equal(nameless.model, undefined, "and no model is guessed for it");
});

test("a transcript with one compaction gives one compaction event and no new turn", () => {
  const events = read(ONE_COMPACTION);
  assert.equal(compactionsOf(events).length, 1);
  const turnIds = events.filter((event) => event.kind === "turn").map((event) => event.id).sort();
  assert.equal(turnIds.length, 2, "the two messages the transcript holds, and not a third for the summary call");
  const after = withCompactionUsage(events, [REQUEST]);
  assert.equal(after.length, events.length, "joining the request adds no event");
  assert.deepEqual(after.filter((event) => event.kind === "turn"), events.filter((event) => event.kind === "turn"), "and changes no turn: the turn after re-reads the window and is priced as it was");
  assert.equal(compactionsOf(after).length, 1);
  assert.equal(compactionsOf(after)[0].tokens?.output, 646);
});

test("a compaction stored unmeasured is CORRECTED when its request arrives later, and not appended again while it has none", () => {
  const dir = tmpDir("compaction-late-");
  const store = openStore(join(dir, "events.ndjson"));
  const first = read(ONE_COMPACTION);
  appendToStore(store, first);
  assert.equal(compactionsOf(readStore(store.path))[0].unmeasured, NO_USAGE_RECORD);
  // a later run: no new transcript events, the receiver has since appended the request
  assert.deepEqual(withCompactionUsage([], store.events), [], "no request in the store: nothing to correct");
  appendFileSync(store.path, `${JSON.stringify(REQUEST)}\n`);
  const later = openStore(store.path);
  const batch = withCompactionUsage([], later.events);
  assert.equal(batch.length, 1);
  assert.deepEqual(appendToStore(later, batch), { added: 0, superseded: 1, skipped: 0 });
  const stored = compactionsOf(readStore(store.path));
  assert.equal(stored.length, 1, "one line for the compaction, replaced and not duplicated");
  near(stored[0].costUsd, REQUEST_COST);
  assert.equal(withCompactionUsage([], openStore(store.path).events).length, 0, "and once measured it is not corrected again");
});

test("THE INGEST joins them: a transcript read beside a store that holds the request stores the compaction measured", () => {
  const dir = tmpDir("compaction-ingest-");
  const root = join(dir, "projects");
  mkdirSync(join(root, "-probe"), { recursive: true });
  writeFileSync(join(root, "-probe", `${SESSION_ID}.jsonl`), ONE_COMPACTION);
  const storePath = join(dir, "events.ndjson");
  writeFileSync(storePath, `${JSON.stringify(REQUEST)}\n`);
  ingestTranscripts({ root, since: 0, ledger: [], rowRepo: ROW_REPO, storePath, now: T0 + 3_600_000 });
  const stored = readStore(storePath);
  const [made, ...more] = compactionsOf(stored);
  assert.deepEqual(more, []);
  near(made.costUsd, REQUEST_COST);
  assert.equal(made.transcript, SESSION_ID);
  assert.equal(stored.filter((event) => event.kind === "turn").length, 2, "no turn was added for the summary call");
});

test("a measured compaction is repriced at read like a turn, and an unmeasured one stays as stored", () => {
  const [made] = measureCompactions(compactionsOf(read(ONE_COMPACTION)), [REQUEST]);
  const [again, bare] = repriceEvents([{ ...made, costUsd: 99 }, ...compactionsOf(read(ONE_COMPACTION))]);
  near(again.costUsd, REQUEST_COST);
  assert.equal(bare.costUsd, null);
});

test("THE RECEIVER keeps query_source, the one field that tells a compaction's call from a turn's", () => {
  const record = (querySource: string) => ({ resourceLogs: [{ resource: { attributes: [{ key: "org.role", value: { stringValue: "worker-agent-org-478-probe" } }] }, scopeLogs: [{ logRecords: [{
    body: { stringValue: "claude_code.api_request" }, timeUnixNano: String(BigInt(T0 + 21_459) * 1_000_000n),
    attributes: [{ key: "request_id", value: { stringValue: `req_${querySource}` } }, { key: "session.id", value: { stringValue: SESSION_ID } }, { key: "model", value: { stringValue: "claude-haiku-5-5" } },
      { key: "query_source", value: { stringValue: querySource } }, { key: "input_tokens", value: { intValue: "1998" } }, { key: "output_tokens", value: { intValue: "646" } }],
  }] }] }] });
  assert.equal(eventsOfOtlpLogs(record("compact")).events[0].querySource, "compact");
  assert.equal(eventsOfOtlpLogs(record("repl_main_thread")).events[0].querySource, "repl_main_thread");
  const none = record("x");
  none.resourceLogs[0].scopeLogs[0].logRecords[0].attributes = none.resourceLogs[0].scopeLogs[0].logRecords[0].attributes.filter((one) => one.key !== "query_source");
  assert.equal(eventsOfOtlpLogs(none).events[0].querySource, null, "a request that names no source is null, not a guess");
});

// ---------------------------------------------------------------------------------------------------------------------------------------------------------
// The aggregate's compaction line

const WEEK = Date.parse("2026-10-05T00:00:00Z");
const NOW = Date.parse("2026-10-11T00:00:00Z");
const turnEvent = (id: string, at: number, session: string, tokens: NonNullable<TraceEvent["tokens"]>) => ({
  id, kind: "turn", source: "transcript", at, session, row: null, pr: null, repo: null, cause: null, causeKey: null, wakeId: null, model: "claude-sonnet-5-5", tokens,
  costUsd: costOf("claude-sonnet-5-5", tokens), sidechain: false,
}) as TraceEvent;
const compactionEvent = (id: string, at: number, session: string, extra: Partial<TraceEvent> = {}) => ({
  id, kind: "compaction", source: "transcript", at, session, row: null, pr: null, repo: null, cause: null, causeKey: null, wakeId: null, costUsd: null, unmeasured: NO_USAGE_RECORD, ...extra,
}) as TraceEvent;

const AGGREGATE_AT = Date.parse("2026-10-08T12:00:00Z");
/** The week's one measured compaction and one unmeasured, each followed by the session's own turn, which re-reads the window. */
const AGGREGATE_EVENTS = (measured: boolean) => {
  const tokens = { input: 1998, output: 646, cacheRead: 22415, cacheWrite5m: 0, cacheWrite1h: 70 };
  return [
    turnEvent("t-a", AGGREGATE_AT + 60_000, "worker-1", { input: 1000, output: 100, cacheRead: 50_000, cacheWrite5m: 0, cacheWrite1h: 0 }),
    compactionEvent("c-a", AGGREGATE_AT, "worker-1", measured ? { model: "claude-haiku-5-5", tokens, costUsd: costOf("claude-haiku-5-5", tokens), unmeasured: undefined } : {}),
    turnEvent("t-b", AGGREGATE_AT + 3_660_000, "worker-2", { input: 500, output: 100, cacheRead: 10_000, cacheWrite5m: 0, cacheWrite1h: 0 }),
    compactionEvent("c-b", AGGREGATE_AT + 3_600_000, "worker-2"),
  ];
};
const aggregated = (events: TraceEvent[]) => aggregate({ events, pulls: [], rowRepo: ROW_REPO, now: NOW, since: WEEK, held: { from: WEEK, basis: "test fixture" }, readings: new Map(), unreadable: [], openRows: [] });
const compactionClass = (events: TraceEvent[]) => aggregated(events).weeks.flatMap((week) => week.repeats.classes).find((entry) => entry.id === "compaction") as NonNullable<ReturnType<typeof aggregated>["weeks"][number]["repeats"]["classes"][number]>;

test("the aggregate's compaction line SUMS the summary call with the re-read, counts the unmeasured apart, and counts no turn twice", () => {
  // t-a re-reads (1000 x $2 + 50000 x $0.1) / 1e6 = 0.007; t-b (500 x $2 + 10000 x $0.1) / 1e6 = 0.002; the summary call of c-a is REQUEST_COST. c-b has none.
  const line = compactionClass(AGGREGATE_EVENTS(true));
  assert.equal(line.count, 2);
  assert.equal(line.unmeasured, 1);
  near(line.dollars, 0.007 + 0.002 + REQUEST_COST);
  assert.equal(line.floor, true, "a compaction nothing measured makes the dollars a floor");
  assert.equal(line.tokens, 51_000 + 10_500 + (1998 + 646 + 22415 + 70), "the two re-reads' input side, and the summary call's five fields");
  // POSITIVE CONTROL for "no double count": the same week with c-a unmeasured is the re-reads alone, so the summary call is exactly the difference and the turns did not move.
  const without = compactionClass(AGGREGATE_EVENTS(false));
  near(without.dollars, 0.009);
  assert.equal(without.unmeasured, 2);
  near((line.dollars as number) - (without.dollars as number), REQUEST_COST);
});

test("the aggregate prints an unmeasured compaction as ESTIMATED beside the line and DEFINITIONS says how much a day, never a number as a measurement", () => {
  const text = renderAggregate(aggregated(AGGREGATE_EVENTS(true)));
  const line = text.split("\n").find((one) => one.includes("compactions (re-read")) as string;
  assert.match(line, /1 summary calls UNMEASURED/);
  assert.match(line, /ESTIMATED ~\$0\.1000 at \$0\.1 each, not a reading/);
  assert.match(line, />= \$/, "the dollars are a floor");
  const all = renderAggregate(aggregated(AGGREGATE_EVENTS(false)));
  assert.match(all, /2 summary calls UNMEASURED/);
  const fully = renderAggregate(aggregated(AGGREGATE_EVENTS(true).filter((event) => event.id !== "c-b" && event.id !== "t-b")));
  const fullyLine = fully.split("\n").find((one) => one.includes("compactions (re-read")) as string;
  assert.doesNotMatch(fullyLine, /UNMEASURED|ESTIMATED/, "nothing unmeasured on the line, nothing said there (DEFINITIONS says what the word means, always)");
  assert.match(fully, /ESTIMATED, not measured: about \$0\.10 per call and about \$16 a day/, "and DEFINITIONS carries the estimate a day and says it is not measured");
});
