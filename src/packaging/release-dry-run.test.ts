// no-token: gh
// agent-org#888 (chairman, agent-org#885 class 3 and a11ign/a11ign#4988): this file parses ci.yml, and RUNS the steps of its `release-dry-run` job against fixture repositories; nothing here needs the network or a token.
/**
 * A PULL REQUEST THAT CHANGES HOW THE TREE INSTALLS DRY-RUNS THE RELEASE'S VERSION STEP, AND THE CONSUMER'S INSTALL OF THE CANDIDATE.
 *
 * agent-org#871 changed the install, passed CI, and the first sign was five failed releases on `main`: the shared `release-per-merge.yml` switched to the repository's own `changeset` once
 * a lockfile existed, and the lockfile named none. Nothing on the pull request ran the release's path. `ci.yml`'s `release-dry-run` job now does, when the change touches `package.json`,
 * `pnpm-lock.yaml`, `.npmrc` or `.github/workflows/`, and its second step is the install a11ign's `scripts/agent-org-newest-tag.ts` makes of a tag (`pnpm install --frozen-lockfile
 * --ignore-scripts` when the tree has a lockfile): agent-org must not publish a tag its consumer cannot install.
 *
 * Two kinds of check, because a workflow that reads right and does the wrong thing is the expensive shape here:
 *   - STRUCTURE, as functions over the parsed workflow returning what is wrong, each also run on a copy with exactly that thing broken (an emptiness assertion passes on an empty population);
 *   - BEHAVIOUR, the job's own `run:` scripts executed by bash in fixture repositories: the paths that trigger it, the fixture whose lockfile omits `@changesets/cli` (#885's shape) failing,
 *     and the consumer's install failing on a lockfile that disagrees with `package.json`.
 * The scripts are taken from the file and not copied here, so a change to what the job runs changes what this runs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

interface Step { id?: string; name?: string; if?: string; uses?: string; run?: string; with?: Record<string, unknown> }
interface Job { permissions?: Record<string, string> | string; env?: Record<string, string>; needs?: string[] | string; steps?: Step[]; uses?: string; with?: Record<string, unknown> }
interface Workflow { jobs: Record<string, Job> }

const REPO = fileURLToPath(new URL("../../", import.meta.url));
const CI = parse(readFileSync(`${REPO}.github/workflows/ci.yml`, "utf8")) as Workflow;
const RELEASE = parse(readFileSync(`${REPO}.github/workflows/release.yml`, "utf8")) as Workflow;

const JOB = "release-dry-run";
const TOUCHED = "steps.touched.outputs.touched == 'true'";
/** The only actions the job may use: it reads a checkout, installs pnpm and Node, and writes nothing. */
const ALLOWED_ACTIONS = ["actions/checkout@", "pnpm/action-setup@", "actions/setup-node@"];

const clone = (w: Workflow): Workflow => structuredClone(w);
const jobOf = (w: Workflow): Job => w.jobs[JOB] ?? { steps: [] };
const stepsOf = (w: Workflow): Step[] => jobOf(w).steps ?? [];
const stepNamed = (w: Workflow, prefix: string): Step => stepsOf(w).find((s) => (s.name ?? "").startsWith(prefix)) ?? {};
const touchedStep = (w: Workflow): Step => stepsOf(w).find((s) => s.id === "touched") ?? {};
const versionStep = (w: Workflow): Step => stepNamed(w, "The release's version step");
const consumerStep = (w: Workflow): Step => stepNamed(w, "The consumer's install");
/** The release call's inputs: `release.yml`'s one job that `uses:` the shared workflow. */
const releaseCall = (): Record<string, unknown> => Object.values(RELEASE.jobs).find((j) => j.uses !== undefined)?.with ?? {};

/** Every step after `touched` is conditional on it, and `touched` itself is not: an untouched change is a `success`, never a skip, because `gate` accepts `success` alone. */
function scopeProblems(w: Workflow): string[] {
  const steps = stepsOf(w);
  const at = steps.findIndex((s) => s.id === "touched");
  if (at < 0) return ["no step with id `touched`, so nothing decides whether the change touches what the release installs from"];
  const problems: string[] = [];
  if (steps[at]?.if !== undefined) problems.push("the `touched` step is itself conditional: the job would be skipped, and `gate` accepts success only");
  for (const step of steps.slice(at + 1)) {
    if (step.if !== TOUCHED) problems.push(`step "${step.name ?? step.uses}" is not conditional on \`${TOUCHED}\` (it is ${JSON.stringify(step.if)})`);
  }
  return problems;
}

/** The job writes nothing, holds no credential, and reaches no action beyond a checkout, pnpm and Node. */
function writeProblems(w: Workflow): string[] {
  const job = jobOf(w);
  const problems: string[] = [];
  if (JSON.stringify(job.permissions) !== JSON.stringify({ contents: "read" })) problems.push(`permissions are ${JSON.stringify(job.permissions)}, not {contents: read} alone`);
  const checkout = stepsOf(w).find((s) => s.uses?.startsWith("actions/checkout@"));
  if (checkout?.with?.["persist-credentials"] !== false) problems.push("the checkout keeps its credential (persist-credentials is not false)");
  for (const step of stepsOf(w)) {
    if (step.uses !== undefined && !ALLOWED_ACTIONS.some((prefix) => step.uses?.startsWith(prefix))) problems.push(`step uses ${step.uses}, which is not a checkout, pnpm or Node setup`);
    const run = step.run ?? "";
    for (const forbidden of [/\bgit\s+push\b/, /\bgit\s+(?:tag|commit)\b/, /\bgh\s/, /\$\{\{\s*(?:secrets|github\.token)/i, /GITHUB_TOKEN|GH_TOKEN|NODE_AUTH_TOKEN/, /id-token/]) {
      if (forbidden.test(run)) problems.push(`step "${step.name}" matches ${forbidden}: the dry run writes and pushes nothing`);
    }
  }
  return problems;
}

/** The toolchain is the release's: the pnpm, `changeset` CLI and Node `release.yml` hands the shared workflow. */
function toolchainProblems(w: Workflow, call: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const env = jobOf(w).env ?? {};
  if (String(env.PNPM_VERSION) !== String(call["pnpm-version"])) problems.push(`PNPM_VERSION is ${env.PNPM_VERSION}, release.yml's pnpm-version is ${call["pnpm-version"]}`);
  if (String(env.CHANGESETS_VERSION) !== String(call["changesets-version"])) problems.push(`CHANGESETS_VERSION is ${env.CHANGESETS_VERSION}, release.yml's changesets-version is ${call["changesets-version"]}`);
  const pnpm = stepsOf(w).find((s) => s.uses?.startsWith("pnpm/action-setup@"));
  if (pnpm?.with?.version !== "${{ env.PNPM_VERSION }}") problems.push(`pnpm/action-setup does not install \`env.PNPM_VERSION\` (${JSON.stringify(pnpm?.with?.version)})`);
  const node = stepsOf(w).find((s) => s.uses?.startsWith("actions/setup-node@"));
  if (String(node?.with?.["node-version"]) !== String(call["node-version"])) problems.push(`Node is ${node?.with?.["node-version"]}, release.yml's node-version is ${call["node-version"]}`);
  return problems;
}

/** The release's commands in the release's order, then the consumer's install with the consumer's flags. */
function commandProblems(w: Workflow): string[] {
  const problems: string[] = [];
  const version = versionStep(w).run ?? "";
  const order = ["pnpm install --frozen-lockfile", "pnpm exec changeset version", "pnpm install --lockfile-only"].map((c) => version.indexOf(c));
  if (order.some((i) => i < 0) || order.join() !== [...order].sort((a, b) => a - b).join()) problems.push(`the version step does not run install --frozen-lockfile, exec changeset version, install --lockfile-only in that order (${order})`);
  if (!/pnpm dlx "@changesets\/cli@\$CHANGESETS_VERSION" version/.test(version)) problems.push("the version step has no `pnpm dlx @changesets/cli@$CHANGESETS_VERSION version` path for a tree with no lockfile");
  if (!/git clone[^\n]*--depth=1[^\n]*"file:\/\/\$GITHUB_WORKSPACE" "\$scratch"/.test(version)) problems.push("the version step does not run in a scratch clone of the checkout");
  const consumer = consumerStep(w).run ?? "";
  if (!/npx "pnpm@\$PNPM_VERSION" install --frozen-lockfile --ignore-scripts/.test(consumer)) problems.push("the consumer step does not run `npx pnpm@$PNPM_VERSION install --frozen-lockfile --ignore-scripts`");
  if (!/npm install --no-save --no-package-lock --ignore-scripts --no-audit --no-fund/.test(consumer)) problems.push("the consumer step has no npm fresh-resolution path for a tree with no lockfile");
  if (!/if \[ -f pnpm-lock\.yaml \]/.test(consumer)) problems.push("the consumer step does not choose by whether the tree has pnpm-lock.yaml");
  for (const [name, text] of [["version", version], ["consumer", consumer]] as const) {
    if (text.includes("${{")) problems.push(`the ${name} step holds an expression, which a script run outside Actions cannot evaluate: pass it by env`);
  }
  return problems;
}

/** `gate` waits for the job and reads its result, so a red dry run is a red required check. */
function gateProblems(w: Workflow): string[] {
  const gate = w.jobs.gate;
  const needs = Array.isArray(gate?.needs) ? gate.needs : [gate?.needs];
  const problems: string[] = [];
  if (!needs.includes(JOB)) problems.push(`gate does not need ${JOB} (needs: ${JSON.stringify(gate?.needs)})`);
  const text = (gate?.steps ?? []).map((s) => s.run ?? "").join("\n");
  if (!text.includes(`needs.${JOB}.result`)) problems.push(`gate's check does not read needs.${JOB}.result`);
  return problems;
}

test("the real ci.yml has the job, scoped, read-only, on the release's toolchain, with the release's commands, and gate waits for it", () => {
  assert.ok(jobOf(CI).steps?.length, `ci.yml has no ${JOB} job`);
  assert.deepEqual(scopeProblems(CI), []);
  assert.deepEqual(writeProblems(CI), []);
  assert.deepEqual(toolchainProblems(CI, releaseCall()), []);
  assert.deepEqual(commandProblems(CI), []);
  assert.deepEqual(gateProblems(CI), []);
  assert.ok(typeof releaseCall()["pnpm-version"] === "string", "release.yml's call carries no pnpm-version: the toolchain comparison read nothing");
});

test("each structural property is seen to FAIL on a copy with exactly that thing broken", () => {
  const broke = (mutate: (w: Workflow) => void) => { const w = clone(CI); mutate(w); return w; };
  const stepAfterTouched = (w: Workflow) => stepsOf(w).find((s) => s.run !== undefined && s.id !== "touched") as Step;

  assert.notDeepEqual(scopeProblems(broke((w) => { delete stepAfterTouched(w).if; })), [], "a step with no condition ran on every change");
  assert.notDeepEqual(scopeProblems(broke((w) => { touchedStep(w).if = "always()"; })), [], "a conditional `touched` step is a skipped job");
  assert.notDeepEqual(scopeProblems(broke((w) => { w.jobs[JOB]!.steps = stepsOf(w).filter((s) => s.id !== "touched"); })), [], "no `touched` step");

  assert.notDeepEqual(writeProblems(broke((w) => { w.jobs[JOB]!.permissions = { contents: "write" }; })), [], "write permission");
  assert.notDeepEqual(writeProblems(broke((w) => { delete w.jobs[JOB]!.permissions; })), [], "no permissions block is the repository default");
  assert.notDeepEqual(writeProblems(broke((w) => { stepsOf(w)[0]!.with!["persist-credentials"] = true; })), [], "a checkout keeping its credential");
  assert.notDeepEqual(writeProblems(broke((w) => { versionStep(w).run += "\ngit push origin HEAD:refs/tags/v0"; })), [], "a push");
  assert.notDeepEqual(writeProblems(broke((w) => { stepsOf(w).push({ uses: "actions/upload-artifact@v7" }); })), [], "an action beyond checkout, pnpm and Node");

  assert.notDeepEqual(toolchainProblems(broke((w) => { jobOf(w).env!.PNPM_VERSION = "9.0.0"; }), releaseCall()), [], "a pnpm that is not the release's");
  assert.notDeepEqual(toolchainProblems(broke((w) => { jobOf(w).env!.CHANGESETS_VERSION = "2.0.0"; }), releaseCall()), [], "a changesets CLI that is not the release's");
  assert.notDeepEqual(toolchainProblems(broke((w) => { stepsOf(w).find((s) => s.uses?.startsWith("actions/setup-node@"))!.with!["node-version"] = "24"; }), releaseCall()), [], "a Node that is not the release's");
  assert.notDeepEqual(toolchainProblems(broke((w) => { stepsOf(w).find((s) => s.uses?.startsWith("pnpm/action-setup@"))!.with!.version = "9"; }), releaseCall()), [], "a pnpm install that ignores PNPM_VERSION");

  assert.notDeepEqual(commandProblems(broke((w) => { versionStep(w).run = versionStep(w).run!.replace("pnpm install --frozen-lockfile", "pnpm install"); })), [], "an install that is not frozen");
  assert.notDeepEqual(commandProblems(broke((w) => { versionStep(w).run = versionStep(w).run!.replace("pnpm exec changeset version", "pnpm dlx changeset version"); })), [], "a changeset version that is not the repository's own");
  assert.notDeepEqual(commandProblems(broke((w) => { consumerStep(w).run = consumerStep(w).run!.replace("--frozen-lockfile --ignore-scripts", "--frozen-lockfile"); })), [], "a consumer install without --ignore-scripts");
  assert.notDeepEqual(commandProblems(broke((w) => { consumerStep(w).run = consumerStep(w).run!.replace('npx "pnpm@$PNPM_VERSION"', "pnpm"); })), [], "a consumer install by the job's own pnpm");

  assert.notDeepEqual(gateProblems(broke((w) => { w.jobs.gate!.needs = ["suite", "typecheck", "changeset"]; })), [], "gate that does not wait for the job");
  assert.notDeepEqual(gateProblems(broke((w) => { for (const s of w.jobs.gate!.steps ?? []) s.run = (s.run ?? "").replace(`needs.${JOB}.result`, "needs.suite.result"); })), [], "gate that never reads the job's result");
});

// ---- behaviour: the job's own scripts, run by bash in fixture repositories ----

const SCRATCH = mkdtempSync(join(tmpdir(), "release-dry-run-"));
const REAL_PNPM = spawnSync("bash", ["-c", "command -v pnpm"], { encoding: "utf8" }).stdout.trim();
let counter = 0;
const fresh = (label: string): string => { const dir = join(SCRATCH, `${label}-${counter++}`); mkdirSync(dir, { recursive: true }); return dir; };

const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid" };
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...GIT_ENV } });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
};

const STUB_CLI = { "stub-cli/package.json": JSON.stringify({ name: "@changesets/cli", version: "3.0.1", bin: { changeset: "cli.js" } }), "stub-cli/cli.js": '#!/usr/bin/env node\nconsole.log("stub changeset", process.argv.slice(2).join(" "));\n' };
const LOCKFILE_HEAD = "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\nimporters:\n\n";
/** The lockfile of a tree that declares `@changesets/cli` (here a `link:` to a stub, so the install needs no registry). */
const LOCK_WITH_CLI = `${LOCKFILE_HEAD}  .:\n    devDependencies:\n      '@changesets/cli':\n        specifier: link:./stub-cli\n        version: link:stub-cli\n`;
/** #885's shape: a lockfile exists, and it names no `@changesets/cli`, so the release's `pnpm exec changeset` has nothing to run. */
const LOCK_WITHOUT_CLI = `${LOCKFILE_HEAD}  .: {}\n`;

type Fixture = "with-cli" | "without-cli" | "no-lockfile" | "lockfile-disagrees";
function files(kind: Fixture): Record<string, string> {
  const dependsOnCli = JSON.stringify({ name: "fixture", version: "1.0.0", private: true, devDependencies: { "@changesets/cli": "link:./stub-cli" } });
  const bare = JSON.stringify({ name: "fixture", version: "1.0.0", private: true });
  switch (kind) {
    case "with-cli": return { "package.json": dependsOnCli, "pnpm-lock.yaml": LOCK_WITH_CLI, ...STUB_CLI };
    case "without-cli": return { "package.json": bare, "pnpm-lock.yaml": LOCK_WITHOUT_CLI };
    case "no-lockfile": return { "package.json": bare };
    // package.json declares a dependency the lockfile does not: `pnpm install --frozen-lockfile` refuses it (ERR_PNPM_OUTDATED_LOCKFILE).
    case "lockfile-disagrees": return { "package.json": dependsOnCli, "pnpm-lock.yaml": LOCK_WITHOUT_CLI, ...STUB_CLI };
  }
}

/** A repository whose last commit changes `changedPath` on top of a base commit: what a pull request's merge ref looks like to `git diff HEAD^1 HEAD`. */
function repo(kind: Fixture, changedPath: string): string {
  const dir = fresh("repo");
  git(dir, "init", "-q", "-b", "main");
  for (const [path, text] of Object.entries({ ...files(kind), "src/a.ts": "export const a = 1;\n" })) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  mkdirSync(join(dir, changedPath, ".."), { recursive: true });
  // A blank line is a change to git and valid in every format the fixtures use (JSON, YAML, `.npmrc`, TypeScript).
  writeFileSync(join(dir, changedPath), "\n", { flag: "a" });
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "change");
  return dir;
}

/** Recorders: a command named here logs its argv to `$SHIM_LOG`; `npx pnpm@<v> ...` runs the real pnpm (offline fixtures need no registry), and any other npx is refused. */
function shims(options: { fake?: string[] } = {}): { dir: string; log: string } {
  const dir = fresh("shims");
  const log = join(dir, "log");
  writeFileSync(log, "");
  const script = (name: string, body: string) => { writeFileSync(join(dir, name), `#!/bin/bash\n${body}\n`); chmodSync(join(dir, name), 0o755); };
  script("npx", `echo "npx $*" >> "$SHIM_LOG"\ncase "$1" in pnpm@*) shift; exec "${REAL_PNPM}" "$@";; esac\necho "unexpected npx $*" >&2; exit 97`);
  script("pnpm", `echo "pnpm $*" >> "$SHIM_LOG"\n${options.fake?.includes("pnpm") ? "exit 0" : `exec "${REAL_PNPM}" "$@"`}`);
  script("npm", `echo "npm $*" >> "$SHIM_LOG"\nexit 0`);
  return { dir, log };
}

function runStep(step: Step, cwd: string, options: { fake?: string[] } = {}) {
  assert.ok(step.run, "the step to run was not found in ci.yml");
  const { dir, log } = shims(options);
  const outputFile = join(dir, "github-output");
  writeFileSync(outputFile, "");
  const script = join(dir, "step.sh");
  writeFileSync(script, step.run);
  const runner = fresh("runner-temp");
  const result = spawnSync("bash", ["-e", script], {
    cwd,
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, ...GIT_ENV, ...jobOf(CI).env, PATH: `${dir}:${process.env.PATH}`, CI: "true", GITHUB_WORKSPACE: cwd, RUNNER_TEMP: runner, GITHUB_OUTPUT: outputFile, SHIM_LOG: log },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    outputs: readFileSync(outputFile, "utf8").trim(),
    calls: readFileSync(log, "utf8").split("\n").filter(Boolean),
  };
}

test("pnpm is on PATH for the behaviour checks (the suite job installs it before the tests; a runner image carries npm, not pnpm)", () => {
  assert.ok(REAL_PNPM, "pnpm is not on PATH, so every behaviour check below would run nothing");
});

test("`touched` is true for each of the four paths and false for a change that cannot move the install", () => {
  const cases: Array<[string, boolean]> = [
    ["package.json", true],
    ["pnpm-lock.yaml", true],
    [".npmrc", true],
    [".github/workflows/ci.yml", true],
    [".github/workflows/some-new-workflow.yml", true],
    ["src/a.ts", false],
    ["README.md", false],
    // Only the ROOT manifest is the release's: a fixture's `package.json` beside a test is not, and neither is a path that merely begins with the name.
    ["src/fixtures/package.json", false],
    ["package.json.md", false],
    [".github/CODEOWNERS", false],
  ];
  for (const [path, expected] of cases) {
    const ran = runStep(touchedStep(CI), repo("with-cli", path));
    assert.equal(ran.status, 0, `${path}: ${ran.output}`);
    assert.equal(ran.outputs, `touched=${expected}`, `${path} should give touched=${expected}`);
  }
  // Both outcomes are in the table, so a script that always said `true` or always `false` fails above.
  assert.ok(cases.some(([, expected]) => expected) && cases.some(([, expected]) => !expected));
});

test("the version step passes on a tree whose lockfile carries @changesets/cli, in the release's order", () => {
  const ran = runStep(versionStep(CI), repo("with-cli", "package.json"));
  assert.equal(ran.status, 0, ran.output);
  assert.match(ran.output, /stub changeset version/, "the repository's own `changeset version` was not what ran");
  const pnpmCalls = ran.calls.filter((c) => c.startsWith("pnpm "));
  assert.deepEqual(pnpmCalls, ["pnpm install --frozen-lockfile", "pnpm exec changeset version", "pnpm install --lockfile-only"]);
});

test("the version step FAILS on a fixture whose lockfile omits @changesets/cli (agent-org#885)", () => {
  const ran = runStep(versionStep(CI), repo("without-cli", "pnpm-lock.yaml"));
  assert.notEqual(ran.status, 0, `the dry run passed a tree whose release would fail:\n${ran.output}`);
  assert.match(ran.output, /changeset/);
  // It got as far as the version command: the failure is the one the release met, not an install that never started.
  assert.ok(ran.calls.includes("pnpm exec changeset version"), `the version command never ran: ${ran.calls}`);
});

test("a tree with no lockfile takes the release's `pnpm dlx @changesets/cli@<version> version` path", () => {
  const ran = runStep(versionStep(CI), repo("no-lockfile", "package.json"), { fake: ["pnpm"] });
  assert.equal(ran.status, 0, ran.output);
  assert.deepEqual(ran.calls.filter((c) => c.startsWith("pnpm ")), [`pnpm dlx @changesets/cli@${String(releaseCall()["changesets-version"])} version`]);
});

test("the consumer step installs a tree with a lockfile as `pnpm@<release's pnpm> install --frozen-lockfile --ignore-scripts`", () => {
  const ran = runStep(consumerStep(CI), repo("with-cli", "package.json"));
  assert.equal(ran.status, 0, ran.output);
  assert.deepEqual(ran.calls, [`npx pnpm@${String(releaseCall()["pnpm-version"])} install --frozen-lockfile --ignore-scripts`]);
});

test("the consumer step FAILS where the lockfile disagrees with package.json, which a consumer's frozen install refuses", () => {
  const ran = runStep(consumerStep(CI), repo("lockfile-disagrees", "package.json"));
  assert.notEqual(ran.status, 0, `the consumer's install passed a tree it cannot install:\n${ran.output}`);
  assert.ok(ran.calls.some((c) => c.includes("--frozen-lockfile --ignore-scripts")), `the frozen install never ran: ${ran.calls}`);
});

test("the consumer step falls back to npm's fresh resolution for a tree with no lockfile, as the consumer does", () => {
  const ran = runStep(consumerStep(CI), repo("no-lockfile", "package.json"));
  assert.equal(ran.status, 0, ran.output);
  assert.deepEqual(ran.calls, ["npm install --no-save --no-package-lock --ignore-scripts --no-audit --no-fund"]);
});
