// no-token: gh -- parses ci.yml and runs one step's own script under bash with a fake `rstest`; no network, no `gh`
/**
 * THE SUITE RUNS AS SHARDS, AND THE SHARDS ARE STILL THE WHOLE SUITE.
 *
 * `ci.yml`'s `suite` job is a matrix of shards, each running rstest's `--shard <i>/<n>`. Splitting it can go wrong in ways that stay green: a whole-tree step
 * run on every shard (four Closes checks, four leak scans) or on none, the test step skipped on some shard, a cache or an artifact the shards overwrite, `gate`
 * no longer waiting for every shard, or a file no shard runs. So, as `release-dry-run.test.ts` does:
 *   - STRUCTURE, as functions over the parsed workflow returning what is wrong, each also run on a copy with exactly that thing broken;
 *   - BEHAVIOUR, the "Every test file is run by rstest" step's own script, taken from the file and run by bash in a fixture project with a fake `rstest`
 *     whose shards are whole, then miss a file, then repeat one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { tmpDirForFile } from "./lib/tmp-fixture.ts";

interface Step { id?: string; name?: string; if?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> }
interface Job { needs?: string[] | string; strategy?: { "fail-fast"?: boolean; matrix?: { shard?: unknown } }; steps?: Step[] }
interface Workflow { jobs: Record<string, Job> }

/** `.github` is copied with the tool into the project's tree by `suite`, so this path resolves both in this repository and there. */
const CI = parse(readFileSync(fileURLToPath(new URL("../.github/workflows/ci.yml", import.meta.url)), "utf8")) as Workflow;

const ONLY_SHARD_ONE = "matrix.shard == 1";
/** The steps that read the whole tree rather than run tests: once a run is enough, and four Closes checks would ask GitHub four times. */
const WHOLE_TREE_STEPS = ["Every path a workflow names", "Leak scan", "The declared Closes matches", "Every test file is run by rstest"];
const TEST_STEP = "The tool's suite under rstest";

const clone = (w: Workflow): Workflow => structuredClone(w);
const stepsOf = (w: Workflow): Step[] => w.jobs.suite?.steps ?? [];
const stepNamed = (w: Workflow, prefix: string): Step => stepsOf(w).find((s) => (s.name ?? "").startsWith(prefix)) ?? {};
const isWholeTree = (step: Step): boolean => WHOLE_TREE_STEPS.some((prefix) => (step.name ?? "").startsWith(prefix));

/** What is wrong with the matrix: it must number the shards 1 to n, n of at least two, with fail-fast off so one red shard does not cancel the rest. */
function matrixProblems(w: Workflow): string[] {
  const strategy = w.jobs.suite?.strategy;
  const shards = strategy?.matrix?.shard;
  const problems: string[] = [];
  if (!Array.isArray(shards) || shards.length < 2 || !shards.every((value, index) => value === index + 1)) problems.push(`the shard matrix is not 1 to n: ${JSON.stringify(shards)}`);
  if (strategy?.["fail-fast"] !== false) problems.push("fail-fast is not off, so one red shard cancels the others before they report");
  return problems;
}

/** What is wrong with where each step runs: a whole-tree step on shard 1 only, every other step (the tests above all) on every shard. */
function placementProblems(w: Workflow): string[] {
  const problems: string[] = [];
  for (const prefix of WHOLE_TREE_STEPS) {
    if (!stepsOf(w).some((s) => (s.name ?? "").startsWith(prefix))) problems.push(`no step named "${prefix}..."`);
  }
  for (const step of stepsOf(w)) {
    const name = step.name ?? step.uses ?? "(unnamed)";
    const condition = step.if ?? "";
    if (isWholeTree(step) && !condition.includes(ONLY_SHARD_ONE)) problems.push(`"${name}" runs on every shard, not on shard 1 only`);
    if (!isWholeTree(step) && condition.includes("matrix.shard")) problems.push(`"${name}" is limited to some shards: \`${condition}\``);
  }
  return problems;
}

/** What is wrong with the test step and what each shard keeps: its own `--shard`, its own build cache and its own trace artifact. */
function shardStateProblems(w: Workflow): string[] {
  const problems: string[] = [];
  const tests = stepNamed(w, TEST_STEP);
  if (!/--shard "\$SHARD\/\$SHARDS"/.test(tests.run ?? "")) problems.push(`the test step does not run its own shard: ${JSON.stringify(tests.run)}`);
  if (tests.env?.SHARD !== "${{ matrix.shard }}" || tests.env?.SHARDS !== "${{ strategy.job-total }}") problems.push(`the test step's SHARD and SHARDS are not the matrix's: ${JSON.stringify(tests.env)}`);
  const cacheKey = String(stepsOf(w).find((s) => (s.uses ?? "").startsWith("actions/cache@"))?.with?.key ?? "");
  if (!cacheKey.includes("${{ matrix.shard }}") || !cacheKey.includes("${{ strategy.job-total }}")) problems.push(`the build cache key is shared by the shards: ${cacheKey}`);
  const artifact = String(stepsOf(w).find((s) => (s.uses ?? "").startsWith("actions/upload-artifact@"))?.with?.name ?? "");
  if (!artifact.includes("${{ matrix.shard }}")) problems.push(`the trace artifact's name is shared by the shards: ${artifact}`);
  return problems;
}

/** What is wrong with `gate`: it must need `suite` and read its result, which is `success` only when every shard's is. */
function gateProblems(w: Workflow): string[] {
  const gate = w.jobs.gate;
  const needs = Array.isArray(gate?.needs) ? gate.needs : [gate?.needs];
  const problems: string[] = [];
  if (!needs.includes("suite")) problems.push("gate does not need suite");
  if (!(gate?.steps ?? []).some((s) => (s.run ?? "").includes("needs.suite.result"))) problems.push("gate never reads suite's result");
  return problems;
}

const broke = (change: (w: Workflow) => void): Workflow => {
  const copy = clone(CI);
  change(copy);
  return copy;
};

test("the suite is a matrix of shards numbered 1 to n, and one red shard does not cancel the others", () => {
  assert.deepEqual(matrixProblems(CI), []);
  assert.notDeepEqual(matrixProblems(broke((w) => { w.jobs.suite!.strategy!.matrix!.shard = [1, 3]; })), [], "a gap in the numbering");
  assert.notDeepEqual(matrixProblems(broke((w) => { w.jobs.suite!.strategy!.matrix!.shard = [1]; })), [], "one shard is no split");
  assert.notDeepEqual(matrixProblems(broke((w) => { delete w.jobs.suite!.strategy!["fail-fast"]; })), [], "fail-fast left at its default, on");
});

test("the whole-tree steps run on shard 1 only, and every other step, the tests among them, on every shard", () => {
  assert.deepEqual(placementProblems(CI), []);
  assert.notDeepEqual(placementProblems(broke((w) => { for (const s of stepsOf(w)) if (s.if === ONLY_SHARD_ONE) delete s.if; })), [], "the shard-1 guards removed");
  assert.notDeepEqual(placementProblems(broke((w) => { stepNamed(w, "The declared Closes matches").if = "github.event_name == 'pull_request'"; })), [], "the Closes check on every shard");
  assert.notDeepEqual(placementProblems(broke((w) => { stepNamed(w, TEST_STEP).if = ONLY_SHARD_ONE; })), [], "the tests on shard 1 only");
});

test("each shard runs its own share of the files, and keeps its own build cache and trace artifact", () => {
  assert.deepEqual(shardStateProblems(CI), []);
  assert.notDeepEqual(shardStateProblems(broke((w) => { stepNamed(w, TEST_STEP).run = stepNamed(w, TEST_STEP).run!.replace(` --shard "$SHARD/$SHARDS"`, ""); })), [], "every shard running every file");
  assert.notDeepEqual(shardStateProblems(broke((w) => { stepNamed(w, TEST_STEP).env!.SHARDS = "4"; })), [], "a shard count written twice");
  assert.notDeepEqual(shardStateProblems(broke((w) => {
    const cache = stepsOf(w).find((s) => (s.uses ?? "").startsWith("actions/cache@"))!;
    cache.with!.key = String(cache.with!.key).replace("shard-${{ matrix.shard }}-of-${{ strategy.job-total }}-", "");
  })), [], "one cache key for every shard");
  assert.notDeepEqual(shardStateProblems(broke((w) => { stepsOf(w).find((s) => (s.uses ?? "").startsWith("actions/upload-artifact@"))!.with!.name = "rstest-trace"; })), [], "one artifact name for every shard");
});

test("gate needs suite and reads its result, so it waits for every shard", () => {
  assert.deepEqual(gateProblems(CI), []);
  assert.notDeepEqual(gateProblems(broke((w) => { w.jobs.gate!.needs = ["typecheck", "changeset", "release-dry-run"]; })), [], "suite dropped from needs");
  assert.notDeepEqual(gateProblems(broke((w) => { for (const s of w.jobs.gate!.steps ?? []) s.run = (s.run ?? "").replace("needs.suite.result", "needs.typecheck.result"); })), [], "suite's result never read");
});

// ---- behaviour: the every-file step's own script, run by bash in a fixture project ----

const FILES = ["src/a.test.ts", "src/b.test.ts", "src/c.test.mjs", "src/d.test.ts", "src/e.test.ts", "src/f/g.test.ts"];
const ROOT = tmpDirForFile("ci-suite-shards-");

/**
 * A project laid as `suite` lays it, with the six test files on disk and a fake `rstest` whose `list` prints them as the real one does (a header line, then the
 * files): all of them with no `--shard`, and for `--shard i/n` the files at positions i-1, i-1+n and so on, unless `shards` says otherwise.
 */
function fixture(name: string, shards?: Record<string, string[]>): string {
  const project = join(ROOT, name);
  for (const file of FILES) {
    mkdirSync(join(project, "packages/agent-org", file, ".."), { recursive: true });
    writeFileSync(join(project, "packages/agent-org", file), "");
  }
  mkdirSync(join(project, "node_modules/.bin"), { recursive: true });
  const fake = join(project, "node_modules/.bin/rstest");
  writeFileSync(fake, `#!/usr/bin/env node
const args = process.argv.slice(2);
const files = ${JSON.stringify(FILES)};
const custom = ${JSON.stringify(shards ?? null)};
const at = args.indexOf("--shard");
if (at < 0) { console.log(""); console.log(files.join("\\n")); process.exit(0); }
const [i, n] = args[at + 1].split("/").map(Number);
const mine = custom ? custom[i] ?? [] : files.filter((_, k) => k % n === i - 1);
console.log(\`Running shard \${i} of \${n} (\${mine.length} of \${files.length} test files)\`);
console.log("");
console.log(mine.join("\\n"));
`);
  chmodSync(fake, 0o755);
  return project;
}

function runEveryFileStep(project: string, shards: number) {
  const step = stepNamed(CI, "Every test file is run by rstest");
  return spawnSync("bash", ["-e", "-c", step.run!], { cwd: project, encoding: "utf8", env: { ...process.env, SHARDS: String(shards) } });
}

test("the every-file step passes when the shards together list every file once, at the count it is given", () => {
  for (const shards of [2, 4]) {
    const result = runEveryFileStep(fixture(`whole-${shards}`), shards);
    assert.equal(result.status, 0, `${shards} shards: ${result.stdout}${result.stderr}`);
  }
});

test("the every-file step fails, naming the gap, when a file is in no shard or in two", () => {
  const missing = runEveryFileStep(fixture("missing", { 1: ["src/a.test.ts", "src/b.test.ts", "src/c.test.mjs"], 2: ["src/d.test.ts", "src/e.test.ts"] }), 2);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stdout, /the shards do not list every file exactly once/);
  assert.match(missing.stdout, /src\/f\/g\.test\.ts/, "the file no shard runs is named");
  const twice = runEveryFileStep(fixture("twice", { 1: ["src/a.test.ts", "src/b.test.ts", "src/c.test.mjs"], 2: ["src/c.test.mjs", "src/d.test.ts", "src/e.test.ts", "src/f/g.test.ts"] }), 2);
  assert.notEqual(twice.status, 0);
  assert.match(twice.stdout, /the shards do not list every file exactly once/);
});
