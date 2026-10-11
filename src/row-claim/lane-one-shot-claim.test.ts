// #947 (`ceo`'s ruling B): a one-shot seat carrying a lane owner's brief is let through that owner's lane for the ONE row a
// record of its spawn names, and for nothing else. Every case runs the real `laneReason` (and, for the claim path, the real
// `decideClaim`) against a stated roster.
// no-token: LIVE_SESSIONS
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { laneReason } from "./runner-rule.ts";
import { decideClaim } from "../row-claim.ts";
import { readStandIns, writeStandIn, STAND_IN_MAX_AGE_MS } from "./lane-stand-in.ts";

const NOW = Date.parse("2026-10-11T12:00:00Z");
const live = ["ceo", "product-manager", "orchestrator", "liaison"];
const seat = "worker-agent-org-832";
const record = { seat, row: 832, owner: "orchestrator", writtenAt: NOW - 60_000 };
const orchestratorRow = ["lane:orchestrator", "in-progress"];
const deps = (over: object = {}) => ({ liveSessions: live, standIns: [record], row: 832, now: NOW, ...over });

test("a record naming THAT seat, THAT row and the owner `orchestrator` passes the seat through the lane", () => {
  assert.equal(laneReason(orchestratorRow, seat, deps()), null);
});

test("positive control: the same seat and row with NO record is refused", () => {
  assert.match(String(laneReason(orchestratorRow, seat, deps({ standIns: [] }))), /orchestrator's lane/);
});

test("an ordinary spawned engineer (no record of its own) is refused the same row", () => {
  assert.match(String(laneReason(orchestratorRow, "worker-agent-org-833", deps())), /orchestrator's lane/);
});

test("the same seat is refused a DIFFERENT row than the record names", () => {
  assert.match(String(laneReason(orchestratorRow, seat, deps({ row: 833 }))), /orchestrator's lane/);
});

test("no row handed in (a closed row, or a caller that reads no record) honours nothing", () => {
  assert.match(String(laneReason(orchestratorRow, seat, deps({ row: undefined }))), /orchestrator's lane/);
});

test("a standing non-orchestrator session (`worker-capture`) is still refused the row", () => {
  assert.match(String(laneReason(orchestratorRow, "worker-capture", deps())), /orchestrator's lane/);
});

test("a `lane:ceo` row is refused to the same seat: a one-shot of one owner is not a one-shot of every owner", () => {
  assert.match(String(laneReason(["lane:ceo", "in-progress"], seat, deps())), /ceo's lane/);
});

test("a row in two lanes is passed only the lane the record names", () => {
  assert.match(String(laneReason(["lane:orchestrator", "lane:ceo"], seat, deps())), /ceo's lane/);
});

test("a stale record is not honoured, and a record from the future is not either", () => {
  const stale = { ...record, writtenAt: NOW - STAND_IN_MAX_AGE_MS - 1 };
  assert.ok(laneReason(orchestratorRow, seat, deps({ standIns: [stale] })));
  assert.ok(laneReason(orchestratorRow, seat, deps({ standIns: [{ ...record, writtenAt: NOW + 1 }] })));
});

test("through decideClaim: the seat proceeds with its record and is refused without it", () => {
  const withRecord = decideClaim(["lane:orchestrator", "ready"], seat, { row: 832, standIns: [record], now: NOW });
  assert.deepEqual(withRecord, { proceed: true });
  const without = decideClaim(["lane:orchestrator", "ready"], seat, { row: 832, standIns: [], now: NOW });
  assert.equal(without.proceed, false);
});

test("the record file round-trips, and an unreadable file is no record", () => {
  const dir = mkdtempSync(join(tmpdir(), "stand-in-"));
  const path = join(dir, "lane-stand-ins.json");
  try {
  assert.deepEqual(readStandIns(path), []);
  writeStandIn({ seat, row: 832, owner: "orchestrator" }, { path, now: NOW });
  writeStandIn({ seat, row: 832, owner: "orchestrator" }, { path, now: NOW + 5 });
  assert.deepEqual(readStandIns(path), [{ seat, row: 832, owner: "orchestrator", writtenAt: NOW + 5 }]);
  writeFileSync(path, "{not json");
  assert.deepEqual(readStandIns(path), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
