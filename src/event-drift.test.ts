// agent-org#982: a repository that changed with no event behind it at a reconcile is reported once as a missed delivery.
// Every test drives `refreshTickSnapshot` itself (the real reconcile), with the filer and `gh` injected.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Drift } from "./event-drift.ts";
import type { GhRun } from "./tick-snapshot.ts";
import { tmpDir, tmpDirForFile } from "./lib/tmp-fixture.ts";

// THE PROJECT THIS FILE RUNS AGAINST IS A RECORDED ONE, as `tick-snapshot-events.test.ts` does: `event-drift.ts` imports `ci-failure-class.ts`, which resolves the checkout it serves
// when it is imported, so the host is set BEFORE the dynamic import and the row's acceptance command needs no environment of its own.
const SCRATCH = tmpDirForFile("event-drift-");
const PROJECT = join(SCRATCH, "project");
cpSync(fileURLToPath(new URL("./packaging/fixtures/org-health/project", import.meta.url)), PROJECT, { recursive: true });
const HOST_FILE = join(SCRATCH, "host.json");
writeFileSync(HOST_FILE, JSON.stringify({ schema: 1, home: SCRATCH, binDir: join(SCRATCH, "bin"), primary: "fixture", projects: [{ id: "fixture", checkout: PROJECT }],
  gh: { workers: join(SCRATCH, "workers"), leads: join(SCRATCH, "leads"), leadsHeader: [], leadsWorkspaces: [] } }));
process.env.AGENT_ORG_HOST = HOST_FILE;
const { fileDrift, groupOf, probeName } = await import("./event-drift.ts");
const { refreshTickSnapshot, probePaths } = await import("./tick-snapshot.ts");

const SEC = 1000;
const T0 = Date.parse("2026-10-11T19:00:00Z");
const REPO = "a11ign/agent-org";
const RECONCILE_SECONDS = 20 * 60;
const [ISSUES, RUNS] = probePaths(REPO);
const healthy = (changed: string[] = []) => ({ changed: new Set(changed), healthy: true, reconcileEverySeconds: RECONCILE_SECONDS });

/** A `gh` answering 200 with the tag chosen per path at call time; `tagFor` is what the probe sees. */
const gh = (tagFor: (path: string) => string): GhRun => (args) => ({ stdout: `HTTP/2.0 200 OK\r\nEtag: "${tagFor(args[args.length - 1])}"\r\n\r\n[]`, status: 0 });
const steady = gh(() => "t1");
const issuesMoved = gh((path) => (path === ISSUES ? "t2" : "t1"));
const runsMoved = gh((path) => (path === RUNS ? "t2" : "t1"));

/** A filer that records each drift and answers `accept` (a refused filing is `false`). */
const filer = (accept: () => boolean = () => true) => {
  const filed: Drift[] = [];
  return { filed, fileDrift: (drift: Drift) => { filed.push(drift); return accept(); } };
};

/** A cache directory that has been read once at T0 (baseline: no drift is possible on a first reading). */
function baselined() {
  const dir = tmpDir("event-drift-");
  refreshTickSnapshot({ repos: [REPO], homeRepo: REPO, configDir: dir, run: steady, nowMs: T0, events: healthy() });
  return dir;
}
const reconcile = (dir: string, run: GhRun, at: number, f: ReturnType<typeof filer>, changed: string[] = []) =>
  refreshTickSnapshot({ repos: [REPO], homeRepo: REPO, configDir: dir, run, nowMs: T0 + at * SEC, events: healthy(changed), fileDrift: f.fileDrift });

test("POSITIVE CONTROL: a probe CHANGED at a reconcile with no event files one incident naming the repository, the window and the probe that moved", () => {
  const dir = baselined();
  const f = filer();
  const lines = reconcile(dir, issuesMoved, RECONCILE_SECONDS, f);
  assert.equal(f.filed.length, 1);
  assert.deepEqual(f.filed[0], { repo: REPO, probe: "issues list", windowStartS: T0 / SEC, nowS: T0 / SEC + RECONCILE_SECONDS });
  assert.match(lines[0], /MISSED DELIVERY inferred from the issues list probe, incident filed/);
  const later = filer();
  reconcile(baselined(), runsMoved, RECONCILE_SECONDS, later);
  assert.equal(later.filed[0].probe, "actions/runs", "the other probe names itself");
});

test("NEGATIVE CONTROL: a probe CHANGED with an event naming the repository is not drift, and an unchanged probe is not either", () => {
  const withEvent = filer();
  const lines = reconcile(baselined(), issuesMoved, RECONCILE_SECONDS, withEvent, [REPO.toUpperCase()]);
  assert.deepEqual(withEvent.filed, [], "an event in the queue explains the move, whatever case GitHub spells the repository in");
  assert.doesNotMatch(lines[0], /MISSED DELIVERY/);
  const quiet = filer();
  reconcile(baselined(), steady, RECONCILE_SECONDS, quiet);
  assert.deepEqual(quiet.filed, []);
});

test("a repository not yet due is not probed at all, and a first reading is a baseline, never drift", () => {
  const dir = baselined();
  const calls: string[][] = [];
  const f = filer();
  reconcile(dir, (args) => { calls.push(args); return issuesMoved(args); }, RECONCILE_SECONDS - 1, f);
  assert.deepEqual([calls.length, f.filed.length], [0, 0], "inside the window a quiet tick still asks GitHub nothing");
  const fresh = filer();
  refreshTickSnapshot({ repos: [REPO], homeRepo: REPO, configDir: tmpDir("event-drift-first-"), run: issuesMoved, nowMs: T0, events: healthy(), fileDrift: fresh.fileDrift });
  assert.deepEqual(fresh.filed, [], "no tag was held, so there is nothing the probe moved from");
});

test("the probe pair runs ONCE at a due reconcile, and the same drift is not filed again by the next ticks; the next window files its own", () => {
  const dir = baselined();
  const calls: string[][] = [];
  const f = filer();
  const counting = (args: string[]) => { calls.push(args); return issuesMoved(args); };
  reconcile(dir, counting, RECONCILE_SECONDS, f);
  assert.equal(calls.length, 2);
  reconcile(dir, counting, RECONCILE_SECONDS + 60, f);
  reconcile(dir, counting, RECONCILE_SECONDS + 120, f);
  assert.equal(f.filed.length, 1, "per tick it is filed once: the window moved when it was");
  assert.equal(calls.length, 2, "and the following ticks asked nothing");
  const nextTag = gh((path) => (path === ISSUES ? "t3" : "t1"));
  reconcile(dir, nextTag, 2 * RECONCILE_SECONDS, f);
  assert.equal(f.filed.length, 2, "a second reconcile that finds the repository moved again files its own incident");
  assert.notEqual(groupOf(f.filed[0]).key, groupOf(f.filed[1]).key, "so its dedupe key is not the first window's");
});

test("a filing `gh` refused is retried the next tick and not lost; once filed it is not filed again", () => {
  const dir = baselined();
  let accept = false;
  const f = filer(() => accept);
  const first = reconcile(dir, issuesMoved, RECONCILE_SECONDS, f);
  assert.match(first[0], /incident NOT filed, retried next tick/);
  accept = true;
  const second = reconcile(dir, issuesMoved, RECONCILE_SECONDS + 60, f);
  assert.equal(f.filed.length, 2, "the window stayed open, so the probe read CHANGED against the same tag again");
  assert.equal(groupOf(f.filed[0]).key, groupOf(f.filed[1]).key, "and it is the same window: recordIncident joins a row that was in fact created");
  assert.match(second[0], /incident filed/);
  reconcile(dir, issuesMoved, RECONCILE_SECONDS + 120, f);
  assert.equal(f.filed.length, 2);
});

test("the default filer reaches `recordIncident` with the group and reports its refusal as `false`", () => {
  const drift: Drift = { repo: REPO, probe: "issues list", windowStartS: T0 / SEC, nowS: T0 / SEC + RECONCILE_SECONDS };
  const seen: string[] = [];
  const run = () => "";
  assert.equal(fileDrift(drift, { run, log: () => {}, record: (group, deps) => { seen.push(group.key); assert.equal(deps.run, run); return 982; } }), true);
  assert.equal(fileDrift(drift, { run, log: () => {}, record: () => null }), false);
  assert.deepEqual(seen, [`event-drift:${REPO}:${T0 / SEC}`]);
  assert.equal(probeName(ISSUES), "issues list");
});

test("the incident text names the repository, the window and the probe, says it is inferred, and names both false-drift sources (printed for the PR)", () => {
  const { signature, key } = groupOf({ repo: REPO, probe: "actions/runs", windowStartS: T0 / SEC, nowS: T0 / SEC + RECONCILE_SECONDS });
  const text = [`key: ${key}`, `check: ${signature.check}`, `step: ${signature.step}`, `line: ${signature.line}`].join("\n");
  console.log(text);
  assert.match(signature.check, /a11ign\/agent-org.*actions\/runs/);
  assert.match(signature.step, /2026-10-11T19:00:00Z to 2026-10-11T19:20:00Z/);
  assert.match(signature.line, /INFERRED from the probe, not seen/);
  assert.match(signature.line, /Project board edit/);
  assert.match(signature.line, /after this probe within the same tick/);
});
