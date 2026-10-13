// no-token: none -- a fake `gh` answers the by-label read and records every write; nothing here spawns `gh`
// #5405: a machine-filed incident row is BOARDED when it is filed. `recordIncident` is handed a fake `run`, and the tests read back the calls it made.
import assert from "node:assert/strict";
import { test } from "node:test";
import { recordIncident, type Run, type SharedGroup } from "./ci-failure-class.ts";
import { PROJECT_NUMBER, PROJECT_OWNER } from "./board-snapshot-scope.ts";
import { REPO } from "./project-identity.ts";
import { BACKLOG_LABEL, OUT_OF_RELEASE_LABEL } from "./project-vocabulary.ts";
import { connectionOf, readsRowsByLabel, type FakeRow } from "./packaging/rows-by-label-fixtures.ts";

const NEW_ROW = 9001;
const group: SharedGroup = {
  key: "a11ign/a11ign#5400|2026-10-13T10:00Z",
  signature: { check: "gate", step: "Run tests", line: "AssertionError: expected 3, got 4", file: null },
  prs: ["a11ign/a11ign#5300", "a11ign/a11ign#5301"],
  noted: ["a11ign/a11ign#5300", "a11ign/a11ign#5301"],
};
const urlOf = (number: number): string => `https://github.com/${REPO}/issues/${number}`;
const silent = (): void => {};
const isItemAdd = (args: string[]): boolean => args[0] === "project" && args[1] === "item-add";

/** A fake `gh`. `issues` is what the by-label read answers; `refuse` names the calls that throw; every other call is recorded and answered empty (a create answers its URL). */
function fakeGh({ issues = [], refuse = () => false }: { issues?: FakeRow[]; refuse?: (args: string[]) => boolean } = {}) {
  const writes: string[][] = [];
  const run: Run = (args) => {
    const read = readsRowsByLabel(args);
    if (read !== null) return connectionOf(issues.filter((row) => (row.state === "CLOSED") === (read.state === "CLOSED")));
    writes.push(args);
    if (refuse(args)) throw new Error("gh refused");
    return args[0] === "issue" && args[1] === "create" ? `${urlOf(NEW_ROW)}\n` : "";
  };
  return { run, writes };
}

/** The `--body` the filing create sent, which is the body an open row carries. */
function createdBody(writes: string[][]): string {
  const create = writes.find((args) => args[0] === "issue" && args[1] === "create")!;
  return create[create.indexOf("--body") + 1];
}

test("a new incident is boarded when it is filed: the card, then Backlog, then the labels last", () => {
  const { run, writes } = fakeGh();
  assert.equal(recordIncident(group, { run, log: silent }), NEW_ROW, "the row is reported as filed");
  const board = writes.filter((args) => args[0] === "project" || (args[0] === "issue" && args[1] === "edit"));
  assert.deepEqual(board, [
    ["project", "item-add", String(PROJECT_NUMBER), "--owner", PROJECT_OWNER, "--url", urlOf(NEW_ROW)],
    ["project", "item-edit", String(PROJECT_NUMBER), "--owner", PROJECT_OWNER, "--url", urlOf(NEW_ROW), "--field", "Status", "--value", "Backlog"],
    ["issue", "edit", String(NEW_ROW), "--add-label", BACKLOG_LABEL, "--add-label", OUT_OF_RELEASE_LABEL],
  ], "the three board writes, in row-file's order: the card, its Status, then the labels");
  assert.match(createdBody(writes), /SIGNAL for `orchestrator`/, "the body says it is a signal and carries no claimable work");
});

test("a refused board step is not reported as filed, and the next tick boards the row it already filed", () => {
  const first = fakeGh({ refuse: isItemAdd });
  const log: string[] = [];
  assert.equal(recordIncident(group, { run: first.run, log: (line) => log.push(line) }), null, "not reported as filed while the card is missing");
  assert.match(log.join(""), /the next tick retries/);
  const open: FakeRow = { number: NEW_ROW, body: createdBody(first.writes), labels: ["ci-shared-failure"] };
  const second = fakeGh({ issues: [open] });
  assert.equal(recordIncident(group, { run: second.run, log: silent }), NEW_ROW, "the next tick joins the open row");
  assert.ok(second.writes.some(isItemAdd), "and boards it, because it does not yet carry the release declaration");
  assert.ok(second.writes.some((args) => args[0] === "issue" && args[1] === "edit" && args.includes(OUT_OF_RELEASE_LABEL)), "its labels are set");
});

test("a row already boarded is joined without a second board write", () => {
  const filed = fakeGh();
  recordIncident(group, { run: filed.run, log: silent });
  const open: FakeRow = { number: 7, body: createdBody(filed.writes), labels: ["ci-shared-failure", BACKLOG_LABEL, OUT_OF_RELEASE_LABEL] };
  const { run, writes } = fakeGh({ issues: [open] });
  assert.equal(recordIncident(group, { run, log: silent }), 7, "the open row is joined");
  assert.deepEqual(writes.filter((args) => args[0] === "project" || args[0] === "issue"), [], "a row carrying out-of-release is not boarded again");
});
