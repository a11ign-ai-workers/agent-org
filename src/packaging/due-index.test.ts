// no-token: gh -- the due-index is a pure module over one file in the run's private TMPDIR; `gh` is never reached
/**
 * #994: AN INSTANT THAT PASSED BETWEEN TWO TICKS NAMES ITS REPOSITORY AS DUE.
 *
 * The clock is injected (`afterMs`, `nowMs` are arguments), so every boundary is exact. Each assertion names the mutation of `dueRepos` /
 * `writeDueIndex` / `readDueIndex` that turns it red.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dueRepos, readDueIndex, writeDueIndex, type DueEntry, type DueIndex } from "../due-index.ts";

const AFTER = 1_000_000;
const NOW = 2_000_000;
const entry = (dueAtMs: number, number = 1, kind: DueEntry["kind"] = "not-before"): DueEntry => ({ number, dueAtMs, kind });
const due = (index: DueIndex, ...rest: [afterMs?: number | null]) => dueRepos({ index, afterMs: rest.length === 0 ? AFTER : rest[0], nowMs: NOW });
const made: string[] = [];
const file = () => {
  const dir = mkdtempSync(join(tmpdir(), "due-index-"));
  made.push(dir);
  return join(dir, "due.json");
};
after(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });

test("an instant between the previous tick and now makes its repository due", () => {
  // POSITIVE CONTROL: the one case that must fire. Mutation: `dueRepos` returns [] always -> red here and in the first-tick test.
  assert.deepEqual(due({ "a/b": [entry(1_500_000)] }), ["a/b"]);
});

test("an instant before the previous tick does not (it was seen), nor one in the future", () => {
  // NEGATIVE CONTROL. Mutation: drop the `> afterMs` bound -> the first assertion goes red; drop the `<= nowMs` bound -> the second does.
  assert.deepEqual(due({ "a/b": [entry(500_000)] }), []);
  assert.deepEqual(due({ "a/b": [entry(NOW + 1)] }), []);
});

test("an instant exactly at now is due, exactly at the previous tick is not", () => {
  // Mutation: `<= nowMs` -> `< nowMs` reddens the first; `> afterMs` -> `>= afterMs` reddens the second.
  assert.deepEqual(due({ "a/b": [entry(NOW)] }), ["a/b"]);
  assert.deepEqual(due({ "a/b": [entry(AFTER)] }), []);
});

test("the first tick (no afterMs) counts every instant not after now, once", () => {
  // Mutation: treat a missing afterMs as 0 and nothing changes for positives, so the old instant is the discriminator: treating null as `NOW` reddens it.
  const index = { "a/b": [entry(5)], "c/d": [entry(NOW + 1)] };
  assert.deepEqual(due(index, null), ["a/b"]);
  assert.deepEqual(due(index, undefined), ["a/b"]);
  assert.deepEqual(due(index, NOW), [], "the next tick, with afterMs = the first tick's now, sees it no more");
});

test("repositories are distinct and sorted, and every kind counts", () => {
  // Mutation: no dedupe / no sort -> red. Three kinds on one repository and one on another.
  const index: DueIndex = {
    "z/z": [entry(1_100_000, 1, "aged-backlog")],
    "a/a": [entry(1_100_000, 2, "not-before"), entry(1_200_000, 3, "fleet-hold-until"), entry(1_300_000, 4, "aged-backlog")],
  };
  assert.deepEqual(due(index), ["a/a", "z/z"]);
});

test("writing a repository REPLACES its entries and leaves the others", () => {
  // Mutation: append instead of replace -> row 7 stays and `a/b` is still due; clobber the whole file -> `c/d` is lost.
  const path = file();
  writeDueIndex({ path, repo: "a/b", entries: [entry(1_500_000, 7)] });
  writeDueIndex({ path, repo: "c/d", entries: [entry(1_600_000, 9)] });
  writeDueIndex({ path, repo: "a/b", entries: [entry(NOW + 5, 8)] });
  const { index } = readDueIndex(path);
  assert.deepEqual(index, { "a/b": [entry(NOW + 5, 8)], "c/d": [entry(1_600_000, 9)] });
  assert.deepEqual(due(index!), ["c/d"]);
  writeDueIndex({ path, repo: "c/d", entries: [] });
  assert.deepEqual(readDueIndex(path).index, { "a/b": [entry(NOW + 5, 8)] }, "an empty list removes the repository");
});

test("round trip, a missing file, and a corrupt one that is null and says why", () => {
  const path = file();
  assert.deepEqual(readDueIndex(path), { status: "missing", index: {} }, "missing is an empty index");
  const entries = [entry(1_500_000, 3, "fleet-hold-until"), entry(1_700_000, 4, "aged-backlog")];
  writeDueIndex({ path, repo: "a/b", entries });
  assert.deepEqual(readDueIndex(path), { status: "ok", index: { "a/b": entries } }, "what is stored is what is read");
  // Mutation: readDueIndex throws on bad JSON, or returns {} for it -> red (a corrupt file read as "nothing due" misses a wait).
  writeFileSync(path, '{"version":1,"repos":{"a/b":[{"number":3,"dueA');
  const half = readDueIndex(path);
  assert.equal(half.index, null);
  assert.equal(half.status, "corrupt");
  assert.match((half as { reason: string }).reason, /not JSON/);
  writeFileSync(path, JSON.stringify({ version: 1, repos: { "a/b": [{ number: 1, dueAtMs: "soon", kind: "not-before" }] } }));
  assert.equal(readDueIndex(path).index, null, "a well-formed file with a bad entry is corrupt, not partly trusted");
  // a write over a corrupt file starts afresh rather than throwing
  writeDueIndex({ path, repo: "a/b", entries });
  assert.equal(readDueIndex(path).status, "ok");
});

test("writing a malformed entry throws rather than storing it", () => {
  assert.throws(() => writeDueIndex({ path: file(), repo: "a/b", entries: [{ number: 1, dueAtMs: NaN, kind: "not-before" }] }), TypeError);
});
