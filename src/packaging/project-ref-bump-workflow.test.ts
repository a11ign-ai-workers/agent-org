// no-token: gh
// a11ign/a11ign#5151: this file runs the workflow's own `run:` text with `gh` replaced by a fake first on PATH, so it never reaches GitHub and holds no token.
/**
 * a11ign/a11ign#5151: `PROJECT_REF` ADVANCES BY ITSELF, AND THE WORKFLOW THAT MOVES IT DOES NOT MOVE IT WRONG.
 *
 * Three halves, each with the control that shows it can fail:
 *   - the POLICY (`.github/chainguard/project-ref-bump.sts.yaml`): mints for main's copy of this workflow on its three triggers and for nothing else.
 *   - the WORKFLOW'S SHAPE: default off behind one variable, the mint before the use, no `${{ }}` inside a script, the branch name the classifier looks for.
 *   - the WORKFLOW'S SCRIPTS, RUN as the runner would (`bash -e`, the step's `env:` resolved by hand) against a fake `gh` that answers from a world
 *     and records every call: which commit is chosen, what is written, what is armed, what is refreshed, and what is left alone.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { fileURLToPath } from "node:url";
import { HOLD_PREFIX } from "../pr-hold-state.ts";
import { PIN_BUMP_BRANCH, PROJECT_REPOSITORY } from "../ci-failure-class.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (path: string) => readFileSync(`${ROOT}${path}`, "utf8");
const withoutComments = (text: string) => text.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
const fullMatch = (pattern: string, value: string) => new RegExp(`^(?:${pattern})$`).test(value);

type Step = { name?: string, if?: string, uses?: string, env?: Record<string, string>, run?: string, with?: Record<string, string> };
type Job = { if?: string, permissions?: Record<string, string>, steps: Step[], concurrency?: { group?: string } };
type Workflow = { on: Record<string, unknown>, permissions?: Record<string, string>, env: Record<string, string>, jobs: Record<string, Job> };

const WORKFLOW_PATH = ".github/workflows/project-ref-bump.yml";
const workflowText = read(WORKFLOW_PATH);
const workflow = parseYaml(workflowText) as Workflow;
const policyText = read(".github/chainguard/project-ref-bump.sts.yaml");
const policy = parseYaml(policyText) as {
  issuer: string, subject_pattern: string, claim_pattern: Record<string, string>, permissions: Record<string, string>,
};

function stepNamed(job: string, fragment: string): Step {
  const step = workflow.jobs[job]?.steps.find((s) => (s.name ?? "").includes(fragment));
  assert.ok(step, `${job} has a step named like "${fragment}"`);
  return step;
}

// ---------------------------------------------------------------- the policy

const SUB = "repo:a11ign@320310787/agent-org@1388747923:ref:refs/heads/main";
const REF = "a11ign/agent-org/.github/workflows/project-ref-bump.yml@refs/heads/main";
type Claims = { sub: string, job_workflow_ref: string, event_name: string };
const mints = (p: typeof policy, c: Claims) =>
  fullMatch(p.subject_pattern, c.sub) && fullMatch(p.claim_pattern.job_workflow_ref!, c.job_workflow_ref) && fullMatch(p.claim_pattern.event_name!, c.event_name);

test("a11ign/a11ign#5151: the policy grants contents, pull-request, workflow write and actions read, and nothing else", () => {
  assert.deepEqual(policy.permissions, { contents: "write", pull_requests: "write", workflows: "write", actions: "read" });
  assert.equal(policy.issuer, "https://token.actions.githubusercontent.com");
});

test("a11ign/a11ign#5151: the policy mints for main's copy of this workflow on its three triggers and refuses the rest", () => {
  for (const event_name of ["schedule", "workflow_dispatch", "push"]) {
    assert.ok(mints(policy, { sub: SUB, job_workflow_ref: REF, event_name }), `${event_name} on main must mint`);
  }
  const refused: Array<[string, Claims]> = [
    ["a pull_request event", { sub: "repo:a11ign@320310787/agent-org@1388747923:pull_request", job_workflow_ref: "a11ign/agent-org/.github/workflows/project-ref-bump.yml@refs/pull/9/merge", event_name: "pull_request" }],
    ["a dispatch on another branch", { sub: "repo:a11ign@320310787/agent-org@1388747923:ref:refs/heads/agent/x", job_workflow_ref: REF.replace("refs/heads/main", "refs/heads/agent/x"), event_name: "workflow_dispatch" }],
    ["another workflow of this repository", { sub: SUB, job_workflow_ref: REF.replace("project-ref-bump", "auto-arm"), event_name: "schedule" }],
    ["a file merely ending the same way", { sub: SUB, job_workflow_ref: REF.replace("bump.yml", "bump.yml.evil"), event_name: "schedule" }],
    ["another repository's id", { sub: "repo:a11ign@320310787/other@1:ref:refs/heads/main", job_workflow_ref: REF, event_name: "schedule" }],
    ["an event this workflow does not have", { sub: SUB, job_workflow_ref: REF, event_name: "pull_request_target" }],
  ];
  for (const [label, claims] of refused) assert.ok(!mints(policy, claims), `${label} must NOT mint`);
});

test("a11ign/a11ign#5151 POSITIVE CONTROL for the matcher: a policy widened to any subject mints for what the real one refuses", () => {
  const widened = { ...policy, subject_pattern: ".*" };
  const claims = { sub: "repo:evil@1/evil@2:pull_request", job_workflow_ref: REF, event_name: "schedule" };
  assert.ok(mints(widened, claims), "the matcher must be able to say yes");
  assert.ok(!mints(policy, claims), "and the real policy says no");
});

// ---------------------------------------------------------------- the workflow's shape

test("a11ign/a11ign#5151: it is hourly, dispatchable, and refreshes on a push to main that touches ci.yml; the jobs are default off behind ONE variable", () => {
  const on = workflow.on as { schedule: Array<{ cron: string }>, workflow_dispatch: unknown, push: { branches: string[], paths: string[] } };
  assert.match(on.schedule[0]!.cron, /^\d{1,2} \* \* \* \*$/, "once an hour");
  assert.ok("workflow_dispatch" in on);
  assert.deepEqual(on.push, { branches: ["main"], paths: [".github/workflows/ci.yml"] });
  for (const job of ["bump", "refresh"]) {
    assert.match(workflow.jobs[job]!.if ?? "", /vars\.CI_AUTO_BUMP_PROJECT_REF == 'true'/, `${job} runs only with the flag on`);
  }
  assert.match(workflow.jobs.bump!.if!, /github\.event_name != 'push'/, "a push never starts the bump");
  assert.match(workflow.jobs.refresh!.if!, /github\.event_name == 'push'/, "only a push starts the refresh");
});

test("a11ign/a11ign#5151: the branch name and the hold prefix mirror what the classifier and the arming path read", () => {
  assert.equal(workflow.env.BUMP_BRANCH, PIN_BUMP_BRANCH, "ci-failure-class.ts finds the open bump by this head");
  assert.equal(workflow.env.PROJECT_REPOSITORY, PROJECT_REPOSITORY);
  assert.equal(workflow.env.HOLD_PREFIX, HOLD_PREFIX);
});

test("a11ign/a11ign#5151: each job mints before it uses the token, with the pinned action and this identity, and reads no stored token", () => {
  const code = withoutComments(workflowText);
  assert.doesNotMatch(code, /secrets\.|A11IGN_BOT_TOKEN|FALLBACK_TOKEN/, "no stored or fallback token");
  assert.match(code, /uses: octo-sts\/action@[0-9a-f]{40} # v/, "the commit is pinned, not the movable tag");
  for (const job of ["bump", "refresh"]) {
    const steps = workflow.jobs[job]!.steps;
    const mint = steps.findIndex((s) => (s.uses ?? "").startsWith("octo-sts/action@"));
    const use = steps.findIndex((s) => (s.env?.GH_TOKEN ?? "").includes("steps.octo-sts.outputs.token"));
    assert.ok(mint >= 0 && use > mint, `${job}: the step that reads the minted token comes after the mint`);
    assert.equal(steps[mint]!.with?.identity, "project-ref-bump");
    assert.deepEqual(workflow.jobs[job]!.permissions, { contents: "read", "id-token": "write" }, `${job} holds the OIDC request and a read, no write`);
  }
  assert.deepEqual(workflow.permissions, { contents: "read" });
});

test("a11ign/a11ign#5151: no script interpolates a `${{ }}` expression: every value arrives through env", () => {
  const scripts = Object.values(workflow.jobs).flatMap((job) => job.steps.map((s) => s.run ?? "")).filter(Boolean);
  assert.ok(scripts.length >= 3, "the population is not empty: there are scripts to read");
  for (const script of scripts) assert.doesNotMatch(script, /\$\{\{/);
});

// ---------------------------------------------------------------- the scripts, run against a fake gh

const CI_TEXT = read(".github/workflows/ci.yml");
const PIN = /^ {2}PROJECT_REF: ([0-9a-f]{40})\s*$/m.exec(CI_TEXT)![1]!;
const hex = (c: string) => c.repeat(40);
const TARGET = hex("b");
const REPO = "a11ign/agent-org";
const BUMP = PIN_BUMP_BRANCH;

type World = {
  repo: string, project: string, bump: string, ciText: string,
  mainSha: string, pins: Record<string, string>,
  commits: string[], gate: Record<string, string[]>, status: Record<string, string>,
  branch: boolean, behindBy: number, openPr: number | null, labels: string[],
  prs: Array<{ number: number, head: { ref: string, repo: { full_name: string } } }>,
  runs: Record<string, { id: number, conclusion: string }>, logs: Record<string, string>, refuseUpdate: boolean,
};

const FAKE_GH = `#!/usr/bin/env node
const fs = require("fs"); const cp = require("child_process");
const world = JSON.parse(fs.readFileSync(process.env.FAKE_WORLD, "utf8"));
const log = (line) => fs.appendFileSync(process.env.FAKE_LOG, line + "\\n");
const args = process.argv.slice(2);
const fields = {}; let method = "GET"; let jq = ""; let raw = false; let path = "";
if (args[0] === "pr" && args[1] === "merge") { log("pr merge " + args.slice(2).join(" ")); process.exit(0); }
if (args[0] === "run" && args[1] === "view") { log("run view " + args[2]); process.stdout.write(world.logs[args[2]] || ""); process.exit(0); }
if (args[0] !== "api") { log("UNROUTED " + args.join(" ")); process.exit(2); }
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "-X") method = args[++i];
  else if (a === "-H") raw = /raw/.test(args[++i]);
  else if (a === "--jq") jq = args[++i];
  else if (a === "-f" || a === "-F") {
    const eq = args[++i].indexOf("=");
    const key = args[i].slice(0, eq); let value = args[i].slice(eq + 1);
    if (value.startsWith("@")) value = fs.readFileSync(value.slice(1), "utf8");
    fields[key] = value;
  } else path = a;
}
const [p, query = ""] = path.split("?");
const reply = (json) => {
  if (!jq) { process.stdout.write(JSON.stringify(json)); return; }
  const r = cp.spawnSync("jq", ["-r", jq], { input: JSON.stringify(json), encoding: "utf8" });
  process.stdout.write(r.stdout);
};
const ciFor = (ref) => world.ciText.replace(/^ {2}PROJECT_REF: .*$/m, "  PROJECT_REF: " + (world.pins[ref] || world.pins.main));
const r = world.repo, proj = world.project;
let m;
log(method + " " + path);
if ((m = p === "repos/" + r + "/contents/.github/workflows/ci.yml")) {
  const ref = (/ref=([^&]+)/.exec(query) || [])[1] || "main";
  if (method === "PUT") {
    fs.writeFileSync(process.env.FAKE_WRITTEN, Buffer.from(fields.content, "base64").toString("utf8"));
    log("PUT-FIELDS branch=" + fields.branch + " message=" + fields.message);
  } else if (raw) process.stdout.write(ciFor(ref));
  else reply({ content: Buffer.from(ciFor(ref)).toString("base64"), sha: "blob" });
} else if (p === "repos/" + proj + "/commits") reply(world.commits.map((sha) => ({ sha })));
else if ((m = /^repos\\/[^/]+\\/[^/]+\\/commits\\/([0-9a-f]+)\\/check-runs$/.exec(p))) reply({ check_runs: (world.gate[m[1]] || []).map((conclusion) => ({ conclusion })) });
else if ((m = new RegExp("^repos/" + proj + "/compare/[0-9a-f]+\\\\.\\\\.\\\\.([0-9a-f]+)$").exec(p))) reply({ status: world.status[m[1]] || "diverged" });
else if (p.startsWith("repos/" + r + "/compare/")) reply({ behind_by: world.behindBy });
else if (p === "repos/" + r + "/git/ref/heads/main") reply({ object: { sha: world.mainSha } });
else if (p === "repos/" + r + "/git/ref/heads/" + world.bump) { if (!world.branch) { process.stderr.write("HTTP 404\\n"); process.exit(1); } reply({ object: { sha: "c".repeat(40) } }); }
else if (p.startsWith("repos/" + r + "/git/refs")) { log("REF-FIELDS " + JSON.stringify(fields)); reply({}); }
else if (p === "repos/" + r + "/pulls" && method === "GET" && query.includes("head=")) reply(world.openPr ? [{ number: world.openPr }] : []);
else if (p === "repos/" + r + "/pulls" && method === "GET") reply(world.prs);
else if (p === "repos/" + r + "/pulls" && method === "POST") { log("PULL-FIELDS " + JSON.stringify(fields)); reply({ number: 77 }); }
else if ((m = /\\/pulls\\/(\\d+)\\/update-branch$/.exec(p))) { if (world.refuseUpdate) { process.stderr.write("HTTP 422\\n"); process.exit(1); } reply({}); }
else if (/\\/pulls\\/\\d+$/.test(p) && method === "PATCH") { log("PULL-FIELDS " + JSON.stringify(fields)); reply({}); }
else if (/\\/issues\\/\\d+\\/labels$/.test(p)) reply(world.labels.map((name) => ({ name })));
else if ((m = /actions\\/runs$/.exec(p))) { const br = (/branch=([^&]+)/.exec(query) || [])[1]; reply({ workflow_runs: world.runs[br] ? [world.runs[br]] : [] }); }
else { log("UNROUTED " + method + " " + path); process.stderr.write("fake gh: unrouted " + path + "\\n"); process.exit(1); }
`;

const baseWorld = (): World => ({
  repo: REPO, project: PROJECT_REPOSITORY, bump: BUMP, ciText: CI_TEXT,
  mainSha: hex("1"), pins: { main: PIN },
  // newest first: a red commit, the green target, a commit that never got a gate, then the pin itself and older.
  commits: [hex("d"), TARGET, hex("e"), PIN, hex("f")],
  gate: { [hex("d")]: ["failure"], [TARGET]: ["success"], [PIN]: ["success"] }, status: { [TARGET]: "ahead", [hex("d")]: "ahead" },
  branch: false, behindBy: 0, openPr: null, labels: [], prs: [], runs: {}, logs: {}, refuseUpdate: false,
});

type Outcome = { status: number | null, stdout: string, stderr: string, calls: string[], written: string | null, output: Record<string, string> };

/** Run one step of the workflow's own script, as the runner would, with the fake `gh` and `world`. */
function runStep(job: string, fragment: string, world: World, env: Record<string, string> = {}): Outcome {
  const dir = mkdtempSync(join(tmpdir(), "project-ref-bump-"));
  try {
    const step = stepNamed(job, fragment);
    writeFileSync(join(dir, "gh"), FAKE_GH);
    chmodSync(join(dir, "gh"), 0o755);
    writeFileSync(join(dir, "world.json"), JSON.stringify(world));
    const literal = (record: Record<string, string> | undefined) => Object.fromEntries(Object.entries(record ?? {}).filter(([, v]) => !String(v).includes("${{")));
    const result = spawnSync("bash", ["-e", "-c", step.run ?? ""], {
      cwd: dir,
      encoding: "utf8",
      env: {
        PATH: `${dir}:${process.env.PATH}`,
        ...literal(workflow.env), ...literal(step.env),
        // The runner's own values for what the step's `env:` takes from `${{ }}`; `gh` is the fake, so the token only has to exist.
        GH_TOKEN: "minted", REPOSITORY: REPO, RUNNER_TEMP: dir, GITHUB_OUTPUT: join(dir, "output"),
        FAKE_WORLD: join(dir, "world.json"), FAKE_LOG: join(dir, "calls"), FAKE_WRITTEN: join(dir, "written"),
        ...env,
      },
    });
    const text = (name: string) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), "utf8") : "");
    const output = Object.fromEntries(text("output").split("\n").filter(Boolean).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
    return {
      status: result.status, stdout: result.stdout, stderr: result.stderr,
      calls: text("calls").split("\n").filter(Boolean), written: existsSync(join(dir, "written")) ? text("written") : null, output,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const NEWEST = "The pin, and the newest project commit";
const OPEN = "Open or update the one bump pull request";
const REFRESH = "Update the branch of each pull request";
const noUnrouted = (o: Outcome) => assert.deepEqual(o.calls.filter((c) => c.startsWith("UNROUTED")), [], `every call was one the fake knows: ${o.stderr}`);
const writes = (o: Outcome) => o.calls.filter((c) => /^(PUT|POST|PATCH) /.test(c) || c.startsWith("pr merge"));

test("a11ign/a11ign#5151: the newest green commit past the pin is chosen; a red one and one with no gate are passed over; nothing is written", () => {
  const o = runStep("bump", NEWEST, baseWorld());
  assert.equal(o.status, 0, o.stderr);
  noUnrouted(o);
  assert.deepEqual(o.output, { pin: PIN, target: TARGET });
  assert.deepEqual(writes(o), [], "the read step writes nothing");
});

test("a11ign/a11ign#5151 CONTROLS: no target when the pin is already the newest, when nothing past it is green, and when it is not AHEAD of the pin", () => {
  // `ahead` is claimed for the pin itself so that only the walk's stop at the pin, not the compare, keeps it from being chosen.
  const atPin = { ...baseWorld(), commits: [PIN, hex("f")], status: { [PIN]: "ahead" } };
  const nothingGreen = { ...baseWorld(), gate: { [hex("d")]: ["failure"], [TARGET]: ["failure"] } };
  const runningGate = { ...baseWorld(), gate: { [hex("d")]: ["failure"], [TARGET]: [] } };
  const notAhead = { ...baseWorld(), status: { [TARGET]: "diverged", [hex("d")]: "diverged" }, gate: { [hex("d")]: ["failure"], [TARGET]: ["success"] } };
  for (const [label, world] of [["pin is newest", atPin], ["nothing green", nothingGreen], ["gate not reported", runningGate], ["not ahead", notAhead]] as const) {
    const o = runStep("bump", NEWEST, world);
    assert.equal(o.status, 0, `${label}: ${o.stderr}`);
    assert.equal(o.output.target, "", `${label}: no target`);
  }
});

test("a11ign/a11ign#5151: a main with no full-sha PROJECT_REF line is an error, not a bump to nothing", () => {
  const o = runStep("bump", NEWEST, { ...baseWorld(), pins: { main: "main" } });
  assert.notEqual(o.status, 0);
  assert.match(o.stdout + o.stderr, /PROJECT-REF-BUMP: ci\.yml on main has no PROJECT_REF line/);
});

const bumpEnv = { PIN, TARGET };

test("a11ign/a11ign#5151: with no branch and no pull request, it creates the branch at main, writes ONE line, opens ONE pull request and arms it", () => {
  const o = runStep("bump", OPEN, baseWorld(), bumpEnv);
  assert.equal(o.status, 0, o.stderr);
  noUnrouted(o);
  assert.ok(o.calls.some((c) => c === `POST repos/${REPO}/git/refs`), "the branch is created");
  assert.ok(o.calls.some((c) => c.startsWith(`PUT repos/${REPO}/contents/.github/workflows/ci.yml`)), "the file is written");
  assert.ok(o.calls.some((c) => c === `POST repos/${REPO}/pulls`), "ONE pull request is opened");
  assert.equal(o.calls.filter((c) => c.startsWith("pr merge")).length, 1);
  assert.match(o.calls.find((c) => c.startsWith("pr merge"))!, /^pr merge 77 --repo a11ign\/agent-org --auto --merge$/);
  // The write is main's ci.yml with exactly the PROJECT_REF line changed: the diff is one line.
  const was = CI_TEXT.split("\n");
  const now = o.written!.split("\n");
  assert.equal(now.length, was.length);
  const changed = now.map((line, i) => [was[i], line] as const).filter(([a, b]) => a !== b);
  assert.deepEqual(changed, [[`  PROJECT_REF: ${PIN}`, `  PROJECT_REF: ${TARGET}`]]);
  assert.match(o.calls.find((c) => c.startsWith("PULL-FIELDS"))!, /Closes: none -- /, "the body carries the Closes line the merge gate wants");
});

test("a11ign/a11ign#5151: a branch that already carries the target on main's head is not rewritten, and the ONE pull request is updated, not duplicated", () => {
  const world = { ...baseWorld(), branch: true, pins: { main: PIN, [BUMP]: TARGET }, behindBy: 0, openPr: 41 };
  const o = runStep("bump", OPEN, world, bumpEnv);
  assert.equal(o.status, 0, o.stderr);
  noUnrouted(o);
  assert.deepEqual(o.calls.filter((c) => /^(PUT|PATCH) repos\/[^/]+\/[^/]+\/(contents|git\/refs)/.test(c) || c.includes("POST")), [], "no branch write and no new pull request");
  assert.ok(o.calls.includes(`PATCH repos/${REPO}/pulls/41`));
  assert.ok(o.calls.some((c) => c.startsWith("pr merge 41 ")));
});

test("a11ign/a11ign#5151: a branch at an OLDER pin, or behind main, is reset to main's head before the one-line commit, never stacked", () => {
  for (const [label, world] of [
    ["older pin", { ...baseWorld(), branch: true, pins: { main: PIN, [BUMP]: hex("9") }, behindBy: 0, openPr: 41 }],
    ["behind main", { ...baseWorld(), branch: true, pins: { main: PIN, [BUMP]: TARGET }, behindBy: 3, openPr: 41 }],
  ] as const) {
    const o = runStep("bump", OPEN, world, bumpEnv);
    assert.equal(o.status, 0, `${label}: ${o.stderr}`);
    const reset = o.calls.findIndex((c) => c.startsWith("REF-FIELDS"));
    const put = o.calls.findIndex((c) => c.startsWith("PUT-FIELDS"));
    assert.ok(reset >= 0 && put > reset, `${label}: reset first, then write`);
    assert.match(o.calls[reset]!, /"force":"true"/);
    assert.match(o.calls[reset]!, new RegExp(`"sha":"${hex("1")}"`));
    assert.ok(o.calls.includes(`PATCH repos/${REPO}/git/refs/heads/${BUMP}`), `${label}: the existing branch is moved, not recreated`);
  }
});

test("a11ign/a11ign#5151: a `hold:` label keeps the pull request open and unarmed, and is a success", () => {
  const held = runStep("bump", OPEN, { ...baseWorld(), branch: true, pins: { main: PIN, [BUMP]: TARGET }, openPr: 41, labels: [`${HOLD_PREFIX}ceo`, "x"] }, bumpEnv);
  assert.equal(held.status, 0, held.stderr);
  assert.deepEqual(held.calls.filter((c) => c.startsWith("pr merge")), []);
  assert.match(held.stdout, /not arming #41: held by hold:ceo/);
  const unheld = runStep("bump", OPEN, { ...baseWorld(), branch: true, pins: { main: PIN, [BUMP]: TARGET }, openPr: 41, labels: ["x"] }, bumpEnv);
  assert.equal(unheld.calls.filter((c) => c.startsWith("pr merge")).length, 1, "POSITIVE CONTROL: the same world without the hold arms");
});

const refreshWorld = (): World => ({
  ...baseWorld(),
  pins: { before: PIN, after: TARGET, main: TARGET },
  prs: [
    { number: 21, head: { ref: "agent/drifted", repo: { full_name: REPO } } },
    { number: 22, head: { ref: "agent/just-red", repo: { full_name: REPO } } },
    { number: 23, head: { ref: "agent/green", repo: { full_name: REPO } } },
    { number: 24, head: { ref: "fork/drifted", repo: { full_name: "someone/agent-org" } } },
  ],
  runs: {
    "agent/drifted": { id: 901, conclusion: "failure" }, "agent/just-red": { id: 902, conclusion: "failure" },
    "agent/green": { id: 903, conclusion: "success" }, "fork/drifted": { id: 904, conclusion: "failure" },
  },
  logs: { "901": "AssertionError: discriminator: 'copies-drifted@src/lib/cli-flags.ts'", "902": "AssertionError: 2 !== 1", "903": "", "904": "copies-drifted@src/lib/x.ts" },
});
const refreshEnv = { BEFORE: "before", AFTER: "after" };

test("a11ign/a11ign#5151: when the pin moved, it updates the branch of a same-repository pull request red on copies-drifted, and only that one", () => {
  const o = runStep("refresh", REFRESH, refreshWorld(), refreshEnv);
  assert.equal(o.status, 0, o.stderr);
  noUnrouted(o);
  const updated = o.calls.filter((c) => c.endsWith("/update-branch")).sort();
  assert.deepEqual(updated, [`PUT repos/${REPO}/pulls/21/update-branch`], "red without drift, green, and a fork head are left alone");
});

test("a11ign/a11ign#5151 CONTROLS: a push that left the pin where it was touches nothing, and a refused update is said, not fatal", () => {
  const same = runStep("refresh", REFRESH, { ...refreshWorld(), pins: { before: PIN, after: PIN, main: PIN } }, refreshEnv);
  assert.equal(same.status, 0, same.stderr);
  assert.deepEqual(same.calls.filter((c) => c.includes("/pulls")), [], "no pull request is read when the pin did not move");
  const refused = runStep("refresh", REFRESH, { ...refreshWorld(), refuseUpdate: true }, refreshEnv);
  assert.equal(refused.status, 0, refused.stderr);
  assert.match(refused.stdout, /GitHub refused to update #21/);
});
