// no-token: gh
//
// Nothing here reaches the network or a real `gh`. The tick under test runs from a temporary `src/` whose `work-gate.ts` and `wake.ts`
// are stubs, with the PATH pointed at an empty directory, so no `herdr` is found and no order can reach a session.

/**
 * #1080: THE GATE HAS A WALL BUDGET, AND AN OVERRUN NAMES THE READ IT WAS IN.
 *
 * The work-tick unit has `TimeoutStartSec=600`, and the gate had no deadline inside it: one slow read spent the whole unit timeout, the tick was killed
 * (2026-10-12 00:09:50Z, a11ign#928) and it yielded nothing, with no line saying which read it was in. The gate now gets `GATE_BUDGET_MS`, the tick
 * writes one line naming the unfinished read, and what the gate printed in whole order lines goes on to `wake` as a partial result.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, GATE, GATE_BUDGET_MS, WAKE_ROOM_MS, gateBudgetLine, wholeOrderLines } from "../work-tick.ts";
import { completionPath } from "../lib/tick-completion.ts";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const UNIT = join(SRC, "..", "host", "work-tick.service.in");

test("#1080 (a): the gate's budget leaves the unit's TimeoutStartSec room for the wake step", () => {
  const [line] = readFileSync(UNIT, "utf8").split("\n").filter((text) => /^TimeoutStartSec=/.test(text));
  const unitMs = Number(line.slice("TimeoutStartSec=".length)) * 1000;
  assert.ok(unitMs > 0, `the unit declares a start timeout: ${line}`);
  assert.ok(GATE_BUDGET_MS > 0);
  assert.ok(GATE_BUDGET_MS * 2 <= unitMs, "the gate's budget is well under the unit's timeout");
  assert.ok(GATE_BUDGET_MS + WAKE_ROOM_MS <= unitMs, "the budget and the room for wake fit inside the unit's timeout");
});

/**
 * A tick from a temporary `src/`, as in `work-tick-crash-exit.test.ts`, with the gate's budget replaced by `budgetMs` in the COPY (the real constant
 * is five minutes, and a test that waited for it would not be a test). The copy's replacement is asserted, so a renamed constant fails here and not
 * silently by running at the full budget.
 */
function tickWith({ gate, wake, budgetMs = GATE_BUDGET_MS }: { gate: string; wake: string; budgetMs?: number; }) {
  const dir = mkdtempSync(join(tmpdir(), "tick-budget-"));
  try {
    const src = join(dir, "src");
    mkdirSync(src);
    writeFileSync(join(src, "package.json"), '{"type":"module"}'); // tsx reads a loose .ts as CommonJS without it
    const own = new Set(["work-tick.ts", "work-gate.ts", "wake.ts"]);
    for (const name of readdirSync(SRC).filter((entry) => !own.has(entry))) symlinkSync(join(SRC, name), join(src, name));
    const tick = readFileSync(join(SRC, "work-tick.ts"), "utf8");
    const budgeted = tick.replace("export const GATE_BUDGET_MS = 300_000;", `export const GATE_BUDGET_MS = ${budgetMs};`);
    assert.notEqual(budgeted, tick, "the budget constant is where this test expects it");
    writeFileSync(join(src, "work-tick.ts"), budgeted);
    writeFileSync(join(src, "work-gate.ts"), gate);
    const marker = join(dir, "wake-ran");
    writeFileSync(join(src, "wake.ts"),
      `export * from ${JSON.stringify(join(SRC, "wake.ts"))};\n`
      + `import { writeFileSync } from "node:fs";\nimport { fileURLToPath } from "node:url";\n`
      + `if (process.argv[1] === fileURLToPath(import.meta.url)) {\n  writeFileSync(${JSON.stringify(marker)}, "ran");\n  ${wake}\n}\n`);
    mkdirSync(join(dir, "empty"));
    const ledger = join(dir, "ledger.jsonl");
    const ran = spawnSync(process.execPath, [join(src, "work-tick.ts"), `--ledger=${ledger}`], {
      encoding: "utf8", cwd: dir, env: { ...process.env, PATH: join(dir, "empty"), GH_CONFIG_DIR: "" },
    });
    const recordPath = completionPath(ledger);
    return { ran, wakeRan: existsSync(marker), record: existsSync(recordPath) ? readFileSync(recordPath, "utf8") : undefined };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The wake stub reads what the tick handed it on stdin and returns it on stdout, where the tick copies it to its own stdout. */
const WAKE_ECHO = 'let data = ""; process.stdin.on("data", (chunk) => { data += chunk; }); process.stdin.on("end", () => process.stdout.write(`GOT:${JSON.stringify(data)}\\n`));';

test("#1080 (b): a gate that outlives its budget gets one line naming the unfinished read and the finished count", () => {
  // One read finishes (a synchronous child, written when it returns); one is in flight (an async child, written before it starts) when the kill comes.
  const gate = [
    'import { execFile, execFileSync } from "node:child_process";',
    'execFileSync(process.execPath, ["-e", "0"]);',
    'execFile(process.execPath, ["-e", "setTimeout(() => {}, 10000)"], () => {});',
    "setTimeout(() => {}, 10000);",
  ].join("\n");
  const { ran, wakeRan, record } = tickWith({ gate, wake: "process.exit(0);", budgetMs: 3000 });
  assert.match(ran.stderr, /GATE OUT OF BUDGET after 3 s: in node -e setTimeout\(\(\) => \{\}, 10000\), 1 reads finished\. no whole order printed, so CANNOT ASK and nothing was woken\./, ran.stderr);
  assert.equal(ran.status, EXIT.CANNOT_ASK, ran.stderr);
  assert.equal(wakeRan, false, "a gate that printed no order wakes nobody");
  assert.ok(record !== undefined && record.includes(`"exit":${EXIT.CANNOT_ASK}`), "the tick still records its completion");
});

test("#1080 (c): a gate that prints its orders and then hangs hands the whole ones to wake, and drops the line the kill cut", () => {
  const order = (name: string) => JSON.stringify({ order: name });
  const gate = [
    `process.stdout.write(${JSON.stringify(`${order("a")}\n${order("b")}\n`)});`,
    `process.stdout.write(${JSON.stringify('{"order":"cut-by-the-kill')});`,
    "setTimeout(() => {}, 10000);",
  ].join("\n");
  const { ran, wakeRan } = tickWith({ gate, wake: WAKE_ECHO, budgetMs: 3000 });
  assert.match(ran.stderr, /GATE OUT OF BUDGET after 3 s: .*, \d+ reads finished\. 2 whole order\(s\) handed on to wake\./, ran.stderr);
  assert.equal(wakeRan, true, ran.stderr);
  assert.ok(ran.stdout.includes(`GOT:${JSON.stringify(`${order("a")}\n${order("b")}\n`)}`),
    `wake received exactly the two whole orders: ${ran.stdout}`);
  assert.equal(ran.status, EXIT.QUIET, "the tick exits with wake's status, as it does for a gate that finished (this wake exits 0)");
});

test("#1080 (positive control): an in-budget gate reaches wake unchanged, and no budget line is written", () => {
  const order = JSON.stringify({ order: "a" });
  const gate = `process.stdout.write(${JSON.stringify(`${order}\n`)}); process.exit(${GATE.WORK});`;
  const { ran, wakeRan } = tickWith({ gate, wake: WAKE_ECHO, budgetMs: 30_000 });
  assert.equal(wakeRan, true, ran.stderr);
  assert.ok(ran.stdout.includes(`GOT:${JSON.stringify(`${order}\n`)}`), `wake received the gate's output as printed: ${ran.stdout}`);
  assert.doesNotMatch(ran.stderr, /GATE OUT OF BUDGET/, "a gate inside its budget is not named as out of it");
});

test("#1080: wholeOrderLines keeps the JSON lines and drops the segment after the last newline and any line that is not JSON", () => {
  assert.deepEqual(wholeOrderLines(""), []);
  assert.deepEqual(wholeOrderLines('{"a":1}\n'), ['{"a":1}']);
  assert.deepEqual(wholeOrderLines('{"a":1}\n{"b":2'), ['{"a":1}'], "the line the kill cut is not an order");
  assert.deepEqual(wholeOrderLines('{"a":1}\n{"b":2}'), ['{"a":1}'], "a complete JSON object with no newline after it is still the line the kill cut");
  assert.deepEqual(wholeOrderLines('{"a":1}\nnot json\n{"b":2}\n{"c'), ['{"a":1}', '{"b":2}']);
});

test("#1080: gateBudgetLine says what it can see, and says so when it can see nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "budget-line-"));
  try {
    const census = join(dir, "tick-census.1.jsonl");
    assert.equal(gateBudgetLine(census, 0), `GATE OUT OF BUDGET after ${GATE_BUDGET_MS / 1000} s: no census file. no whole order printed, so CANNOT ASK and nothing was woken.`);
    writeFileSync(census, [
      { cmd: "git", line: "git rev-list --count HEAD", ms: 4, pid: 2 },
      { cmd: "gh", line: "gh pr list", ms: null, pid: 3 },
      { cmd: "git", line: "git rev-parse HEAD", ms: 2, pid: 4, phase: "snapshot" },
    ].map((record) => `${JSON.stringify(record)}\n`).join(""));
    assert.equal(gateBudgetLine(census, 2), `GATE OUT OF BUDGET after ${GATE_BUDGET_MS / 1000} s: in gh pr list, 1 reads finished. 2 whole order(s) handed on to wake.`,
      "the phase-tagged read is the tick's own and is not counted as a gate read");
    writeFileSync(census, `${JSON.stringify({ cmd: "git", line: "git rev-list", ms: 4, pid: 2 })}\n`);
    assert.match(gateBudgetLine(census, 0), /: no unfinished read on record \(a synchronous read killed mid-call writes none\), 1 reads finished\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
