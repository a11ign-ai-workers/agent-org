// no-token: gh -- no `gh`, `herdr` or `git` is run: the pull requests, the session and the tracker list are seams, and the only files written are a temporary state directory's
// a11ign#4957 cause 4: a claimed worker that ends its turn with no open pull request and no declaration is REFUSED the stop, by name, twice at most (agent-org#853).
//
// EVERY ALLOWANCE HAS A TWIN: the refusal fixture with ONE thing changed. A hook that refuses nothing turns the refusal case red, and one that refuses everything turns the
// allowances red. THE REFUSAL CASE IS THE POSITIVE CONTROL for the four allowances: it is what proves the allowances are not "the hook never fires". The mutations, both
// directions, are in the pull request.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { FAILURE_LEDGER_FILE, parseFailureLedger } from "./failure-ledger.ts";
import { WORKER_STATE_DIR, readDeclarations, writeDeclaration } from "./worker-state.ts";
import { MAX_REFUSALS, STOP_HOOK_BOUND_KIND, STOP_HOOK_DIR, claimedRowOf, main, runHook, type Seams, type StopPr } from "./worker-stop-hook.ts";

const T0 = Date.parse("2026-10-11T09:00:00Z");
const MIN = 60_000;
const SESSION = "worker-agent-org-853";
const TRACKERS = [{ key: "", repo: "a11ign/a11ign" }, { key: "agent-org", repo: "a11ign/agent-org" }];
const REPO = "a11ign/agent-org";
const PR_OF_THE_ROW: StopPr = { number: 901, state: "OPEN", headRefName: "agent/a-stop-hook-in-agent-org-853", title: "A Stop hook (agent-org#853)", labels: [{ name: `session:${SESSION}` }] };
/** `ownsPr`'s rungs that matter here, restated so the pure half needs no project declaration: the head ends `-<row>`, or the title ends with the reference. */
const owns: Seams["owns"] = (claim, pr) => (pr.headRefName ?? "").endsWith(`-${claim.row}`) || (pr.title ?? "").trimEnd().endsWith(`${claim.trackerRepo}#${claim.row})`);

const dirs: string[] = [];
function stateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "worker-stop-hook-"));
  dirs.push(dir);
  return dir;
}
test.after(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }); });

/** The refusal fixture, with `over` changed. `prs` is what the repository lists. */
function seams(dir: string, over: Omit<Partial<Seams>, "prs"> & { prs?: StopPr[] } = {}): Seams {
  const { prs = [], ...rest } = over;
  return { session: SESSION, trackers: TRACKERS, stateDir: dir, now: T0, prs: () => prs, owns, ...rest };
}
const declare = (dir: string, atMinutes: number, state: "done" | "waiting-ci" = "waiting-ci") =>
  writeDeclaration(`${dir}/${WORKER_STATE_DIR}`, { session: SESSION, state, at: T0 + atMinutes * MIN, ...(state === "done" ? {} : { pr: { number: 901 } }) });
const countFile = (dir: string) => `${dir}/${STOP_HOOK_DIR}/${SESSION}.json`;
const ledgerEntries = (dir: string) => (existsSync(`${dir}/${FAILURE_LEDGER_FILE}`) ? parseFailureLedger(readFileSync(`${dir}/${FAILURE_LEDGER_FILE}`, "utf8")) : []);
const OFF = {};

test("POSITIVE CONTROL: a claimed worker with no open pull request and no declaration is refused, and the message names both commands", () => {
  const dir = stateDir();
  const result = runHook(OFF, seams(dir));
  assert.equal(result.code, 2);
  const said = result.say.join("\n");
  assert.match(said, /agent-org pr:open/, "the command for pushed work");
  assert.match(said, /agent-org worker:state blocked agent-org#853 <reason>/, "the command for work that cannot go on, with the row spelt as worker:state reads it");
  assert.match(said, /STOP REFUSED \(1 of 2\)/);
  assert.equal(JSON.parse(readFileSync(countFile(dir), "utf8")).refusals, 1, "the refusal is counted");
});

test("a fresh declaration, an open pull request, a merged one, stop_hook_active and a non-worker each stop normally (each twin is the refusal fixture with one thing changed)", () => {
  const declared = stateDir();
  declare(declared, -5);
  assert.deepEqual(runHook(OFF, seams(declared)), { code: 0, say: [] }, "a declaration made since the turn began (no delivery on record)");
  assert.deepEqual(runHook(OFF, seams(stateDir(), { prs: [PR_OF_THE_ROW] })), { code: 0, say: [] }, "an open pull request of the row");
  assert.deepEqual(runHook(OFF, seams(stateDir(), { prs: [{ ...PR_OF_THE_ROW, state: "MERGED" }] })), { code: 0, say: [] }, "a merged one: the deliverable landed");
  assert.deepEqual(runHook({ stop_hook_active: true }, seams(stateDir())), { code: 0, say: [] }, "Claude Code is already continuing because of the last refusal");
  assert.deepEqual(runHook(OFF, seams(stateDir(), { session: "ceo" })), { code: 0, say: [] }, "a standing seat is not a worker");
  assert.deepEqual(runHook(OFF, seams(stateDir(), { session: null })), { code: 0, say: [] }, "an unknown caller is no session");
  assert.deepEqual(runHook(OFF, seams(stateDir(), { session: "worker-capture-2407" })), { code: 0, say: [] }, "a worker name that carries no declared tracker's row holds no claim here");
});

test("the twins of the allowances still refuse: a declaration older than the turn, a closed pull request, another row's", () => {
  const stale = stateDir();
  declare(stale, -30);
  writeFileSync(`${stale}/wake-ledger`, `${T0 - 10 * MIN}\t${SESSION}/claim-stalled/row-853\n`);
  assert.equal(runHook(OFF, seams(stale)).code, 2, "a delivery to the session after the declaration: it describes an earlier turn");
  const fresh = stateDir();
  declare(fresh, -5);
  writeFileSync(`${fresh}/wake-ledger`, `${T0 - 10 * MIN}\t${SESSION}/claim-stalled/row-853\n`);
  assert.equal(runHook(OFF, seams(fresh)).code, 0, "twin: the same ledger, a declaration made after the delivery");
  assert.equal(runHook(OFF, seams(stateDir(), { prs: [{ ...PR_OF_THE_ROW, state: "CLOSED" }] })).code, 2, "closed without merging is not a deliverable");
  assert.equal(runHook(OFF, seams(stateDir(), { prs: [{ number: 7, state: "OPEN", headRefName: "agent/other-row-852", title: "Other (agent-org#852)", labels: [] }] })).code, 2, "another row's pull request");
});

test("BOUNDED: the third consecutive refusal for one row is not issued; the stop is allowed and ONE failure-ledger line is written", () => {
  const dir = stateDir();
  assert.equal(MAX_REFUSALS, 2);
  assert.equal(runHook(OFF, seams(dir)).code, 2);
  assert.equal(runHook(OFF, seams(dir)).code, 2);
  assert.deepEqual(ledgerEntries(dir), [], "nothing is on the ledger while the hook is still refusing");
  const third = runHook(OFF, seams(dir, { now: T0 + 5 * MIN }));
  assert.equal(third.code, 0, "the bound");
  assert.match(third.say.join("\n"), /ALLOWED/);
  const lines = ledgerEntries(dir);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], { classKey: STOP_HOOK_BOUND_KIND, at: T0 + 5 * MIN, ref: `${REPO}#853` });
});

test("a satisfied turn clears the run, a different row starts one, and a refusal never touches worker-state/", () => {
  const dir = stateDir();
  assert.equal(runHook(OFF, seams(dir)).code, 2);
  assert.equal(runHook(OFF, seams(dir, { prs: [PR_OF_THE_ROW] })).code, 0, "a pull request opened between the two turns");
  assert.equal(JSON.parse(readFileSync(countFile(dir), "utf8")).refusals, 0, "the run ended");
  assert.match(runHook(OFF, seams(dir)).say.join("\n"), /\(1 of 2\)/, "so the next loose end is the FIRST refusal again, not the second");
  const other = stateDir();
  mkdirSync(`${other}/${STOP_HOOK_DIR}`, { recursive: true });
  writeFileSync(countFile(other), `${JSON.stringify({ row: "agent-org#852", refusals: 2 })}\n`);
  assert.equal(runHook(OFF, seams(other)).code, 2, "another row's exhausted count is not this row's");
  const read = readDeclarations(`${other}/${WORKER_STATE_DIR}`);
  assert.deepEqual(read, { byClaimant: new Map(), unreadable: [] }, "no count file sits where the gate reads declarations");
  assert.deepEqual(readdirSync(other).sort(), [STOP_HOOK_DIR]);
});

test("it fails open and says so: unreadable declarations, an unreadable board, an unreadable count, a payload that is not JSON", async () => {
  const noDeclarations = stateDir();
  writeFileSync(`${noDeclarations}/${WORKER_STATE_DIR}`, "a file where the directory should be");
  const first = runHook(OFF, seams(noDeclarations));
  assert.equal(first.code, 0);
  assert.match(first.say.join("\n"), /could not be read/);
  const board = runHook(OFF, { ...seams(stateDir()), prs: () => { throw new Error("HTTP 502"); } });
  assert.equal(board.code, 0);
  assert.match(board.say.join("\n"), /HTTP 502/);
  const corrupt = stateDir();
  mkdirSync(`${corrupt}/${STOP_HOOK_DIR}`, { recursive: true });
  writeFileSync(countFile(corrupt), "{not json");
  assert.equal(runHook(OFF, seams(corrupt)).code, 0, "a count that cannot be read cannot bound a refusal, so none is issued");
  const garbled = await main("not json", [], {}, async () => { throw new Error("the seams must not be asked for"); });
  assert.equal(garbled.code, 0);
  assert.match(garbled.say.join("\n"), /payload could not be read/);
});

test("driven through the entry with the hook payload as stdin text: refused, then allowed on stop_hook_active without reading anything", async () => {
  const dir = stateDir();
  const live = async () => seams(dir);
  const refused = await main(JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false, session_id: "x" }), [], {}, live);
  assert.equal(refused.code, 2);
  assert.match(refused.say.join("\n"), /agent-org pr:open/);
  const continuing = await main(JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true }), [], {}, async () => { throw new Error("must not be read"); });
  assert.deepEqual(continuing, { code: 0, say: [] });
});

test("the program itself, run as the hook is: stop_hook_active ends in exit 0 and says nothing, and a payload that is not JSON exits 0 and says why", () => {
  const program = fileURLToPath(new URL("./worker-stop-hook.ts", import.meta.url));
  const run = (input: string) => spawnSync(process.execPath, [program], { input, encoding: "utf8", env: { PATH: process.env.PATH ?? "" } });
  const continuing = run(JSON.stringify({ stop_hook_active: true }));
  assert.deepEqual([continuing.status, continuing.stderr], [0, ""]);
  const garbled = run("not json");
  assert.equal(garbled.status, 0);
  assert.match(garbled.stderr, /ALLOWED/);
});

test("claimedRowOf: the first tracker's row, another tracker's, and the names that are none", () => {
  assert.deepEqual(claimedRowOf("worker-4202", TRACKERS), { key: "", row: 4202, repo: "a11ign/a11ign" });
  assert.deepEqual(claimedRowOf(SESSION, TRACKERS), { key: "agent-org", row: 853, repo: REPO });
  assert.equal(claimedRowOf("worker-capture-2407", TRACKERS), null, "an undeclared key");
  assert.equal(claimedRowOf("worker-agent-org", TRACKERS), null, "no row number");
  assert.equal(claimedRowOf("worker-agent-org-7-853", TRACKERS), null, "a key that ends in digits parses two ways, so it is none");
});
