// no-token: none -- reads source files from disk; nothing here reaches `gh`, `herdr` or `git`
/**
 * (agent-org#1066) THE GATE'S SOURCE AS ONE TEXT, FOR THE TESTS THAT PIN IT.
 *
 * 32 test files read `src/work-gate.ts` and pin a declaration, a slice or an occurrence count in it, so a split of the gate (a11ign#5152) could go
 * no lower than 1,285 lines with the suite unchanged. A pin on the gate's text is a pin on the gate's MODULE SET: `src/work-gate.ts` followed by
 * every non-test file under `src/work-gate/`, sorted so the order is the same on every machine and every run. A reader calls this in place of
 * `readFileSync` on the one file, so moving code from the entry into `src/work-gate/` does not move it out of what the tests read.
 *
 * Test files under `src/work-gate/` are NOT part of the set: they are not the gate's source, and a count or an absence pinned on the gate would
 * otherwise see the pin's own text (`no-search-reads.test.ts` walks the same directory with the same filter). Nothing outside `work-gate.ts` and
 * `work-gate/` is read, so a neighbour such as `work-gate-lane-reads.ts` stays out of a text that a test pins as absent.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** `src/`, found from this file (`src/lib/`), so a test reads the checkout it runs in. */
const SRC = fileURLToPath(new URL("..", import.meta.url));

/** The gate's non-test source files under `dir`, as paths relative to it, sorted by code point (not by locale, which differs between machines). */
function moduleFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((entry) => entry.split("\\").join("/"))
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts"))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/**
 * `src/work-gate.ts`, then each file under `src/work-gate/`, joined with a newline. `srcDir` is for a test that builds a fixture tree; every
 * caller of the real gate passes nothing.
 */
export function workGateSource(srcDir: string = SRC): string {
  const entry = readFileSync(join(srcDir, "work-gate.ts"), "utf8");
  const parts = moduleFiles(join(srcDir, "work-gate")).map((file) => readFileSync(join(srcDir, "work-gate", file), "utf8"));
  return [entry, ...parts].join("\n");
}
