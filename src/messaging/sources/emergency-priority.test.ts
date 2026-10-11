// no-token: gh -- no `gh` is run: the failure ledger's text and the row are fixtures, and the messenger is the fake provider
/**
 * #5032, change 4: the chairman is told, once, each time the gate honours `priority:emergency`, with the row, the incident and `ceo`'s reason.
 * THE DETECTOR is the real path from the gate's ledger line (`recordEmergencyPriority`) through this source and `createMessenger` to a provider's `sent`. Each "told nothing" test has a
 * sibling that is told in the same world but for the one thing that makes it speak.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createMessenger } from "../core.ts";
import { createFakeProvider } from "../fake-provider.ts";
import { createLedger } from "../ledger.ts";
import { EMERGENCY_PRIORITY } from "../watch.ts";
import { EMERGENCY_PRIORITY_NOT_HONOURED_KIND, FAILURE_LEDGER_FILE } from "../../failure-ledger.ts";
import { recordEmergencyPriority } from "../../failure-recorders.ts";
import { observeEmergencyUses, usesIn } from "./emergency-priority.ts";

const T0 = Date.parse("2026-10-11T15:00:00Z");
const REPO = "a11ign/a11ign";
const INCIDENT = "a11ign/agent-org#889";
const ROW = { body: "## Region\n\nx\n\nIncident: a11ign/agent-org#889\nEmergency-reason: every claim is refused for want of a rule file\n" };

async function withDir(body: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "emergency-priority-source-"));
  try { await body(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}

/** The gate's own recorder writes the line, and the text comes back from the file it wrote. */
function ledgerAfter(dir: string, { honoured = [{ number: 300, incident: INCIDENT }], ignored = [] as { number: number; actor: string | null; why: string; }[] } = {}): string {
  recordEmergencyPriority({ ignored, honoured, repo: REPO, stateDir: dir, now: T0 });
  return readFileSync(join(dir, FAILURE_LEDGER_FILE), "utf8");
}

test("an honoured use is told as ONE announcement naming the row, the incident and ceo's reason, and a second tick sends nothing more", async () => withDir(async (dir) => {
  const text = ledgerAfter(dir);
  const asked: string[] = [];
  const provider = createFakeProvider({ capabilities: { destinations: 2 } });
  const messenger = createMessenger({ provider, ledger: createLedger({ path: join(dir, "messaging.jsonl"), now: () => T0 }), now: () => T0 });
  const tick = async () => {
    const { events } = await observeEmergencyUses({ readLedger: () => text, readRow: async ({ repo, number }) => { asked.push(`${repo}#${number}`); return ROW; }, now: () => T0 + 60_000 });
    await messenger.tick(events);
    return events.length;
  };
  assert.equal(await tick(), 1, "the source offers the use");
  assert.equal(await tick(), 1, "and offers it again: the CORE is what dedupes by key");
  assert.deepEqual(asked, [`${REPO}#300`, `${REPO}#300`]);
  assert.equal(provider.sent.length, 1, "told once");
  assert.match(provider.sent[0].text, new RegExp(`${REPO}#300`));
  assert.match(provider.sent[0].text, /a11ign\/agent-org#889/);
  assert.match(provider.sent[0].text, /every claim is refused for want of a rule file/);
  assert.equal(provider.sent[0].audience, "announcement", "to the channel, not a question in the chairman's chat");
}));

test("a use that is MISUSE, or that is a line of another class, is never announced; the same ledger with an honoured line is (positive control)", async () => withDir(async (dir) => {
  const misuse = ledgerAfter(dir, { honoured: [], ignored: [{ number: 301, actor: "a11ign-workers[bot]", why: "actor" }] });
  assert.match(misuse, new RegExp(EMERGENCY_PRIORITY_NOT_HONOURED_KIND), "control: the misuse line is in the ledger");
  const readRow = async () => ROW;
  const none = await observeEmergencyUses({ readLedger: () => misuse, readRow, now: () => T0 });
  assert.deepEqual(none, { events: [], cannotAsk: [] });
  const told = await observeEmergencyUses({ readLedger: () => ledgerAfter(dir), readRow, now: () => T0 });
  assert.equal(told.events.length, 1);
}));

test("a use older than a day is history, and an absent ledger is nothing used", async () => withDir(async (dir) => {
  const text = ledgerAfter(dir);
  const readRow = async () => ROW;
  assert.equal((await observeEmergencyUses({ readLedger: () => text, readRow, now: () => T0 + 23 * 3_600_000 })).events.length, 1, "control: 23 hours on it is still news");
  assert.equal((await observeEmergencyUses({ readLedger: () => text, readRow, now: () => T0 + 25 * 3_600_000 })).events.length, 0);
  assert.deepEqual(await observeEmergencyUses({ readLedger: () => null, readRow, now: () => T0 }), { events: [], cannotAsk: [] });
}));

test("a row that cannot be read is cannot-ask, not an announcement without the reason, and a ledger that cannot be read is cannot-ask too", async () => withDir(async (dir) => {
  const text = ledgerAfter(dir);
  const noRow = await observeEmergencyUses({ readLedger: () => text, readRow: async () => { throw new Error("rate limited"); }, now: () => T0 });
  assert.equal(noRow.events.length, 0);
  assert.deepEqual(noRow.cannotAsk.map((entry) => entry.reason), ["Error: rate limited"], "the reason is the source's own `describeError`");
  const noLedger = await observeEmergencyUses({ readLedger: () => { throw new Error("EACCES"); }, readRow: async () => ROW, now: () => T0 });
  assert.deepEqual([noLedger.events.length, noLedger.cannotAsk.map((entry) => entry.source)], [0, ["emergency-priority"]]);
}));

test("a row with no `Emergency-reason:` line is still told, and says so", async () => withDir(async (dir) => {
  const { events } = await observeEmergencyUses({ readLedger: () => ledgerAfter(dir), readRow: async () => ({ body: "no reason here" }), now: () => T0 });
  assert.match(String(events[0].text), /none given on the row/);
}));

test("`usesIn` reads the gate's own ref and skips one it does not recognise", () => {
  const text = [`emergency-priority-used\t${T0}\t${REPO}#300:${INCIDENT}`, `emergency-priority-used\t${T0}\tnot-a-ref`, `main-red\t${T0}\tabc`].join("\n");
  assert.deepEqual(usesIn(text), [{ repo: REPO, number: 300, incident: INCIDENT, at: T0 }]);
});

test("the watcher's source asks nothing of a caller whose readers name no failure ledger, and asks the ledger of one that does", async () => withDir(async (dir) => {
  const context = (readers: Record<string, any>, api: (path: string) => unknown) => ({ github: { api }, repo: REPO, now: T0, openKeys: [], summary: null, readers, history: [], releaseRepos: [], milestonesPath: null, watchReaders: undefined });
  const paths: string[] = [];
  const api = (path: string) => { paths.push(path); return ROW; };
  assert.deepEqual(await EMERGENCY_PRIORITY.observe(context({}, api)), { events: [], notes: [] });
  const text = ledgerAfter(dir);
  const told = await EMERGENCY_PRIORITY.observe(context({ readFailureLedger: () => text }, api));
  assert.equal(told.events.length, 1);
  assert.deepEqual(paths, [`repos/${REPO}/issues/300`]);
}));
