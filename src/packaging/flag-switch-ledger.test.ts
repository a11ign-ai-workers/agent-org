// no-token: gh -- the ledger reads files and a throwaway local git repository, and `orgHealthNow` is handed fake readers for everything else; nothing reaches `gh`, the fleet or the network
/**
 * agent-org#1135: A FLAG THE CODE SHIPS OFF AND A11IGN NEVER SET IS COUNTED BY THE TICK.
 *
 * THE DEFECT: `rows.autoUnpark` (a11ign#5194) and the Haiku flags (a11ign#5138) merged behind a flag that is OFF when absent, and the first sign that nobody had set one was a human flipping
 * the switch hours later (class `hand-reroute`: a11ign#5041, #5139, #5195). The chairman's rule (a11ign#928, 2026-10-12) asked for a switch row filed with the change, and "org-health counts
 * violations" had no code behind it.
 *
 * WHAT IS PINNED, with the mutation that breaks each, run by hand and recorded on the row:
 *   (1) the registry: `discoverFlags` finds the seven keys of the row's open-check in THIS tree (POSITIVE CONTROL), and nothing that is not a dotted key or sits in a test file;
 *       break: narrow the pattern to `[a-z]+\.[a-z]+` (the camelCase keys vanish) -- (1) goes red.
 *   (2) the three directions of the row's Done-when 2: a key absent from the declaration is reported, the same key set `false` is not, and a key in `FLAGS_WITH_ANOTHER_HOME` is not;
 *       break: `unsetFlags` reports every shipped flag -- the `false` and `another home` cases go red; `unsetFlags` reports none -- the absent case goes red.
 *   (3) a declaration that cannot be read makes the answer UNKNOWN, never a list (a file that did not parse would otherwise name every flag), and a required file that is missing is the same;
 *       break: `continue` past a parse failure -- (3) goes red.
 *   (4) the merge date is the first-parent merge that added the key, with its pull request number;
 *       break: drop `--first-parent` -- the branch commit is found first, whose subject names no pull request, and (4) goes red.
 *   (5) the reading and its order: unknown is never clear, the order is keyed on the day so a standing set is named once a day, it goes to `product-manager` and `ceo`;
 *       break: take the day out of the discriminator -- the once-a-day case goes red.
 *   (6) WIRING: `orgHealthNow` asks only when handed a reader and says nothing otherwise, and the gate's call site hands it `readFlagLedger`;
 *       break: drop `readFlagSwitches` at `work-gate.ts`'s call -- the wiring test goes red; make `orgHealthNow`'s default a read -- the "does not ask" case goes red. WHY THE DEFAULT IS
 *       SILENT, MEASURED: a first version had `orgHealthTick` read the ledger itself when given none (as it does the copies), and 25 tests in 8 other files failed on the extra order.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxGitEnv } from "../lib/git-env.ts";
import { workGateSource } from "../lib/work-gate-source.ts";

// THE PROJECT THIS FILE RUNS AGAINST IS A RECORDED ONE (`org-health-fleet-build-fact.test.ts`'s rule): the host file is set FIRST and the tool imported AFTER it, dynamically, so
// the Acceptance's `AGENT_ORG_HOST` (a11y-witness's live declaration) is never what a test below reads; every ledger read gets its own roots.
const SCRATCH = mkdtempSync(join(tmpdir(), "flag-switch-ledger-"));
after(() => rmSync(SCRATCH, { recursive: true, force: true }));
const PROJECT = join(SCRATCH, "project");
cpSync(fileURLToPath(new URL("./fixtures/org-health/project", import.meta.url)), PROJECT, { recursive: true });
const HOST_FILE = join(SCRATCH, "host.json");
writeFileSync(HOST_FILE, JSON.stringify({ schema: 1, home: SCRATCH, binDir: join(SCRATCH, "bin"), primary: "fixture",
  projects: [{ id: "fixture", checkout: PROJECT }],
  gh: { workers: join(SCRATCH, "workers"), leads: join(SCRATCH, "leads"), leadsHeader: [], leadsWorkspaces: [] } }));
process.env.AGENT_ORG_HOST = HOST_FILE;

const ledger = await import("../flag-switch-ledger.ts");
const { discoverFlags, declaresKey, unsetFlags, mergeOf, readFlagLedger, FLAGS_WITH_ANOTHER_HOME } = ledger;
const { SIGNALS, flagSwitchReading, orgHealthOrders, orgHealthReadings } = await import("../org-health.ts");
const { FLAG_REGISTRY } = await import("../machinery-flag.ts");
const { ORG_HEALTH_CLASSES } = await import("../work-gate/org-health-suppression.ts");
const { orgHealthNow } = await import("../work-gate/org-health.ts");

const FLAG = (name: string, key: string, file = "src/x.ts") => ({ name, key, file });
/** Writes `files` (path to text) under a fresh directory and returns it. */
function tree(label: string, files: Record<string, string>): string {
  const root = mkdtempSync(join(SCRATCH, `${label}-`));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

test("(1) POSITIVE CONTROL: the registry finds the seven keys of the row's open-check in this tree, and the registry is not a list typed here", () => {
  const found = discoverFlags();
  assert.ok(found !== null, "src/ of this tool can be listed");
  const keys = found.map((flag) => flag.key);
  for (const key of ["workers.haikuBrief", "workers.orchestratorOneShot", "rows.specLint", "rows.autoUnpark", "queue.chainWaitWake", "queue.reenqueueEjected", "rows.closedUnderOpenHalf"]) {
    assert.ok(keys.includes(key), `${key} is found (found: ${keys.join(", ")})`);
  }
  assert.equal(found.find((flag) => flag.key === "rows.autoUnpark")?.name, "AUTO_UNPARK_FLAG");
  assert.equal(found.find((flag) => flag.key === "rows.autoUnpark")?.file, "src/unpark-satisfied.ts");
  assert.ok(!keys.some((key) => key.startsWith("--")), "a CLI flag constant (`--decision`) is not a switch");
});

test("(1) the walk takes `.ts` and `.mjs`, skips tests, fixtures and node_modules, and reads one key declared twice as one flag", () => {
  const root = tree("discover", {
    "src/a.ts": 'export const ALPHA_FLAG = "rows.alpha";\nexport const OPTION_FLAG = "--option";\nexport const NOT_A_KEY_FLAG = "plain";\n',
    "src/deep/b.mjs": 'export const BETA_FLAG = "queue.beta";\n',
    "src/c.ts": 'export const ALPHA_AGAIN_FLAG = "rows.alpha";\n',
    "src/a.test.ts": 'export const IN_A_TEST_FLAG = "rows.inTest";\n',
    "src/fixtures/d.ts": 'export const IN_A_FIXTURE_FLAG = "rows.inFixture";\n',
    "src/node_modules/e.ts": 'export const VENDORED_FLAG = "rows.vendored";\n',
    "src/f.ts": 'const NOT_EXPORTED_FLAG = "rows.local";\nexport const lowerCaseFlag = "rows.lower";\n',
  });
  assert.deepEqual(discoverFlags({ toolRoot: root }), [FLAG("BETA_FLAG", "queue.beta", join("src", "deep", "b.mjs")), FLAG("ALPHA_FLAG", "rows.alpha", join("src", "a.ts"))]);
  assert.equal(discoverFlags({ toolRoot: join(root, "no-such-directory") }), null, "a tree whose src cannot be listed is null, not an empty list");
});

test("(2) the three directions: absent is reported, the same key set `false` is not, and a key with another home is not", () => {
  const shipped = [FLAG("AUTO_UNPARK_FLAG", "rows.autoUnpark"), FLAG("CHAIN_WAIT_FLAG", "queue.chainWaitWake")];
  const keysOf = (declarations: unknown[]) => unsetFlags({ shipped, declarations }).map((flag) => flag.key);
  assert.deepEqual(keysOf([{ decisions: true }]), ["rows.autoUnpark"], "absent: rows.autoUnpark is the violation; queue.chainWaitWake is switched by `machinery:flag`");
  assert.deepEqual(keysOf([{ rows: { autoUnpark: false } }]), [], "the same key set `false` is a decision, and not counted");
  assert.deepEqual(keysOf([{ rows: { autoUnpark: true } }]), [], "and `true` is one too");
  assert.deepEqual(keysOf([]), ["rows.autoUnpark"], "no declaration at all: still only the one without another home");
  assert.deepEqual(unsetFlags({ shipped: [FLAG("CHAIN_WAIT_FLAG", "queue.chainWaitWake")], declarations: [] }), [], "a key in FLAGS_WITH_ANOTHER_HOME is not reported with nothing declared");
  assert.deepEqual(unsetFlags({ shipped: [FLAG("CHAIN_WAIT_FLAG", "queue.chainWaitWake")], declarations: [], anotherHome: {} }).map((flag) => flag.key), ["queue.chainWaitWake"],
    "and the map is what excuses it: without the entry the same flag is reported (the exemption is not a hard-coded name)");
});

test("(2) both declared shapes decide a flag: nested (host.json) and flat dotted (decisions.json); a value that is not a boolean does not", () => {
  assert.equal(declaresKey({ workers: { haikuBrief: false } }, "workers.haikuBrief"), true, "nested false");
  assert.equal(declaresKey({ "routing.haikuDefault": true }, "routing.haikuDefault"), true, "flat true");
  assert.equal(declaresKey({ "rows.autoUnpark": false }, "rows.autoUnpark"), true, "flat false");
  assert.equal(declaresKey({ workers: { haikuBrief: "yes" } }, "workers.haikuBrief"), false, "a string is not a decision (the readers say `not true or false; it is off`)");
  assert.equal(declaresKey({ workers: { haikuBrief: null } }, "workers.haikuBrief"), false);
  assert.equal(declaresKey({ workers: { orchestratorOneShot: true } }, "workers.haikuBrief"), false, "a sibling key is not the key");
  assert.equal(declaresKey({ workers: [true] }, "workers.haikuBrief"), false);
  assert.equal(declaresKey(null, "workers.haikuBrief"), false);
  assert.equal(declaresKey("text", "workers.haikuBrief"), false);
});

test("(2) FLAGS_WITH_ANOTHER_HOME is exactly the flags `machinery:flag` switches, and every key in it is a flag the code ships", () => {
  assert.deepEqual(Object.keys(FLAGS_WITH_ANOTHER_HOME).sort(), [...FLAG_REGISTRY].sort(), "a fourth machinery flag is a change to the map, here, and not a silent gap");
  const shipped = (discoverFlags() ?? []).map((flag) => flag.key);
  for (const [key, reason] of Object.entries(FLAGS_WITH_ANOTHER_HOME)) {
    assert.ok(shipped.includes(key), `${key} is shipped, so the entry is not stale`);
    assert.notEqual(reason.trim(), "", `${key} names its reason`);
  }
});

/** A tool tree holding the two flags below, and a project whose declarations the cases vary. */
const TOOL = tree("tool", { "src/m.ts": 'export const HAIKU_BRIEF_FLAG = "workers.haikuBrief";\nexport const AUTO_UNPARK_FLAG = "rows.autoUnpark";\nexport const CHAIN_WAIT_FLAG = "queue.chainWaitWake";\n' });
const merge = (flag: { key: string; }) => ({ mergedAt: flag.key === "rows.autoUnpark" ? "2026-10-12T08:01:58+00:00" : "2026-10-11T18:46:01+00:00", pr: flag.key === "rows.autoUnpark" ? 1118 : 1022 });
function project(label: string, files: Record<string, string>) {
  const root = tree(label, Object.fromEntries(Object.entries(files).map(([name, text]) => [name === "host.json" ? "host/host.json" : `.agent-org/${name}`, text])));
  return { projectRoot: root, hostPath: join(root, "host", "host.json") };
}

test("(3) the ledger reads every declaration file: decided in host.json or decisions.json, an absent seats.json is no fault, and what is left is named with its merge", () => {
  const where = project("decided", { "project.json": "{}", "decisions.json": '{ "rows.autoUnpark": false }', "host.json": '{ "workers": { "haikuBrief": true } }' });
  assert.deepEqual(readFlagLedger({ toolRoot: TOOL, ...where, merge }), { shipped: 3, unset: [] }, "both decided (one flat and false, one nested and true) and the third has another home");
  const half = project("half", { "project.json": "{}", "host.json": "{}" });
  const answer = readFlagLedger({ toolRoot: TOOL, ...half, merge });
  assert.ok(!("unknown" in answer));
  assert.deepEqual(answer.unset.map(({ key, mergedAt, pr }) => ({ key, mergedAt, pr })), [
    { key: "rows.autoUnpark", mergedAt: "2026-10-12T08:01:58+00:00", pr: 1118 },
    { key: "workers.haikuBrief", mergedAt: "2026-10-11T18:46:01+00:00", pr: 1022 },
  ], "decisions.json absent is no fault; the two undecided flags are named with the merge that added each");
});

test("(3) a declaration that cannot be read is UNKNOWN and never a list, and so is a missing required file or a tree with no flag", () => {
  const malformed = project("malformed", { "project.json": "{}", "decisions.json": "{ not json", "host.json": "{}" });
  const bad = readFlagLedger({ toolRoot: TOOL, ...malformed, merge });
  assert.ok("unknown" in bad && /decisions\.json is not valid JSON/.test(bad.unknown), `names the file: ${JSON.stringify(bad)}`);
  const noHost = project("nohost", { "project.json": "{}" });
  const missing = readFlagLedger({ toolRoot: TOOL, ...noHost, merge });
  assert.ok("unknown" in missing && /host\.json could not be read/.test(missing.unknown), `a wrong $AGENT_ORG_HOST would otherwise name every flag: ${JSON.stringify(missing)}`);
  const noProject = project("noproject", { "host.json": "{}" });
  assert.ok("unknown" in readFlagLedger({ toolRoot: TOOL, ...noProject, merge }), "project.json is required too");
  const empty = readFlagLedger({ toolRoot: tree("empty", { "src/none.ts": "export const X = 1;\n" }), ...project("ok", { "project.json": "{}", "host.json": "{}" }), merge });
  assert.ok("unknown" in empty && /no `\*_FLAG` constant/.test(empty.unknown), "a walk that found nothing has not found a clean tree");
});

test("(3) the real tree against a declaration that sets nothing names the flags the row lists, and against one that sets them all names none", () => {
  const nothing = readFlagLedger({ ...project("real-nothing", { "project.json": "{}", "host.json": "{}" }), merge: () => ({ mergedAt: null, pr: null }) });
  assert.ok(!("unknown" in nothing));
  const keys = nothing.unset.map((flag) => flag.key);
  for (const key of ["workers.haikuBrief", "workers.orchestratorOneShot", "rows.specLint", "rows.autoUnpark"]) assert.ok(keys.includes(key), `${key} is counted`);
  for (const key of Object.keys(FLAGS_WITH_ANOTHER_HOME)) assert.ok(!keys.includes(key), `${key} is not`);
  const all = Object.fromEntries((discoverFlags() ?? []).map((flag) => [flag.key, false]));
  const decided = readFlagLedger({ ...project("real-all", { "project.json": "{}", "decisions.json": JSON.stringify(all), "host.json": "{}" }), merge: () => ({ mergedAt: null, pr: null }) });
  assert.ok(!("unknown" in decided));
  assert.deepEqual(decided.unset, [], "every key set `false` is decided, so nothing is counted");
});

test("(4) the merge date is the first-parent merge that added the key, with its pull request, and not the branch commit under it", () => {
  const repo = mkdtempSync(join(SCRATCH, "git-"));
  const git = (when: string, ...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8", env: sandboxGitEnv({ GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@example.invalid", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@example.invalid",
    GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" }) });
  git("2026-10-01T00:00:00+0000", "init", "-q", "-b", "main");
  mkdirSync(join(repo, "src"));
  writeFileSync(join(repo, "src/f.ts"), "export const OTHER = 1;\n");
  git("2026-10-01T00:00:00+0000", "add", ".");
  git("2026-10-01T00:00:00+0000", "commit", "-q", "-m", "first");
  git("2026-10-02T00:00:00+0000", "checkout", "-q", "-b", "agent/the-flag");
  writeFileSync(join(repo, "src/f.ts"), 'export const OTHER = 1;\nexport const NEW_FLAG = "rows.newThing";\n');
  git("2026-10-02T00:00:00+0000", "commit", "-q", "-am", "add the flag");
  git("2026-10-03T00:00:00+0000", "checkout", "-q", "main");
  writeFileSync(join(repo, "src/g.ts"), "export const UNRELATED = 1;\n");
  git("2026-10-03T00:00:00+0000", "add", ".");
  git("2026-10-03T00:00:00+0000", "commit", "-q", "-m", "unrelated");
  git("2026-10-12T08:00:00+0000", "merge", "-q", "--no-ff", "agent/the-flag", "-m", "Merge pull request #42 from a11ign/agent/the-flag");
  writeFileSync(join(repo, "src/f.ts"), 'export const OTHER = 1;\nexport const NEW_FLAG = "rows.newThing"; // reworded\n');
  git("2026-10-13T00:00:00+0000", "commit", "-q", "-am", "reword");
  assert.deepEqual(mergeOf(FLAG("NEW_FLAG", "rows.newThing", "src/f.ts"), { toolRoot: repo }), { mergedAt: "2026-10-12T08:00:00Z", pr: 42 });
  assert.deepEqual(mergeOf(FLAG("NEW_FLAG", "rows.noSuchKey", "src/f.ts"), { toolRoot: repo }), { mergedAt: null, pr: null }, "a key history never held is no date, not a wrong one");
  assert.deepEqual(mergeOf(FLAG("NEW_FLAG", "rows.newThing", "src/f.ts"), { toolRoot: join(SCRATCH, "not-a-repository") }), { mergedAt: null, pr: null }, "no history (an installed tool) is no date, and the flag is still counted");
  assert.deepEqual(mergeOf(FLAG("X", "rows.x"), { run: () => { throw new Error("git is not here"); } }), { mergedAt: null, pr: null });
});

const FACTS = { now: Date.parse("2026-10-12T09:30:00Z"), lastMergedAt: Date.parse("2026-10-12T09:00:00Z"), work: null, redPrs: [], refusals: {}, drift: null, primarySince: null };
const UNSET = { shipped: 8, unset: [
  { name: "AUTO_UNPARK_FLAG", key: "rows.autoUnpark", file: "src/unpark-satisfied.ts", mergedAt: "2026-10-12T08:01:58+00:00", pr: 1118 },
  { name: "HAIKU_BRIEF_FLAG", key: "workers.haikuBrief", file: "src/haiku-brief.ts", mergedAt: null, pr: null },
] };

test("(5) the reading: unknown is never clear, a decided set is clear, and an undecided one is tripped with each key, its merge and its pull request", () => {
  const signal = SIGNALS.FLAG_WITHOUT_SWITCH;
  assert.equal(signal, "flag-without-a-switch");
  assert.equal(flagSwitchReading({ day: "2026-10-12", ledger: null }).status, "unknown");
  const why = flagSwitchReading({ day: "2026-10-12", ledger: { unknown: "decisions.json is not valid JSON" } });
  assert.equal(why.status, "unknown");
  assert.match(why.detail, /decisions\.json is not valid JSON/);
  assert.equal(flagSwitchReading({ day: "2026-10-12", ledger: { shipped: 8, unset: [] } }).status, "clear");
  const tripped = flagSwitchReading({ day: "2026-10-12", ledger: UNSET });
  assert.equal(tripped.status, "tripped");
  assert.match(tripped.detail, /^2 of 8 flags the code ships are OFF because no declaration sets them:/);
  assert.match(tripped.detail, /`rows\.autoUnpark` \(AUTO_UNPARK_FLAG in src\/unpark-satisfied\.ts\), merged 2026-10-12 in #1118/);
  assert.match(tripped.detail, /`workers\.haikuBrief` \(HAIKU_BRIEF_FLAG in src\/haiku-brief\.ts\), merged on a date git did not give\n?/, "a date git could not give is said, not invented");
  assert.equal(tripped.discriminator, `${signal}@2026-10-12:rows.autoUnpark,workers.haikuBrief`);
});

test("(5) the order goes to product-manager and ceo, names the keys, is the same all day and a new one the next day", () => {
  const read = (now: number, ledger: unknown) => orgHealthOrders(orgHealthReadings({ ...FACTS, now, flagSwitches: ledger as never })).filter((order) => order.subject === SIGNALS.FLAG_WITHOUT_SWITCH);
  const morning = read(Date.parse("2026-10-12T09:30:00Z"), UNSET);
  assert.deepEqual(morning.map((order) => order.session), ["product-manager", "ceo"], "the first reader and then ceo, who takes every signal");
  assert.match(morning[0].prompt, /`rows\.autoUnpark`/);
  assert.match(morning[0].prompt, /a11ign#928/, "the remedy names the chairman's rule");
  assert.doesNotMatch(morning[0].prompt, /undefined/);
  const evening = read(Date.parse("2026-10-12T21:00:00Z"), UNSET);
  assert.deepEqual(evening.map((order) => order.causeKey), morning.map((order) => order.causeKey), "the same set on the same day is one order however many ticks it lasts");
  const nextDay = read(Date.parse("2026-10-13T00:30:00Z"), UNSET);
  assert.notEqual(nextDay[0].causeKey, morning[0].causeKey, "and the next day names it again: once a day");
  const grown = read(Date.parse("2026-10-12T21:00:00Z"), { ...UNSET, unset: [...UNSET.unset, { name: "B_FLAG", key: "rows.b", file: "src/b.ts", mergedAt: null, pr: null }] });
  assert.notEqual(grown[0].causeKey, morning[0].causeKey, "a flag shipped that day is a new order that day");
  assert.deepEqual(read(Date.parse("2026-10-12T09:30:00Z"), { shipped: 8, unset: [] }), [], "nothing unset, no order");
  assert.deepEqual(read(Date.parse("2026-10-12T09:30:00Z"), undefined), [], "a caller that does not ask adds no reading");
});

test("(5) the class is declared in the suppression table, as a digest: it has a first reader, so `ceo` reading it again is a turn and not a decision", () => {
  assert.deepEqual(Object.keys(ORG_HEALTH_CLASSES).filter((cls) => cls === SIGNALS.FLAG_WITHOUT_SWITCH), ["flag-without-a-switch"]);
  assert.equal(ORG_HEALTH_CLASSES[SIGNALS.FLAG_WITHOUT_SWITCH].severity, "digest");
});

type Order = { subject: string; session: string; prompt: string; causeKey: string; };
const decideArgs = { prs: [], required: [], readyRows: [], prFiles: new Map(), rowBranches: [], openRows: [], primaryDrift: null, claimRefusals: [] };
/** One gate tick with every other read stubbed; `readFlagSwitches` is left OUT of the options when it is not given, which is a caller that does not ask. */
function gateTick(readFlagSwitches?: () => unknown, now = Date.parse("2026-10-12T09:30:00Z")) {
  const said: string[] = [];
  const orders = orgHealthNow({ prsRead: [], readyRead: [], openRowsRead: [], decideArgs, decided: [] } as never,
    { now, lastMergedAt: () => now, readCaptures: () => undefined, readLabJobs: () => [], log: (line: string) => said.push(line), teamAccess: () => undefined, readCopies: () => null, readRefusals: () => [],
      readWaits: () => ({ facts: new Map(), stale: [], bare: [], manual: 0 }), ...(readFlagSwitches && { readFlagSwitches }) } as never) as Order[];
  return { orders: orders.filter((order) => order.subject === SIGNALS.FLAG_WITHOUT_SWITCH), said };
}

test("(6) through the gate's `orgHealthNow`: a reader that finds unset flags yields the order, and a caller that does not ask is silent", () => {
  const asked = gateTick(() => UNSET);
  assert.deepEqual(asked.orders.map((order) => order.session), ["product-manager", "ceo"], "the fact reached the reading and the reading reached an order");
  const unasked = gateTick();
  assert.deepEqual(unasked.orders, [], "undefined is a caller that does not ask, which is every other test of the tick");
  assert.equal(unasked.said.some((line) => line.includes(`${SIGNALS.FLAG_WITHOUT_SWITCH} UNKNOWN`)), false, "and it is SILENT: not asking is not a refused read");
  assert.deepEqual(gateTick(() => undefined).orders, [], "a reader that answers undefined adds no fact either");
  const refused = gateTick(() => null);
  assert.deepEqual(refused.orders, []);
  assert.ok(refused.said.some((line) => line.includes(`org-health: ${SIGNALS.FLAG_WITHOUT_SWITCH} UNKNOWN`)), `a null is a stated unknown: ${JSON.stringify(refused.said)}`);
  assert.deepEqual(gateTick(() => ({ shipped: 8, unset: [] })).orders, [], "and a decided set orders nothing");
});

test("(6) WIRING: the gate's call site hands `orgHealthNow` the real reader, so the signal is not dead for want of a fact (#2980's lesson)", () => {
  const gate = workGateSource();
  assert.match(gate, /readFlagSwitches: \(\) => readFlagLedger\(\)/);
  assert.match(gate, /import \{ readFlagLedger \} from "\.\/flag-switch-ledger\.ts"/);
});
