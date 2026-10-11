// no-token: none -- the port is a recording stub and the lease lives in a temporary directory; nothing here spawns a process or reaches a tracker.
/**
 * agent-org#901 (Move 2/3 of a11ign/a11ign#4505): A DECISION IS APPLIED ONLY TO AN ITEM THAT HAS NOT CHANGED SINCE ITS BRIEF.
 *
 *   1. POSITIVE CONTROL: an unchanged item gets one `postDecision` carrying the role and run id and one `changeState` with the declared actions;
 *   2. NEGATIVE CONTROL, each its own case, each with NO write recorded: a newer event (`stale`), an unreadable item, a refused answer, a held lease;
 *   3. a stale lease is taken, and a release by a run that does not hold it removes nothing;
 *   4. `apply.ts` imports no adapter and spawns nothing, and the source check SEES a fixture that does.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LEASE_MS, applyDecision, leaseItem, leasePath, releaseItem } from "./apply.ts";
import type { ApplyInput } from "./apply.ts";
import type { ItemEvent, ItemRef, StateChange, TicketItem, TicketPort } from "../ticket-port/port.ts";

const made: string[] = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});
function leaseDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "lease-"));
  made.push(dir);
  return dir;
}

const HERE = dirname(fileURLToPath(import.meta.url));
const REF: ItemRef = { tracker: "github", scope: "a11ign/agent-org", id: 901 };
const SINCE = "2026-10-11T10:00:00Z";

function stub(events: readonly ItemEvent[] | null) {
  const writes: string[] = [];
  const posted: unknown[] = [];
  const changed: StateChange[] = [];
  const port: TicketPort = {
    readItem: () =>
      events === null
        ? null
        : ({ ref: REF, title: "t", body: "", state: "ready", flags: [], relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] }, events } satisfies TicketItem),
    postDecision: (_ref, decision) => {
      writes.push("postDecision");
      posted.push(decision);
      return "comment-1";
    },
    changeState: (_ref, change) => {
      writes.push("changeState");
      changed.push(change);
      return true;
    },
    subscribe: () => () => {},
  };
  return { port, writes, posted, changed };
}

const input = (over: Partial<ApplyInput> = {}): ApplyInput => ({
  ref: REF, sinceAt: SINCE, allowed: ["park", "go"], decision: { answer: "park", text: "parked: nothing to do", kind: "triage" },
  role: "product-manager", runId: "run-1", actions: { state: "parked", addFlags: ["hold"], removeFlags: ["priority"] }, ...over,
});

const OLD: ItemEvent = { at: "2026-10-11T09:00:00Z", actor: "a", kind: "flag-added" };
const NEW: ItemEvent = { at: "2026-10-11T10:00:01Z", actor: "b", kind: "state-changed" };

test("POSITIVE CONTROL: an unchanged item is posted to once with the role and run id, and changed once with the declared actions", () => {
  const s = stub([OLD]);
  const r = applyDecision(s.port, input());
  assert.equal(r.outcome, "applied");
  assert.deepEqual(s.writes, ["postDecision", "changeState"]);
  assert.deepEqual(s.posted, [{ role: "product-manager", runId: "run-1", kind: "triage", text: "parked: nothing to do" }]);
  assert.deepEqual(s.changed, [{ state: "parked", addFlags: ["hold"], removeFlags: ["priority"] }]);
});

test("an event exactly at sinceAt is the brief's own and is not a change", () => {
  const s = stub([{ ...OLD, at: SINCE }]);
  assert.equal(applyDecision(s.port, input()).outcome, "applied");
});

test("NEGATIVE CONTROL: an event newer than sinceAt is stale and writes nothing, wherever it sits in the tail", () => {
  for (const events of [[OLD, NEW], [NEW, OLD]]) {
    const s = stub(events);
    const r = applyDecision(s.port, input());
    assert.equal(r.outcome, "stale");
    assert.deepEqual(s.writes, []);
  }
});

test("NEGATIVE CONTROL: an event time that cannot be read is stale, never written through", () => {
  const s = stub([{ ...OLD, at: "not a time" }]);
  assert.equal(applyDecision(s.port, input()).outcome, "stale");
  assert.deepEqual(s.writes, []);
});

test("NEGATIVE CONTROL: an item the port could not read is unreadable and writes nothing", () => {
  const s = stub(null);
  assert.equal(applyDecision(s.port, input()).outcome, "unreadable");
  assert.deepEqual(s.writes, []);
});

test("NEGATIVE CONTROL: an answer outside allowed is refused and writes nothing", () => {
  const s = stub([OLD]);
  const r = applyDecision(s.port, input({ decision: { answer: "close", text: "x", kind: "triage" } }));
  assert.equal(r.outcome, "refused");
  assert.deepEqual(s.writes, []);
});

test("empty actions post the decision and do not call changeState", () => {
  const s = stub([OLD]);
  const r = applyDecision(s.port, input({ actions: {} }));
  assert.deepEqual(s.writes, ["postDecision"]);
  assert.equal(r.outcome === "applied" && r.changed, false);
});

test("NEGATIVE CONTROL: a live lease for another run is held and names the holder; the lease file is the holder's", () => {
  const dir = leaseDir();
  const now = Date.parse(SINCE);
  assert.deepEqual(leaseItem(dir, REF, "run-1", now), { held: false, leaseId: "run-1" });
  assert.deepEqual(leaseItem(dir, REF, "run-2", now + LEASE_MS - 1), { held: true, by: "run-1" });
  assert.equal(JSON.parse(readFileSync(leasePath(dir, REF), "utf8")).runId, "run-1");
});

test("a lease older than LEASE_MS is stale and is taken; an unreadable lease file is taken too", () => {
  const dir = leaseDir();
  const now = Date.parse(SINCE);
  leaseItem(dir, REF, "run-1", now);
  assert.deepEqual(leaseItem(dir, REF, "run-2", now + LEASE_MS), { held: false, leaseId: "run-2" });
  assert.equal(JSON.parse(readFileSync(leasePath(dir, REF), "utf8")).runId, "run-2");
  writeBroken(leasePath(dir, REF));
  assert.deepEqual(leaseItem(dir, REF, "run-3", now), { held: false, leaseId: "run-3" });
});

function writeBroken(path: string): void {
  writeFileSync(path, "{half");
}

test("NEGATIVE CONTROL: a stale lease being taken by another run (its lock is held) is not also taken; a finished take leaves no lock", () => {
  const dir = leaseDir();
  const now = Date.parse(SINCE);
  leaseItem(dir, REF, "run-1", now);
  const lock = `${leasePath(dir, REF)}.lock`;
  writeFileSync(lock, String(now + LEASE_MS));
  const r = leaseItem(dir, REF, "run-2", now + LEASE_MS);
  assert.equal(r.held, true);
  assert.equal(JSON.parse(readFileSync(leasePath(dir, REF), "utf8")).runId, "run-1");
  rmSync(lock);
  assert.deepEqual(leaseItem(dir, REF, "run-2", now + LEASE_MS), { held: false, leaseId: "run-2" });
  assert.equal(existsSync(lock), false);
  // the second taker of the same stale file sees the first's fresh lease
  assert.deepEqual(leaseItem(dir, REF, "run-3", now + LEASE_MS), { held: true, by: "run-2" });
});

test("NEGATIVE CONTROL: releaseItem while a takeover holds the lock removes nothing, and leaves no lock of its own", () => {
  const dir = leaseDir();
  leaseItem(dir, REF, "run-1", Date.now());
  const lock = `${leasePath(dir, REF)}.lock`;
  writeFileSync(lock, String(Date.now()));
  assert.equal(releaseItem(dir, REF, "run-1"), false);
  assert.equal(existsSync(leasePath(dir, REF)), true);
  rmSync(lock);
  assert.equal(releaseItem(dir, REF, "run-1"), true);
  assert.equal(existsSync(lock), false);
});

test("releaseItem by a run that does not hold the lease removes nothing; by the holder removes it", () => {
  const dir = leaseDir();
  leaseItem(dir, REF, "run-1", 1_000);
  assert.equal(releaseItem(dir, REF, "run-2"), false);
  assert.equal(existsSync(leasePath(dir, REF)), true);
  assert.equal(releaseItem(dir, REF, "run-1"), true);
  assert.equal(existsSync(leasePath(dir, REF)), false);
  assert.equal(releaseItem(dir, REF, "run-1"), false);
});

// --- source check --------------------------------------------------------------------------------------------------------------------

/** What makes a module reach a tracker by itself: an import of the adapter, or of a process-spawning module. */
function reachesOutside(source: string): string[] {
  const found: string[] = [];
  if (/from\s+["'][^"']*github-adapter(\.ts)?["']/.test(source)) found.push("github-adapter import");
  if (/from\s+["'](node:)?child_process["']/.test(source)) found.push("child_process import");
  if (/\b(execFileSync|execSync|spawnSync|spawn|execFile)\s*\(/.test(source)) found.push("spawn call");
  return found;
}

test("apply.ts imports no adapter and spawns nothing, and the check sees a fixture that does", () => {
  assert.deepEqual(reachesOutside(readFileSync(join(HERE, "apply.ts"), "utf8")), []);
  const bad = `import { x } from "../ticket-port/github-adapter.ts";\nimport { execFileSync } from "node:child_process";\nexecFileSync("gh", []);`;
  assert.deepEqual(reachesOutside(bad), ["github-adapter import", "child_process import", "spawn call"]);
});
