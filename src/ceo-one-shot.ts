// @ts-check
// module: a `lane:ceo` row that carries a PATH, not a decision, run by a ONE-SHOT seat that carries the ceo brief, behind `workers.ceoOneShot` (a11ign/agent-org#914, Phase 1b of a11ign/a11ign#4505, the second lane after #832)
//
// WHAT IT IS. Today a ready row labelled `lane:ceo` is an order addressed to `ceo`, which only the standing seat reads. With the flag ON, `wake.ts` turns that order -- before delivery,
// never in the gate -- into one addressed to `engineers` whose cause is {@link CEO_ONE_SHOT_SPAWN_CAUSES}' and which carries `briefRole: "ceo"`, so the ordinary spawn path starts
// `worker-<tracker>-<row>` for it, briefs it with `ceo.md` (#828's `addressed(..., { briefRole })`) and ends it when its row closes (`endFinishedSpares`). The cause is a SIBLING of
// `SPAWN_CAUSES`, never a widening: that list is the engineer pilot's and its clean-cycle counter runs on it. The same goes for the orchestrator's one-shot cause (#832), which this
// module does not touch.
//
// OFF BY DEFAULT, AND OFF IS BYTE-IDENTICAL (a11ign#5100's rule for machinery that touches waking, `haiku-brief.ts`'s precedent): the flag is `workers.ceoOneShot` in the host declaration,
// exactly `true`; absent, `false` or anything else is off, and {@link withCeoOneShot} then returns the very array it was handed. The file is read only when the tick holds an order this
// would change. The revert is the flag's removal (or `false`): no record is written with it off, so #947's `laneReason` seam stays inert.
//
// WHICH ROWS. The ceo's one-shot is for a `lane:ceo` row that carries a PATH to follow, not a decision the ceo must make. Which rows those are is the gate's and the ceo's to say; this
// module runs whatever `work-gate` addresses to `ceo` with cause `ready-row-unclaimed`, and changes nothing else.
//
// THE CLAIM IDENTITY IS `ceo`'s RULING B (agent-org#947): the seat claims under its OWN name, and `laneReason` honours a RECORD OF A SPAWN. {@link CeoOneShot.stand} writes it, from the spawn
// path (the claimer `standInClaimer` wraps, so `spawnWorker`'s own order of checks is untouched), BEFORE the claim, and {@link CeoOneShot.forget} takes it back when the claim is refused or
// the spawn fails after it, so no record outlives a seat that never ran. The record's `owner` is `ceo`, so a standing `ceo` session is still refused by `laneReason` (the record names a seat
// that was spawned, not the standing seat).
//
// ONE RUN AT A TIME WHILE THE FLEET OR LAB IS IN THE ACCEPTANCE (`ceo`'s constraint (a): the hardware is single-operator). {@link CeoOneShot.hold} holds an order whose row's Acceptance names
// a `FLEET_LAB_PATTERNS` command while any one-shot ceo seat is live, and a row under a future `Fleet-hold-until`. A held order is not recorded, so the next tick asks again. It does not
// edit `ROUTED_TO`, `FLEET_LAB_PATTERNS` or `fleetOrLabAcceptance`: it asks the last as it stands. It counts only the ceo's own one-shot records: a live orchestrator one-shot is not held
// against it here (that module is outside this change), which is reported as an open item.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { fleetOrLabAcceptance } from "./acceptance-commands.ts";
import { hostConfigPath } from "./host-config.ts";
import { STAND_IN_MAX_AGE_MS, readStandIns, standInPath, writeStandIn, type LaneStandIn } from "./row-claim/lane-stand-in.ts";
import { briefRoleSentence } from "./spawn-role-brief.ts";
import type { OneShotRow } from "./orchestrator-one-shot.ts";
import { fleetHoldUntil } from "./waiting-condition.ts";

/** The flag's key in the host declaration, as `workers.ceoOneShot`. */
export const CEO_ONE_SHOT_FLAG = "workers.ceoOneShot";

/** The causes of a ceo one-shot run, a SIBLING of `wake.ts`'s `SPAWN_CAUSES` and never a member of it. */
export const CEO_ONE_SHOT_SPAWN_CAUSES: readonly string[] = Object.freeze(["ready-ceo-row-unclaimed"]);

/** The cause the gate writes for a ready row of a lane, and the session it addresses it to when the lane is the ceo's. */
const GATE_CAUSE = "ready-row-unclaimed";
const LANE_OWNER = "ceo";

/** The role brief the spawned seat is sent to read; one of `SPAWN_BRIEF_ROLES`. */
export const CEO_ONE_SHOT_BRIEF_ROLE = "ceo";

/** The lines already written, so a host file that stays unreadable is said once per process and not once per tick. */
const said = new Set<string>();

/**
 * Whether the host declaration turns the ceo one-shot lane on: `workers.ceoOneShot` is exactly `true`. An absent file or key is the ordinary case and says nothing; a file that cannot be
 * read or parsed, or a value present and not a boolean, is OFF and is SAID once, because a flag the operator meant to set that silently does nothing is the failure to see.
 * A wake is never refused for this.
 */
export function ceoOneShotEnabled({ path = hostConfigPath(), read = (file: string) => readFileSync(file, "utf8"), log = (line: string) => process.stderr.write(`${line}\n`) }:
  { path?: string; read?: (path: string) => string; log?: (line: string) => void } = {}): boolean {
  const say = (line: string) => {
    if (said.has(line)) return;
    said.add(line);
    log(line);
  };
  let declared: unknown;
  try {
    declared = JSON.parse(read(path));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException)?.code !== "ENOENT") say(`ceo-one-shot: ${path} could not be read (${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}); ${CEO_ONE_SHOT_FLAG} is off`);
    return false;
  }
  const workers = (declared as { workers?: unknown } | null)?.workers;
  const flag = typeof workers === "object" && workers !== null ? (workers as { ceoOneShot?: unknown }).ceoOneShot : undefined;
  if (flag !== undefined && typeof flag !== "boolean") say(`ceo-one-shot: ${CEO_ONE_SHOT_FLAG} in ${path} is ${JSON.stringify(flag)}, not true or false; it is off`);
  return flag === true;
}

/** Is this an order of a ceo one-shot run, as {@link withCeoOneShot} writes it? Addressed to `engineers` and carrying one of {@link CEO_ONE_SHOT_SPAWN_CAUSES}. */
export function isCeoOneShotOrder(order: { session: string; cause?: string; }): boolean {
  return order.session === "engineers" && CEO_ONE_SHOT_SPAWN_CAUSES.includes(String(order.cause));
}

/**
 * THE TICK'S ORDERS, with the gate's order for a ready `lane:ceo` row turned into a ceo one-shot run's when the flag is ON.
 *
 * A gate order for `session: "ceo"` with cause `ready-row-unclaimed` is exactly that row. ONLY `session`, `cause` and `briefRole` change: `causeKey` is the ledger's identity and `rowRefOfOrder`'s
 * input, so the delivery count, the "already woken" check and the row the spawn claims are the standing order's own. With the flag OFF, or with no such order, the SAME array comes back and the
 * file is not read.
 *
 * @param enabled the flag's reading; a parameter so a test hands it a stated value
 */
export function withCeoOneShot<T extends { session: string; cause?: string; }>(orders: readonly T[], { enabled = ceoOneShotEnabled }: { enabled?: () => boolean } = {}): readonly T[] {
  const changes = (order: T) => order.session === LANE_OWNER && order.cause === GATE_CAUSE;
  if (!orders.some(changes) || !enabled()) return orders;
  return orders.map((order) => (changes(order)
    ? { ...order, session: "engineers", cause: CEO_ONE_SHOT_SPAWN_CAUSES[0], briefRole: CEO_ONE_SHOT_BRIEF_ROLE }
    : order));
}

/** What the spawn path asks of a ceo one-shot run. */
export type CeoOneShot = {
  /** Why this order must not start a seat now, or `null`. Asked before the claim and before any pane exists. */
  hold: (row: OneShotRow, seat: string, live: readonly { label: string; }[]) => string | null;
  /** Record that `seat` was spawned for `row` as the ceo's one-shot: what `laneReason` honours (#947). Called before the claim, and only for a ceo one-shot order. */
  stand: (row: OneShotRow, seat: string) => void;
  /** Take that record back, for a spawn that was refused or failed after {@link stand}. */
  forget: (row: OneShotRow, seat: string) => void;
};

/**
 * @param readRow the row's body, one read; THROWS when it cannot (the order is then held: whether its Acceptance reaches the hardware is not known)
 * @param path where the records live; the host's by default, a parameter so a test hands it a temp file
 * @param write the writer of #947 (`lane-stand-in.ts`); a parameter so a test can count its calls
 */
export function createCeoOneShot({ readRow, path = standInPath(), now = Date.now, write = writeStandIn }: {
  readRow: (row: number, key?: string) => { body: string; };
  path?: string; now?: () => number; write?: typeof writeStandIn;
}): CeoOneShot {
  const mention = (row: OneShotRow) => `${row.key === "" ? "" : row.key}#${row.number}`;
  return {
    hold(row, seat, live) {
      // THE BRIEF IS CHECKED BEFORE THE CLAIM: `addressed` throws naming a missing brief, and by then the row is claimed and a pane sits idle on it.
      try {
        briefRoleSentence(CEO_ONE_SHOT_BRIEF_ROLE);
      } catch (err) {
        return `the ${CEO_ONE_SHOT_BRIEF_ROLE} brief cannot be named (${String((err as Error).message).split("\n")[0]})`;
      }
      let body: string;
      try {
        body = readRow(row.number, row.key).body;
      } catch (err) {
        return `${mention(row)} could not be read (${String((err as Error).message ?? err).split("\n")[0].slice(0, 160)}), so whether its Acceptance reaches the fleet or the lab is not known and it is held, not guessed`;
      }
      const until = fleetHoldUntil(body);
      if (until !== null && Date.parse(until) > now()) return `${mention(row)} carries \`Fleet-hold-until: ${until}\``;
      if (fleetOrLabAcceptance(body) === null) return null;
      const present = new Set(live.map((agent) => agent.label));
      const running = readStandIns(path).filter((r) => r.owner === LANE_OWNER && r.seat !== seat && present.has(r.seat)
        && now() - r.writtenAt >= 0 && now() - r.writtenAt <= STAND_IN_MAX_AGE_MS);
      if (running.length === 0) return null;
      return `${mention(row)}'s Acceptance names a fleet or lab command and one ceo run is live (${running.map((r) => `${r.seat} for #${r.row}`).join(", ")}): `
        + "the hardware is single-operator, so this order is held until that run ends";
    },
    stand(row, seat) {
      write({ seat, row: row.number, owner: LANE_OWNER }, { path, now: now() });
    },
    forget(row, seat) {
      const all = readStandIns(path);
      const kept = all.filter((r: LaneStandIn) => !(r.seat === seat && r.row === row.number && r.owner === LANE_OWNER));
      if (kept.length === all.length) return;
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, `${JSON.stringify(kept, null, 2)}\n`);
      renameSync(tmp, path);
    },
  };
}
