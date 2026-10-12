// no-token: none -- reads source files and a temporary fixture tree; nothing here reaches `gh`, `herdr` or `git`
/**
 * (agent-org#1066) THE GATE'S TESTS READ ITS SOURCE THROUGH ONE HELPER, AND THE HELPER READS THE MODULE SET AND NOTHING ELSE.
 *
 * `workGateSource` returns `src/work-gate.ts` followed by every non-test file under `src/work-gate/`, sorted. It is the text 32 pinning tests read, so a
 * split of the gate (a11ign#5152) moves code between files without moving it out of what they pin. The controls below are each paired with the mutation
 * that turns it red (named in the case), because a helper that returned the entry alone, or every `.ts` beside it, would pass every pin it was written for.
 * The last two cases are the row's open-check as a test: no test reads `src/work-gate.ts` itself, so a reader added later is named here and not found by a split.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { workGateSource } from "../lib/work-gate-source.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));

/** A source tree holding `files` (paths relative to it), written in the order given. */
function tree(files: Record<string, string>): string {
  const root = tmpDir("work-gate-source-");
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("POSITIVE CONTROL: the entry comes first, then every file under `work-gate/` in sorted order, however they were written (mutation: drop `.sort`, or read the directory before the entry)", () => {
  // Written out of order, and `c/d.ts` sorts BETWEEN two top-level files: a recursive listing yields a directory's own entries before the ones inside
  // its subdirectories, so without `.sort` the nested file comes last whatever order the filesystem lists the rest in (measured: here it listed them sorted).
  const root = tree({
    "work-gate/m.ts": "M", "work-gate/z.ts": "Z", "work-gate/b.ts": "B", "work-gate/y.ts": "Y", "work-gate/c/d.ts": "D", "work-gate/a.ts": "A", "work-gate/k.ts": "K",
    "work-gate.ts": "ENTRY",
  });
  assert.equal(workGateSource(root), "ENTRY\nA\nB\nD\nK\nM\nY\nZ");
});

test("POSITIVE CONTROL: a file in a subdirectory of `work-gate/` is part of the set, so a split into folders is still read (mutation: list the directory without `recursive`)", () => {
  const root = tree({ "work-gate.ts": "ENTRY", "work-gate/a.ts": "A", "work-gate/deeper/c.ts": "C" });
  assert.equal(workGateSource(root), "ENTRY\nA\nC");
});

test("NEGATIVE CONTROL: a file outside `work-gate/` is not read -- not a neighbour of the entry, not a test beside the module (mutation: read every `.ts` under `src/`, or drop the `.test.ts` filter)", () => {
  const root = tree({
    "work-gate.ts": "ENTRY",
    "work-gate/a.ts": "A",
    "work-gate/a.test.ts": "A-TEST",
    "work-gate-lane-reads.ts": "NEIGHBOUR",
    "work-tick.ts": "TICK",
    "lib/work-gate-source.ts": "HELPER",
  });
  const text = workGateSource(root);
  assert.equal(text, "ENTRY\nA");
  for (const outside of ["NEIGHBOUR", "TICK", "HELPER", "A-TEST"]) assert.ok(!text.includes(outside), `${outside} is outside the module set`);
});

test("the real tree: the text is `src/work-gate.ts` and then each non-test file under `src/work-gate/`, each present in full", () => {
  const entry = readFileSync(join(SRC, "work-gate.ts"), "utf8");
  const files = readdirSync(join(SRC, "work-gate")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).sort();
  assert.ok(files.includes("org-health.ts"), "the directory still holds the module the first pin reads: an empty listing would pass for the wrong reason");
  const text = workGateSource();
  assert.ok(text.startsWith(entry), "the entry is first");
  for (const file of files) assert.ok(text.includes(readFileSync(join(SRC, "work-gate", file), "utf8")), `work-gate/${file} is in the text`);
  const tests = readdirSync(join(SRC, "work-gate")).filter((f) => f.endsWith(".test.ts"));
  assert.ok(tests.length > 0, "the directory holds test files, so the exclusion below is exercised");
  for (const file of tests) assert.ok(!text.includes(readFileSync(join(SRC, "work-gate", file), "utf8")), `work-gate/${file} is a test, not source`);
});

// --- no test reads the gate's entry directly ----------------------------------------------------------------------------------------

/** The guard's own file, excluded in code: it reads `src/work-gate.ts` on purpose (above), to prove the helper returns it, and a guard that listed itself would be writing its own exemption. */
const SELF = fileURLToPath(import.meta.url);

/** A `readFileSync` whose first argument names `work-gate.ts` or a file under `work-gate/`, on one line or across several (`[^)]*` crosses a newline). */
const DIRECT_READ = /readFileSync\([^)]*work-gate(?:\/[^"'`)]*)?\.ts["'`]/;

/** The test files under `dir` (recursive) whose text reads the gate's source directly, as paths relative to `dir`. */
function directReaders(dir: string, text: (path: string) => string = (path) => readFileSync(path, "utf8")): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".test.ts") && join(dir, entry) !== SELF)
    .filter((entry) => DIRECT_READ.test(text(join(dir, entry))))
    .sort();
}

test("POSITIVE CONTROL: the pattern notices each shape the 32 readers had, and passes a call to the helper (mutation: loosen it to `/(?!)/`, and this goes red)", () => {
  for (const line of [
    `const gate = readFileSync(new URL("../work-gate.ts", import.meta.url), "utf8");`,
    `const gate = readFileSync(fileURLToPath(new URL("./work-gate.ts", import.meta.url)), "utf8");`,
    `const gate = readFileSync(join(SRC, "work-gate.ts"), "utf8");`,
    `const gate = readFileSync(join(import.meta.dirname, "..", "work-gate.ts"), "utf8");`,
    `const health = readFileSync(new URL("../work-gate/org-health.ts", import.meta.url), "utf8");`,
    `const gate = readFileSync(fileURLToPath(new URL("../work-gate.ts", import.meta.url)),\n  "utf8");`,
  ]) assert.match(line, DIRECT_READ, line);
  for (const line of [
    `const gate = workGateSource();`,
    `const lane = readFileSync(join(SRC, "work-gate-lane-reads.ts"), "utf8");`,
    `import { workGate } from "../work-gate.ts";`,
  ]) assert.doesNotMatch(line, DIRECT_READ, line);
});

test("no test reads `src/work-gate.ts` or a file under `src/work-gate/` directly: each reads the module set through `src/lib/work-gate-source.ts`", () => {
  const files = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter((entry) => entry.endsWith(".test.ts"));
  assert.ok(files.includes("packaging/work-gate.test.ts") && files.length > 100, "the walk sees the suite: an empty walk would pass for the wrong reason");
  assert.deepEqual(directReaders(SRC), []);
  // Break the thing it looks for: one converted reader put back is named.
  const text = (path: string) => (path === join(SRC, "packaging", "work-gate.test.ts") ? `const gate = readFileSync(new URL("../work-gate.ts", import.meta.url), "utf8");` : "");
  assert.deepEqual(directReaders(SRC, text), ["packaging/work-gate.test.ts"]);
});
