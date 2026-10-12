// no-token: none -- reads source files and a temporary fixture tree; nothing here reaches `gh`, `herdr` or `git`
/**
 * (agent-org#1066) THE GATE'S TESTS READ ITS SOURCE THROUGH ONE HELPER, AND THE HELPER READS THE MODULE SET AND NOTHING ELSE.
 *
 * `workGateSource` returns `src/work-gate.ts` followed by every non-test file under `src/work-gate/`, sorted. It is the text 32 pinning tests read, so a
 * split of the gate (a11ign#5152) moves code between files without moving it out of what they pin. The controls below are each paired with the mutation
 * that turns it red (named in the case), because a helper that returned the entry alone, or every `.ts` beside it, would pass every pin it was written for.
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
