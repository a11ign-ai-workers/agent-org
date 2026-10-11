// no-token: none -- reads source files and answers `run` from fakes; nothing here reaches gh
/**
 * #5039: NO SEARCH-BACKED READ ON THE CLAIM PATH.
 *
 * `gh issue list --label X` (and `--search`) is sent by `gh` as a GitHub SEARCH, whose allowance is separate from and far smaller than the
 * GraphQL points. On 2026-10-11 the scheduler App's installation spent it and every claim was refused for it (`B4 COULD NOT BE ASKED`, eighteen
 * times in thirty minutes) while 3,948 points were left and a plain `gh api graphql` still worked. The claim's read of who holds what now reads
 * `repository.issues(labels:)`, a connection, which the search allowance does not govern.
 *
 * Three claims, each with a case that can fail:
 *   1. BEHAVIOUR: `lookupClaimedRegions` answers through a `run` that REFUSES any argv carrying `--label` or `--search` (POSITIVE CONTROL: the same
 *      fake answers the non-search read), and a read that fails is `null`, never `[]` (NEGATIVE CONTROL);
 *   2. A read refused for a limit is asked ONCE in a tick, and the line it leaves names WHICH resource;
 *   3. SOURCE: no file on the claim path builds a `issue list` / `pr list` argv carrying `--label` or `--search`; the guard SEES a fixture that
 *      does and passes one that does not.
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { lookupClaimedRegions } from "../row-claim/file-overlap-rule.ts";
import { forgetRefusedReads, readClaimedRows } from "../ticket-port/rows-by-label.ts";
import { connectionOf, readsRowsByLabel } from "./rows-by-label-fixtures.ts";

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

/** The call-shaped array literals that LIST rows with a search-backed flag: `["issue", "list", ..., "--label", ...]`. */
function searchBackedLists(source: string): string[] {
  const file = ts.createSourceFile("x.ts", source, ts.ScriptTarget.Latest, true);
  const found: string[] = [];
  const text = (node: ts.Node | undefined): string | null => (node !== undefined && ts.isStringLiteralLike(node) ? node.text : null);
  const visit = (node: ts.Node): void => {
    if (ts.isArrayLiteralExpression(node)) {
      const strings = node.elements.map(text);
      const lists = (strings[0] === "issue" || strings[0] === "pr") && strings[1] === "list";
      const flags = strings.filter((s) => s === "--label" || s === "-l" || s === "--search" || s === "-S");
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
  ...readdirSync(join(SRC, "row-claim")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `row-claim/${f}`),
  ...readdirSync(join(SRC, "ticket-port")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => `ticket-port/${f}`),
];

test("NEGATIVE CONTROL (source): no file the claim reads through builds a list argv carrying `--label` or `--search`", () => {
  assert.ok(COVERED.includes("row-claim/file-overlap-rule.ts") && COVERED.includes("ticket-port/rows-by-label.ts"),
    "the walk sees the files this row converted: an empty walk would pass for the wrong reason");
  for (const file of COVERED) assert.deepEqual(searchBackedLists(readFileSync(join(SRC, file), "utf8")), [], `${file} lists rows through a SEARCH`);
});

test("POSITIVE CONTROL (source): the guard sees a fixture that lists with `--label` or `--search`, and passes one that does not", () => {
  const label = `export const read = (run) => run(["issue", "list", "--repo", r, "--state", "open", "--label", "in-progress", "--json", "number"]);\n`;
  const search = `const read = (run) => run(["pr", "list", "--search", "merged:>=2026-10-01"]);\n`;
  assert.deepEqual(searchBackedLists(label), ['issue list --label (line 1)']);
  assert.deepEqual(searchBackedLists(search), ['pr list --search (line 1)']);
  assert.deepEqual(searchBackedLists(`const read = (run) => run(["issue", "list", "--repo", r, "--state", "open", "--json", "number"]);\n`), [], "a plain list is not a search");
  assert.deepEqual(searchBackedLists(`const make = (run) => run(["issue", "create", "--title", t, "--label", "shared-failure"]);\n`), [],
    "and a label on a WRITE is not a read: the guard names the list shape, not the flag");
});
