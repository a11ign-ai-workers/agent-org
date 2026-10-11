// no-token: GH_READS -- #5050. Importing anything from `work-gate.ts` reaches `defaultRun` (`execFileSync("gh", ...)`), and this file never lets it run: every reader is
// handed an injected `run` that answers from a fake, and the source guard reads files and spawns nothing.
/**
 * #5039: NO SEARCH-BACKED READ ON THE CLAIM PATH. #5050: NOR IN THE GATE, AND ONE REFUSAL IS ASKED ONCE PER TICK.
 *
 * `gh issue list --label X` (and `--search`) is sent by `gh` as a GitHub SEARCH, whose allowance is separate from and far smaller than the
 * GraphQL points. On 2026-10-11 the scheduler App's installation spent it and every claim was refused for it (`B4 COULD NOT BE ASKED`, eighteen
 * times in thirty minutes) while 3,948 points were left and a plain `gh api graphql` still worked. The claim's read of who holds what now reads
 * `repository.issues(labels:)`, a connection, which the search allowance does not govern.
 *
 * #5050 is the gate's half: `work-gate.ts` listed rows with `--label` and `--search` in eleven places, and the same installation spent the same allowance on them (1,620 list
 * calls in the 14:00Z hour, read from the workers' call ledger, 889 of them the gate's). Its label lists are now the same connection read; the closed rows owing an answer are
 * aliased connections; the newest-updated closed rows are `issues(orderBy: UPDATED_AT)`. `queue-table.ts` and `work-tick.ts` list nothing with a flag, and are walked all the same.
 *
 * Claims, each with a case that can fail:
 *   1. BEHAVIOUR: `lookupClaimedRegions` answers through a `run` that REFUSES any argv carrying `--label` or `--search` (POSITIVE CONTROL: the same
 *      fake answers the non-search read), and a read that fails is `null`, never `[]` (NEGATIVE CONTROL);
 *   2. A read refused for a limit is asked ONCE in a tick, and the line it leaves names WHICH resource;
 *   3. SOURCE: no file on the claim path builds a `issue list` / `pr list` argv carrying `--label` or `--search`; the guard SEES a fixture that
 *      does and passes one that does not;
 *   4. (#5050) EVERY LIST THE GATE READS answers through a `run` that refuses any search argv (POSITIVE CONTROL: the same fake answers the connection), and a read the
 *      limit refused is NOT asked again by ANY other list read of the tick, whichever kind;
 *   5. (#5050) SOURCE, widened: the gate's own files (`work-gate.ts`, `queue-table.ts`, `work-tick.ts`, `work-gate/`) are walked by the same guard.
 *   6. (#5074) SOURCE, widened again: the two other MEASURED spenders, `wake.ts` (the tick's three lists, run in-process) and `row-file.ts` (the filing's duplicate-title
 *      check), are walked, and each still lists something (a plain list), so the walk reads a file that lists. Their behaviour is pinned in
 *      `stuck-row-reask-filed.test.ts` (a search argv is refused there) and `row-file-board.test.ts`.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { lookupClaimedRegions } from "../row-claim/file-overlap-rule.ts";
import { readChairmanBlocked, readClaimedRowComments, readClosedAnswerRows, readClosedClaimLabelRows, readPromotableRows, readReadyRows, readRecentlyClosed,
  readTrackerLanes } from "../work-gate.ts";
import { forgetRefusedReads, readClaimedRows } from "../ticket-port/rows-by-label.ts";
import { closedAnswerConnection, connectionOf, readsClosedAnswerRows, readsRecentlyClosed, readsRowsByLabel, recentlyClosedConnection } from "./rows-by-label-fixtures.ts";

beforeEach(() => forgetRefusedReads());

const TRACKER = "a11ign/a11ign";
const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIMIT_TEXT = "GraphQL: API rate limit already exceeded for installation ID 170075049";

const claimed = (number: number, file: string, labels: string[] = ["in-progress"]) => ({
  number, labels, body: `## Region\n\n\`\`\`\n${file}\n\`\`\`\n`, blockedBy: { nodes: [{ number: number + 1 }] },
});
const ROOT = new Set(["src"]);

/** The fake of the incident: any argv that is a search is refused in the words the installation was refused in; the connection answers. */
function searchRefusingRun(rows: ReturnType<typeof claimed>[]) {
  const calls: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    if (args.includes("--label") || args.includes("--search")) throw new Error(LIMIT_TEXT);
    if (readsRowsByLabel(args)?.label === "in-progress") return connectionOf(rows);
    throw new Error(`unexpected call: ${args.join(" ")}`);
  };
  return { run, calls };
}

// --- 1. behaviour ---------------------------------------------------------------------------------------------------------------------

test("POSITIVE CONTROL: with every `--label` and `--search` argv refused, the claim still reads who holds what -- and the fake DOES refuse a search", () => {
  const { run, calls } = searchRefusingRun([claimed(5032, "src/work-gate.ts"), claimed(948, "src/queue-table.ts")]);
  assert.throws(() => run(["issue", "list", "--label", "in-progress"]), /rate limit already exceeded/, "the control: the fake is a refusing one, so a pass below is not a fake that accepts anything");
  calls.length = 0;
  const regions = lookupClaimedRegions({ run, repo: TRACKER, rootFiles: ROOT });
  assert.deepEqual(regions, [
    { number: 5032, files: ["src/work-gate.ts"], blockedBy: [5033] },
    { number: 948, files: ["src/queue-table.ts"], blockedBy: [949] },
  ]);
  assert.equal(calls.length, 1, "one read, and it is not a search");
  assert.ok(!calls[0].includes("--label") && !calls[0].includes("--search"));
  assert.ok(calls[0].includes("label=in-progress"), "the label is a variable of the connection, not a filter flag");
});

test("NEGATIVE CONTROL: a read that fails is `null`, never `[]` -- a refusal, a bad payload, and a list that is not the whole population", () => {
  assert.equal(lookupClaimedRegions({ run: () => { throw new Error(LIMIT_TEXT); }, repo: TRACKER, rootFiles: ROOT }), null);
  forgetRefusedReads();
  assert.equal(lookupClaimedRegions({ run: () => { throw new Error("gh: 502"); }, repo: TRACKER, rootFiles: ROOT }), null);
  assert.equal(lookupClaimedRegions({ run: () => "not json", repo: TRACKER, rootFiles: ROOT }), null);
  assert.equal(lookupClaimedRegions({ run: () => JSON.stringify({ errors: [{ message: "Could not resolve to a Repository" }] }), repo: TRACKER, rootFiles: ROOT }), null);
  assert.equal(lookupClaimedRegions({ run: () => connectionOf([claimed(1, "src/a.ts")], { hasNextPage: true }), repo: TRACKER, rootFiles: ROOT }), null,
    "a next page that is never read is a list cut short");
  assert.deepEqual(lookupClaimedRegions({ run: () => connectionOf([]), repo: TRACKER, rootFiles: ROOT }), [],
    "control: nobody holding a file IS `[]` when the read succeeded -- the two answers are different values");
});

test("the rows come back in the shape `gh issue list --json` gave, across pages, so no comparison had to change", () => {
  const pages = [connectionOf([claimed(1, "src/a.ts")], { hasNextPage: true }), connectionOf([claimed(2, "src/b.ts", ["in-progress", "session:worker-2"])])];
  const rows = readClaimedRows({ run: () => pages.shift() as string, repo: TRACKER });
  assert.deepEqual(rows.map((row) => row.number), [1, 2]);
  assert.deepEqual(rows[1].labels, [{ name: "in-progress" }, { name: "session:worker-2" }]);
  assert.deepEqual(rows[0].blockedBy, { nodes: [{ number: 2 }] });
});

// --- 2. a limit-refused read is asked once, and says which resource -----------------------------------------------------------------------

test("a read refused for a limit is asked ONCE in a tick, and the line names the resource it came from", () => {
  const calls: string[][] = [];
  const lines: string[] = [];
  const probe = "HTTP/2.0 200 OK\r\nX-Ratelimit-Limit: 5000\r\nX-Ratelimit-Remaining: 3948\r\nX-Ratelimit-Resource: graphql\r\n\r\n{}";
  const run = (args: string[]): string => {
    calls.push(args);
    if (readsRowsByLabel(args) !== null) throw new Error(LIMIT_TEXT);
    return probe; // the one follow-up read of the GraphQL pool, whose headers name the pool that answered
  };
  const first = readClaimedRows.bind(null, { run, repo: TRACKER, log: (line: string) => lines.push(line) });
  assert.throws(() => first(), /rate limit already exceeded/);
  assert.throws(() => first(), /not asked again this tick/);
  assert.throws(() => first(), /not asked again this tick/);
  assert.equal(calls.filter((args) => readsRowsByLabel(args) !== null).length, 1, "the refused read went to GitHub once; the second and third asks did not");
  assert.equal(lines.length, 1, "and said so once");
  assert.match(lines[0], /3948 of 5000 left/, "it names the pool it read, with the count");
  assert.match(lines[0], /search or secondary/, "and that the refusal came from a resource that pool does not count");
  assert.match(lines[0], /installation ID 170075049/, "and keeps the one identifier the refusal carried");
});

test("a refusal that is not a limit is not remembered: the next ask goes to GitHub again", () => {
  let asked = 0;
  const run = (): string => { asked += 1; throw new Error("gh: 502"); };
  assert.equal(lookupClaimedRegions({ run, repo: TRACKER, rootFiles: ROOT }), null);
  assert.equal(lookupClaimedRegions({ run, repo: TRACKER, rootFiles: ROOT }), null);
  assert.equal(asked, 2);
});

// --- 3. the source guard ------------------------------------------------------------------------------------------------------------

/** The flags `gh issue list` / `gh pr list` turn into a SEARCH (#5050 adds the author and assignee the row names: `pr list --author` is one, and neither is needed by a read here). */
const SEARCH_FLAGS = new Set(["--label", "-l", "--search", "-S", "--author", "-A", "--assignee", "-a"]);

/** The call-shaped array literals that LIST rows with a search-backed flag: `["issue", "list", ..., "--label", ...]`. */
function searchBackedLists(source: string): string[] {
  const file = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const text = (node: ts.Node | undefined): string | null => (node !== undefined && ts.isStringLiteralLike(node) ? node.text : null);
  const visit = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const strings = node.elements.map(text);
      const lists = (strings[0] === "issue" || strings[0] === "pr") && strings[1] === "list";
      const flags = strings.filter((s) => s !== null && SEARCH_FLAGS.has(s));
      if (lists && flags.length > 0) found.push(`${strings[0]} list ${flags.join(" ")} (line ${file.getLineAndCharacterOfPosition(node.getStart()).line + 1})`);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

/** The files the claim reads through: the claim, its rules, the sweep freeze beside them, the incident rows, and the port directory. */
const COVERED = [
  "row-claim.ts", "sweep-window.ts", "ci-failure-class.ts",
  // #5050: the gate. `work-gate.ts` is where eleven of them were; the other two list nothing with a flag and stay walked so the first one added is seen.
  "work-gate.ts", "queue-table.ts", "work-tick.ts",
  // #5074: the tick's wake and the filing tool. The rest of the table in the row (`ready-label-audit.ts`, `board-data.ts`, ...) is the row after it.
  "wake.ts", "row-file.ts",
  ...readdirSync(join(SRC, "work-gate")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `work-gate/${f}`),
  ...readdirSync(join(SRC, "row-claim")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `row-claim/${f}`),
  ...readdirSync(join(SRC, "ticket-port")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `ticket-port/${f}`),
];

test("NEGATIVE CONTROL (source): no file the claim or the gate reads through builds a list argv carrying `--label` or `--search`", () => {
  assert.ok(COVERED.includes("row-claim/file-overlap-rule.ts") && COVERED.includes("ticket-port/rows-by-label.ts"),
    "the walk sees the files this row converted: an empty walk would pass for the wrong reason");
  assert.ok(["work-gate.ts", "queue-table.ts", "work-tick.ts", "work-gate/org-health.ts"].every((file) => COVERED.includes(file)), "and the gate's own files (#5050)");
  for (const file of COVERED) assert.deepEqual(searchBackedLists(readFileSync(join(SRC, file), "utf8")), [], `${file} lists rows through a SEARCH`);
});

test("POSITIVE CONTROL (source, #5074): `wake.ts` and `row-file.ts` are walked, and each still lists rows -- with a plain list, which is no search", () => {
  assert.ok(COVERED.includes("wake.ts") && COVERED.includes("row-file.ts"), "the walk sees the two files this row converted");
  for (const file of ["wake.ts", "row-file.ts"]) {
    assert.match(readFileSync(join(SRC, file), "utf8"), /\["issue", "list", /, `${file} still names an \`issue list\`, so the guard is looking at a file that lists`);
  }
});

test("POSITIVE CONTROL (source, #5050): the gate's list reads are SEEN by the walk -- `work-gate.ts` still names `issue list`, so the walk is reading a file that lists", () => {
  const gate = readFileSync(join(SRC, "work-gate.ts"), "utf8");
  assert.match(gate, /\["issue", "list", "--state", "open", "--limit"/, "the whole open list is still an `issue list` (it is no search), so the guard is looking at real list calls");
  assert.doesNotMatch(gate, /"--label", (?:CHAIRMAN|BACKLOG|READY|CLAIM)_LABEL/, "and the four label lists it used to build are gone");
});

test("POSITIVE CONTROL (source): the guard sees a fixture that lists with `--label` or `--search`, and passes one that does not", () => {
  const label = `export const read = (run) => run(["issue", "list", "--repo", r, "--state", "open", "--label", "in-progress", "--json", "number"]);\n`;
  const search = `const read = (run) => run(["pr", "list", "--search", "merged:>=2026-10-01"]);\n`;
  assert.deepEqual(searchBackedLists(label), ['issue list --label (line 1)']);
  assert.deepEqual(searchBackedLists(search), ['pr list --search (line 1)']);
  assert.deepEqual(searchBackedLists(`const read = (run) => run(["pr", "list", "--author", "app/a11ign", "--json", "number"]);\n`), ['pr list --author (line 1)'],
    "#5050: an author filter on a list is a search too");
  assert.deepEqual(searchBackedLists(`const read = (run) => run(["issue", "list", "--repo", r, "--state", "open", "--json", "number"]);\n`), [], "a plain list is not a search");
  assert.deepEqual(searchBackedLists(`const make = (run) => run(["issue", "create", "--title", t, "--label", "shared-failure"]);\n`), [],
    "and a label on a WRITE is not a read: the guard names the list shape, not the flag");
});

// --- 4. the gate's lists, behaviour -------------------------------------------------------------------------------------------------

/** The gate's readers, each with the one call it makes, so a test can drive them all through one fake. */
const GATE_READS: { name: string; read: (run: (args: string[]) => string) => unknown; }[] = [
  { name: "readChairmanBlocked", read: (run) => readChairmanBlocked(run) },
  { name: "readPromotableRows", read: (run) => readPromotableRows(run) },
  { name: "readReadyRows", read: (run) => readReadyRows(run) },
  { name: "readClaimedRowComments", read: (run) => readClaimedRowComments(run, TRACKER) },
  { name: "readClosedClaimLabelRows", read: (run) => readClosedClaimLabelRows((args) => run(args), [undefined]).rows },
  { name: "readClosedAnswerRows", read: (run) => readClosedAnswerRows(run) },
  { name: "readRecentlyClosed", read: (run) => readRecentlyClosed(run) },
];

/** What a gate list read gets from a GitHub whose SEARCH allowance is spent: every `--label`/`--search` argv is refused in the incident's words, a connection answers. */
function gateGitHub({ failWith }: { failWith?: string; } = {}) {
  const calls: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    if (failWith !== undefined) throw new Error(failWith);
    if (args.includes("--label") || args.includes("--search") && args[0] !== "label") throw new Error(LIMIT_TEXT);
    if (args[0] === "label") return JSON.stringify([{ name: "answer:ceo" }]);
    if (readsRowsByLabel(args) !== null) return connectionOf([claimed(7, "src/a.ts", ["ready", "backlog", "needs:chairman", "in-progress"])]);
    if (readsClosedAnswerRows(args) !== null) return closedAnswerConnection([]);
    if (readsRecentlyClosed(args)) return recentlyClosedConnection([{ number: 3, closedAt: "2026-10-11T10:00:00Z", updatedAt: "2026-10-11T10:00:00Z" }]);
    throw new Error(`unexpected call: ${args.join(" ")}`);
  };
  return { run, calls };
}

test("POSITIVE CONTROL: every list the gate reads answers while every `--label` and `--search` argv is refused -- and the fake DOES refuse one", () => {
  const { run, calls } = gateGitHub();
  assert.throws(() => run(["issue", "list", "--label", "ready"]), /rate limit already exceeded/, "the control: a pass below is not a fake that accepts anything");
  calls.length = 0;
  for (const { name, read } of GATE_READS) {
    forgetRefusedReads();
    const answer = read(run);
    assert.notEqual(answer, null, `${name} answered through connections`);
  }
  assert.ok(calls.length >= GATE_READS.length, "each reader asked");
  assert.deepEqual(calls.filter((args) => args.includes("--label") || (args.includes("--search") && args[0] !== "label")), [], "and none of them was a search");
});

test("NEGATIVE CONTROL: a gate list read that FAILS is `null`, never `[]` -- for every reader", () => {
  for (const { name, read } of GATE_READS) {
    forgetRefusedReads();
    const { run } = gateGitHub({ failWith: "gh: 502" });
    const answer = read(run);
    assert.ok(answer === null || (Array.isArray(answer) && answer.length === 0 && name === "readClosedAnswerRows") === false, `${name} is not an empty list from a failed read`);
    assert.equal(answer, null, `${name} answers null for a failed read`);
  }
});

test("a read refused for a LIMIT is asked ONCE in the tick: no other gate list read -- by label, closed answers or recently closed -- is sent, and the line names the resource", () => {
  const lines: string[] = [];
  const probe = "HTTP/2.0 200 OK\r\nX-Ratelimit-Limit: 5000\r\nX-Ratelimit-Remaining: 3948\r\nX-Ratelimit-Resource: graphql\r\n\r\n{}";
  const calls: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    if (args[0] === "api" && args.includes("-i")) return probe;
    throw new Error(LIMIT_TEXT);
  };
  const write = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string) => { lines.push(String(chunk)); return true; }) as typeof process.stderr.write;
  try {
    assert.equal(readReadyRows(run), null, "the first read is refused: null");
    const asked = calls.length;
    for (const { read } of GATE_READS.filter(({ name }) => name !== "readReadyRows")) read(run);
    assert.equal(calls.length, asked, "and not one more call was sent by the other six readers");
  } finally {
    process.stderr.write = write;
  }
  const said = lines.filter((line) => line.startsWith("rows-by-label:"));
  assert.equal(said.length, 1, "the refusal is said once");
  assert.match(said[0], /OPEN rows labelled ready/);
  assert.match(said[0], /3948 of 5000 left/, "and names the pool it read");
});

test("the closed answer reads are under the SAME memory as the by-label ones: a refused closed read stops the next by-label read of the tick", () => {
  forgetRefusedReads();
  let refused = false;
  const calls: string[][] = [];
  const run = (args: string[]): string => {
    calls.push(args);
    if (args[0] === "label") return JSON.stringify([{ name: "answer:ceo" }]);
    if (readsClosedAnswerRows(args) !== null) { refused = true; throw new Error(LIMIT_TEXT); }
    throw new Error("unexpected call after the refusal");
  };
  const quiet = process.stderr.write.bind(process.stderr);
  process.stderr.write = (() => true) as typeof process.stderr.write;
  try {
    assert.equal(readClosedAnswerRows(run), null);
    const asked = calls.length;
    assert.equal(readChairmanBlocked(run), null, "and the by-label read, which would have thrown `unexpected call`, was never sent");
    assert.equal(calls.length, asked);
  } finally {
    process.stderr.write = quiet;
  }
  assert.ok(refused, "control: the closed read was the one that was refused");
});

// --- the fold, at the edge of one connection page --------------------------------------------------------------------------------------

/** A backlog row as the open list gives it (`gh issue list --json`). */
const backlogRow = (number: number) => ({ number, title: `row ${number}`, createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-02T00:00:00Z", body: "", milestone: null,
  labels: [{ name: "backlog" }], blockedBy: { nodes: [] }, subIssuesSummary: { total: 0, completed: 0 } });

/** A GitHub that answers the whole open list and the by-label connection (paged, 100 a page), and counts the by-label reads it was SENT. */
function trackerWithBacklog(count: number) {
  const open = Array.from({ length: count }, (_, at) => backlogRow(count - at));
  const sent: string[][] = [];
  const answer = (args: string[]): string => {
    if (args[0] === "issue" && args[1] === "list") return JSON.stringify(open);
    const asked = readsRowsByLabel(args);
    if (asked === null) throw new Error(`unexpected call: ${args.join(" ")}`);
    sent.push(args);
    if (asked.label !== "backlog") return connectionOf([]);
    const after = args.find((arg) => arg.startsWith("after="));
    const page = after === undefined ? open.slice(0, 100) : open.slice(100);
    return connectionOf(page, { hasNextPage: after === undefined && open.length > 100 });
  };
  const run = (args: string[]): string => answer(args);
  const batch = (calls: { args: string[]; }[]) => calls.map(({ args }) => ({ stdout: answer(args) }));
  return { run, batch, sent };
}

test("the fold answers a label from the open list when it fits ONE page of the connection: the by-label read is not sent (POSITIVE CONTROL)", () => {
  const { run, batch, sent } = trackerWithBacklog(40);
  const lanes = readTrackerLanes(run, batch as never);
  assert.equal(lanes.promotableRows?.length, 40, "all forty backlog rows came back");
  assert.deepEqual(sent.filter((args) => readsRowsByLabel(args)?.label === "backlog"), [], "and the connection was never asked: they were made from the open list");
});

test("a label with MORE rows than one page of the connection is NOT answered from the open list: it is asked, and no row past the first page is lost", () => {
  const { run, batch, sent } = trackerWithBacklog(150);
  const lanes = readTrackerLanes(run, batch as never);
  assert.equal(lanes.promotableRows?.length, 150, "the hundred and fifty rows: a first page folded and called whole would have returned 100");
  assert.ok(sent.some((args) => readsRowsByLabel(args)?.label === "backlog"), "the connection WAS asked, because the open list cannot say there is no second page");
});
