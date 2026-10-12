// no-token: none -- reads source files and a temporary fixture tree; nothing here reaches `gh`, `herdr` or `git`
/**
 * (a11ign#5152) THE GATE STAYS SPLIT: `src/work-gate.ts` IS THE ENTRY AND IS KEPT SMALL, AND NO CAUSE MODULE IMPORTS ANOTHER.
 *
 * `work-gate.ts` was 9,339 lines and nearly every gate fix touched it, so B4 (no two open pull requests on one file) queued gate fixes one at a time. Each cause
 * family now lives in its own module under `src/work-gate/causes/`, and two properties keep parallel rows from colliding on one file again:
 *
 *   1. THE ENTRY IS UNDER `ENTRY_LINE_BUDGET`. A fix that adds a declaration to the entry because it is the nearest file puts the next one back in the queue.
 *   2. NO CAUSE MODULE IMPORTS ANOTHER CAUSE MODULE, nor the entry. A cause that reaches into a sibling is a second file every fix to either must be ordered
 *      against, and an import of the entry is a cycle (`work-gate.ts` imports the cause modules). Shared code goes in a base module beside `causes/`.
 *
 * Each rule is a function over text, and each is paired with the fixture that turns it red and the fixture that does not, so a reader that matched nothing
 * (a regex that missed `export ... from`, a budget compared the wrong way round) fails here and not by passing on the real tree.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const ENTRY = join(SRC, "work-gate.ts");
const CAUSES = join(SRC, "work-gate", "causes");

/** What the chairman set for the entry (a11ign#5152): past this the gate is one file again. The tick's orchestration itself is well under it. */
const ENTRY_LINE_BUDGET = 1000;
/** Fewer cause modules than this means the walk found a different directory, not that the split was undone (22 at the split). */
const FEWEST_CAUSE_MODULES = 10;

/** Lines in `text` as `wc -l` counts them: a trailing newline does not make another one. */
const lineCount = (text: string): number => (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n").length;

/** `null` when the entry fits, otherwise the sentence a failure names. */
function entryOverBudget(lines: number, budget: number = ENTRY_LINE_BUDGET): string | null {
  if (lines <= budget) return null;
  return `src/work-gate.ts is ${lines} lines, over its budget of ${budget}: put the declaration in the cause module of its family under src/work-gate/causes/ (or a base module beside it), not in the entry`;
}

/** The module specifiers `source` imports or re-exports from, static or dynamic, with comments removed so a header that quotes an import does not enlist the file. */
function specifiersOf(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return [...code.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]!);
}

/** One sentence per import of `file` that lands in a sibling cause module or the entry; empty when it imports neither. `file` and the result are absolute / sentences. */
function causeCouplings(file: string, source: string, entry: string = ENTRY, causesDir: string = CAUSES): string[] {
  const found: string[] = [];
  for (const spec of specifiersOf(source)) {
    if (!spec.startsWith(".")) continue;
    const target = resolve(dirname(file), spec);
    if (target === entry) found.push(`${basename(file)} imports the entry (${spec}): a cycle, since the entry imports the cause modules`);
    else if (target.startsWith(causesDir + sep) && target !== file) found.push(`${basename(file)} imports another cause module (${spec}): move the shared code to a base module beside causes/`);
  }
  return found;
}

const basename = (file: string): string => file.slice(file.lastIndexOf(sep) + 1);

function causeModules(dir: string = CAUSES): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
    .map((entry) => join(dir, entry))
    .sort();
}

test("the entry `src/work-gate.ts` is under its line budget", () => {
  assert.equal(entryOverBudget(lineCount(readFileSync(ENTRY, "utf8"))), null);
});

test("CONTROL (both directions): the budget fails an entry one line over and passes one exactly at it", () => {
  assert.match(entryOverBudget(ENTRY_LINE_BUDGET + 1) ?? "", /is 1001 lines, over its budget of 1000/);
  assert.equal(entryOverBudget(ENTRY_LINE_BUDGET), null);
  // `lineCount` is what the real check feeds it: a trailing newline is not a line, and a file of N newline-ended lines is N.
  assert.equal(lineCount("a\nb\n"), 2);
  assert.equal(lineCount("a\nb"), 2);
  assert.equal(entryOverBudget(lineCount("x\n".repeat(ENTRY_LINE_BUDGET + 1))) === null, false, "a file one line over the budget is refused through the same path the real file takes");
});

test("no cause module imports another cause module or the entry", () => {
  const modules = causeModules();
  assert.ok(modules.length >= FEWEST_CAUSE_MODULES, `POSITIVE CONTROL for the loop below: ${modules.length} cause modules found under ${relative(SRC, CAUSES)}, expected at least ${FEWEST_CAUSE_MODULES}`);
  const couplings = modules.flatMap((file) => causeCouplings(file, readFileSync(file, "utf8")));
  assert.deepEqual(couplings, []);
});

test("CONTROL (both directions): a sibling import, an entry import and a re-export from a sibling are each named, and base-module, package and type-only-from-base imports are not", () => {
  const file = join(CAUSES, "pr-checks.ts");
  const coupled = (source: string) => causeCouplings(file, source);
  assert.equal(coupled(`import { x } from "./rows-offer.ts";`).length, 1, "a sibling cause module");
  assert.equal(coupled(`export { y } from "./pr-reviews.ts";`).length, 1, "a re-export is an import");
  assert.equal(coupled(`import type { T } from "./rows-offer.ts";`).length, 1, "a type import couples the files as much as a value one");
  assert.equal(coupled(`const m = await import("./rows-offer.ts");`).length, 1, "a dynamic import");
  assert.equal(coupled(`import { w } from "../../work-gate.ts";`).length, 1, "the entry");
  assert.deepEqual(coupled(`import { v } from "../reads.ts";\nimport { n } from "node:fs";\nimport { z } from "../../red-pr.ts";\nimport type { P } from "../pr-state.ts";`), [], "base modules, a package and a file outside the gate");
  assert.deepEqual(coupled(`// import { x } from "./rows-offer.ts";\n/* import { y } from "./pr-reviews.ts"; */\nexport const a = 1;`), [], "a comment that quotes an import");
  assert.deepEqual(coupled(`import { s } from "./pr-checks.ts";`), [], "a module is not coupled to itself");
});
