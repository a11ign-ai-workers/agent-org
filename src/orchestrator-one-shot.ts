// @ts-check
// module: a `lane:orchestrator` row run by a ONE-SHOT seat that carries the orchestrator brief, behind `workers.orchestratorOneShot` (a11ign/agent-org#832, Phase 1b of a11ign/a11ign#4505)
//
// WHAT IT IS. Today a ready row labelled `lane:orchestrator` is an order addressed to `orchestrator`, which only the standing seat reads. With the flag ON, `wake.ts` turns that
// order -- before delivery, never in the gate -- into one addressed to `engineers` whose cause is {@link ONE_SHOT_SPAWN_CAUSES}' and which carries `briefRole: "orchestrator"`, so the
// ordinary spawn path starts `worker-<tracker>-<row>` for it, briefs it with `orchestrator.md` (#828's `addressed(..., { briefRole })`) and ends it when its row closes
// (`endFinishedSpares`). The cause is a SIBLING of `SPAWN_CAUSES`, never a widening: that list is the engineer pilot's and its clean-cycle counter runs on it.
//
// OFF BY DEFAULT, AND OFF IS BYTE-IDENTICAL (a11ign#5100's rule for machinery that touches waking, `haiku-brief.ts`'s precedent): the flag is `workers.orchestratorOneShot` in the host
// declaration, exactly `true`; absent, `false` or anything else is off, and {@link withOrchestratorOneShot} then returns the very array it was handed. The file is read only when the
// tick holds an order this would change. The revert is the flag's removal (or `false`): no record is written with it off, so #947's `laneReason` seam stays inert.
//
// THE CLAIM IDENTITY IS `ceo`'s RULING B (agent-org#947): the seat claims under its OWN name, and `laneReason` honours a RECORD OF A SPAWN. {@link OrchestratorOneShot.stand} writes it, from
// the spawn path (the claimer {@link standInClaimer} wraps, so `spawnWorker`'s own order of checks is untouched), BEFORE the claim, and {@link OrchestratorOneShot.forget} takes it back when
// the claim is refused or the spawn fails after it, so no record outlives a seat that never ran.
//
// ONE RUN AT A TIME WHILE THE FLEET OR LAB IS IN THE ACCEPTANCE (`ceo`'s constraint (a): the hardware is single-operator). {@link OrchestratorOneShot.hold} holds an order whose row's
// Acceptance names a `FLEET_LAB_PATTERNS` command while any one-shot orchestrator seat is live, and a row under a future `Fleet-hold-until`. A held order is not recorded, so the
// next tick asks again. It does not edit `ROUTED_TO`, `FLEET_LAB_PATTERNS` or `fleetOrLabAcceptance`: it asks the last as it stands.
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { fleetOrLabAcceptance } from "./acceptance-commands.ts";
import { hostConfigPath } from "./host-config.ts";
import { STAND_IN_MAX_AGE_MS, readStandIns, standInPath, writeStandIn, type LaneStandIn } from "./row-claim/lane-stand-in.ts";
import { briefRoleSentence } from "./spawn-role-brief.ts";
import type { SpawnClaimer } from "./wake.ts";
import { fleetHoldUntil } from "./waiting-condition.ts";

/** The flag's key in the host declaration, as `workers.orchestratorOneShot`. */
export const ORCHESTRATOR_ONE_SHOT_FLAG = "workers.orchestratorOneShot";

/** The causes of a one-shot run, a SIBLING of `wake.ts`'s `SPAWN_CAUSES` and never a member of it. */
export const ONE_SHOT_SPAWN_CAUSES: readonly string[] = Object.freeze(["ready-orchestrator-row-unclaimed"]);

/** The cause the gate writes for a ready row of a lane, and the session it addresses it to when the lane is the orchestrator's. */
const GATE_CAUSE = "ready-row-unclaimed";
const LANE_OWNER = "orchestrator";

/** The role brief the spawned seat is sent to read; one of `SPAWN_BRIEF_ROLES`. */
export const ONE_SHOT_BRIEF_ROLE = "orchestrator";

/** The lines already written, so a host file that stays unreadable is said once per process and not once per tick. */
const said = new Set<string>();

/**
 * Whether the host declaration turns the one-shot lane on: `workers.orchestratorOneShot` is exactly `true`. An absent file or key is the ordinary case and says nothing; a file that
 * cannot be read or parsed, or a value present and not a boolean, is OFF and is SAID once, because a flag the operator meant to set that silently does nothing is the failure to see.
 * A wake is never refused for this.
 */
export function orchestratorOneShotEnabled({ path = hostConfigPath(), read = (file: string) => readFileSync(file, "utf8"), log = (line: string) => process.stderr.write(`${line}\n`) }:
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
    if ((cause as NodeJS.ErrnoException)?.code !== "ENOENT") say(`orchestrator-one-shot: ${path} could not be read (${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}); ${ORCHESTRATOR_ONE_SHOT_FLAG} is off`);
    return false;
  }
  const workers = (declared as { workers?: unknown } | null)?.workers;
  const flag = typeof workers === "object" && workers !== null ? (workers as { orchestratorOneShot?: unknown }).orchestratorOneShot : undefined;
  if (flag !== undefined && typeof flag !== "boolean") say(`orchestrator-one-shot: ${ORCHESTRATOR_ONE_SHOT_FLAG} in ${path} is ${JSON.stringify(flag)}, not true or false; it is off`);
  return flag === true;
}

/** Is this an order of a one-shot run, as {@link withOrchestratorOneShot} writes it? Addressed to `engineers` and carrying one of {@link ONE_SHOT_SPAWN_CAUSES}. */
export function isOneShotOrder(order: { session: string; cause?: string; }): boolean {
  return order.session === "engineers" && ONE_SHOT_SPAWN_CAUSES.includes(String(order.cause));
}

/**
 * THE TICK'S ORDERS, with the gate's order for a ready `lane:orchestrator` row turned into a one-shot run's when the flag is ON.
 *
 * A gate order for `session: "orchestrator"` with cause `ready-row-unclaimed` is exactly that row (`work-gate` addresses a ready row to its lane's owner and no other order of that cause to
 * `orchestrator`). ONLY `session`, `cause` and `briefRole` change: `causeKey` is the ledger's identity and `rowRefOfOrder`'s input, so the delivery count, the "already woken" check and the
 * row the spawn claims are the standing order's own. With the flag OFF, or with no such order, the SAME array comes back and the file is not read.
 *
 * @param enabled the flag's reading; a parameter so a test hands it a stated value
 */
export function withOrchestratorOneShot<T extends { session: string; cause?: string; }>(orders: readonly T[], { enabled = orchestratorOneShotEnabled }: { enabled?: () => boolean } = {}): readonly T[] {
  const changes = (order: T) => order.session === LANE_OWNER && order.cause === GATE_CAUSE;
  if (!orders.some(changes) || !enabled()) return orders;
  return orders.map((order) => (changes(order)
    ? { ...order, session: "engineers", cause: ONE_SHOT_SPAWN_CAUSES[0], briefRole: ONE_SHOT_BRIEF_ROLE }
    : order));
}

/** A row and the tracker it is in, as `wake.ts`'s `RowRef`: `key` is `""` for the first tracker. */
export type OneShotRow = { key: string; number: number; };

/** What the spawn path asks of a one-shot run. */
export type OrchestratorOneShot = {
  /** Why this order must not start a seat now, or `null`. Asked before the claim and before any pane exists. */
  hold: (row: OneShotRow, seat: string, live: readonly { label: string; }[]) => string | null;
  /** Record that `seat` was spawned for `row` as the orchestrator's one-shot: what `laneReason` honours (#947). Called before the claim, and only for a one-shot order. */
  stand: (row: OneShotRow, seat: string) => void;
  /** Take that record back, for a spawn that was refused or failed after {@link stand}. */
  forget: (row: OneShotRow, seat: string) => void;
};

/**
 * @param readRow the row's body, one read; THROWS when it cannot (the order is then held: whether its Acceptance reaches the hardware is not known)
 * @param path where the records live; the host's by default, a parameter so a test hands it a temp file
 * @param write the writer of #947 (`lane-stand-in.ts`); a parameter so a test can count its calls
 */
export function createOrchestratorOneShot({ readRow, path = standInPath(), now = Date.now, write = writeStandIn }: {
  readRow: (row: number, key?: string) => { body: string; };
  path?: string; now?: () => number; write?: typeof writeStandIn;
}): OrchestratorOneShot {
  const mention = (row: OneShotRow) => `${row.key === "" ? "" : row.key}#${row.number}`;
  return {
    hold(row, seat, live) {
      // THE BRIEF IS CHECKED BEFORE THE CLAIM: `addressed` throws naming a missing brief, and by then the row is claimed and a pane sits idle on it.
      try {
        briefRoleSentence(ONE_SHOT_BRIEF_ROLE);
      } catch (err) {
        return `the ${ONE_SHOT_BRIEF_ROLE} brief cannot be named (${String((err as Error).message).split("\n")[0]})`;
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
      return `${mention(row)}'s Acceptance names a fleet or lab command and one orchestrator run is live (${running.map((r) => `${r.seat} for #${r.row}`).join(", ")}): `
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

/**
 * THE CLAIMER A ONE-SHOT RUN'S SPAWN USES: `inner`'s, preceded by {@link OrchestratorOneShot.hold} and {@link OrchestratorOneShot.stand}, and followed by {@link OrchestratorOneShot.forget}
 * when the claim is refused or the spawn is undone after it (`release`). `spawnWorker` asks its host, brief and claimability checks BEFORE `claim`, so a record is only ever written for a
 * seat about to claim.
 *
 * A REFUSAL, NOT A THROW, FOR A MISSING PIECE: with no `oneShot` or no `inner` the order is not spawned, because the one-at-a-time rule and the claim are what this run exists behind.
 *
 * @param rowOf the row an order is about (`wake.ts`'s `rowRefOfOrder`); a parameter, so this module does not import the file that imports it
 * @param live the labels present now, which {@link OrchestratorOneShot.hold} reads for a run that is live
 */
export function standInClaimer(inner: SpawnClaimer | undefined, oneShot: OrchestratorOneShot | undefined, { rowOf, live }: {
  rowOf: (order: { causeKey: string; }) => OneShotRow | null; live: readonly { label: string; }[];
}): SpawnClaimer | { refusal: string } {
  if (inner === undefined || oneShot === undefined) {
    return { refusal: `a one-shot orchestrator run needs the claim and the one-at-a-time guard, and was handed ${inner === undefined ? "no claimer" : "no guard"}` };
  }
  return {
    claim(order, role, env) {
      const row = rowOf(order);
      if (row === null) return { refusal: `a one-shot orchestrator run names no row ("${order.causeKey}"), so there is no row to hold or claim` };
      const held = oneShot.hold(row, role, live);
      if (held !== null) return { refusal: `held: ${held}` };
      oneShot.stand(row, role);
      const claimed = inner.claim(order, role, env);
      if ("refusal" in claimed) oneShot.forget(row, role);
      return claimed;
    },
    release(claimed, role, env) {
      oneShot.forget({ key: claimed.key ?? "", number: claimed.row }, role);
      return inner.release(claimed, role, env);
    },
    ...(inner.tier === undefined ? {} : { tier: inner.tier }),
  };
}
