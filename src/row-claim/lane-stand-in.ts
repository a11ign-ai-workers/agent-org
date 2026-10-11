// @ts-check
import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { stateEntryPath } from "../host-config.ts";

// RECORD OF A SPAWN: A ONE-SHOT SEAT STANDS IN FOR A LANE OWNER FOR ONE ROW -- #947 (`ceo`'s ruling B).
//
// `laneReason` compares the session name to the `lane:<owner>` label, so a spawned `worker-agent-org-<row>` seat
// that carries the owner's role brief (#832) is still refused the owner's row. The fact that lets it through is
// a RECORD OF A SPAWN -- seat, row, owner, when -- and never a roster field or a name pattern: a roster line
// naming the `worker-agent-org-` family would let every spawned engineer claim every `lane:orchestrator` row,
// which dissolves the lane. A record is honoured for exactly the (seat, row, owner) triple it names, while it is
// fresh, and while its row is open (the caller passes no row for a closed one).
//
// The writer is called by the spawn path of #832 when it passes `briefRole`; nothing in this repository writes a
// record yet, so with no record on disk the rule is inert.

export type LaneStandIn = { seat: string; row: number; owner: string; writtenAt: number };

/** A record older than this is not honoured: a seat is ended when its row closes, so a day is longer than any one-shot lives. */
export const STAND_IN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const FILE = "lane-stand-ins.json";

/** Where the records live on this host. */
export function standInPath(): string {
  return stateEntryPath(FILE);
}

function isRecord(v: unknown): v is LaneStandIn {
  const r = v as Partial<LaneStandIn> | null;
  return typeof r === "object" && r !== null && typeof r.seat === "string" && typeof r.owner === "string"
    && Number.isInteger(r.row) && typeof r.writtenAt === "number";
}

/**
 * The records on disk. A missing or unreadable file is NO records (the rule stays inert, so a claim is refused
 * exactly as before): an unreadable record can only withhold a pass, never grant one.
 */
export function readStandIns(path: string = standInPath()): LaneStandIn[] {
  try {
    if (!existsSync(path)) return [];
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

/** Writes (or replaces, per seat+row+owner) one record, by rename so a reader never sees a half-written file. */
export function writeStandIn(record: Omit<LaneStandIn, "writtenAt">, { path = standInPath(), now = Date.now() }: { path?: string; now?: number; } = {}): void {
  const kept = readStandIns(path).filter((r) => !(r.seat === record.seat && r.row === record.row && r.owner === record.owner));
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify([...kept, { ...record, writtenAt: now }], null, 2)}\n`);
  renameSync(tmp, path);
}

/** Does a fresh record name THIS seat, THIS row and THIS owner? */
export function standsIn(records: readonly LaneStandIn[], who: { seat: string; row: number; owner: string; now: number }): boolean {
  return records.some((r) => r.seat === who.seat && r.row === who.row && r.owner === who.owner
    && who.now - r.writtenAt >= 0 && who.now - r.writtenAt <= STAND_IN_MAX_AGE_MS);
}
