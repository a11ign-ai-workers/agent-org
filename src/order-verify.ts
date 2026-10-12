// command: order:verify -- is the order I was sent one the gate typed? Checks a wake:<session>:<epoch ms> id against the wake ledger.
import { readFileSync, realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { decisionSwitchesPath, readSwitches, type DecisionUse } from "./decision-provider.ts";
import { HOME_CHECKOUT } from "./project-config.ts";
import { FAILURE_LEDGER_FILE, recordFailures } from "./failure-ledger.ts";
import { stateEntryPath } from "./host-config.ts";
import { processState, printDiagnostic } from "./triage-provider.ts";

/**
 * #5147: AN ORDER THE GATE TYPED INTO A PANE CAN BE CHECKED AGAINST THE GATE'S OWN LEDGER, and a worker that doubts one can ask.
 *
 * The id is the one `wake.ts` types into an order's header, `wake:<session>:<epoch ms>` (`wakeIdOf`), and the ledger line for that
 * delivery carries the same epoch ms and the same recipient (#4068). So verifying is a join on lines the tick already writes: nothing
 * is recorded twice. A ledger line is `<epochMs>\t<causeKey>[\t<recipient>[\tno-clear]]`, or a marker `RESET`, `ESCALATED` or
 * `VOIDED` (`ledgerLine` in `wake.ts`). This module stays off `wake.ts`, which pulls in the whole tick, so its test writes lines with
 * the real `ledgerLine` and reads them here: a change of format breaks that test and not the release.
 *
 * PURE: the ledger's text in, verdicts and repeats out. `repeatedOrdersNow` is the one part that files, and it takes its reads and its
 * writes as arguments; `repeatedOrdersTick` is the gate's entry point and the only place that reads the real switch and ledger.
 */

export type Delivery = { at: number, key: string, session: string | undefined };

export type Verdict =
  | { verified: true, session: string, at: number, causeKey: string }
  | { verified: false, reason: string };

export type RepeatedOrder = { session: string, causeKey: string, deliveredAt: number[] };

const ORDER_ID = /^wake:(.+):(\d+)$/;
const MARKERS = new Set(["RESET", "ESCALATED", "VOIDED"]);

/**
 * The ledger's real deliveries. A marker line is not one, and a delivery a restart VOIDED does not count: a VOIDED line names the
 * delivery it takes back by its causeKey and its own epoch ms (`<epochMs>\tVOIDED\t<causeKey>\t<deliveredAt>`).
 */
export function deliveriesIn(raw: string): Delivery[] {
  const lines = raw.split("\n").filter((line) => /^\d+\t/.test(line)).map((line) => line.split("\t"));
  const voided = new Set(lines.filter((fields) => fields[1] === "VOIDED").map((fields) => `${fields[2]}\t${fields[3]}`));
  return lines
    .filter((fields) => !MARKERS.has(fields[1] ?? "") && !voided.has(`${fields[1]}\t${fields[0]}`))
    .map((fields) => ({ at: Number(fields[0]), key: fields[1] ?? "", session: fields[2] || undefined }));
}

/** Whether `id` is a delivery the gate's ledger records: the same recipient and the same epoch ms. */
export function verifyOrder(raw: string, id: string): Verdict {
  const match = ORDER_ID.exec(id);
  if (match === null) return { verified: false, reason: "not an order id: expected wake:<session>:<epoch ms>" };
  const [, session, at] = match;
  const delivery = deliveriesIn(raw).find((d) => d.session === session && d.at === Number(at));
  if (delivery === undefined) return { verified: false, reason: "no delivery with that id in the wake ledger" };
  return { verified: true, session, at: delivery.at, causeKey: delivery.key };
}

/**
 * An order delivered TWICE to the same holder under the same causeKey, which is an order it ignored. A PR order's causeKey ends in
 * the head it was made for (`<owner>/pr-merge-conflict/<ref>/<head8>`), so an unchanged key IS an unchanged head, and a head that
 * moved takes a new key and is not a repeat. A key with no head is the same order again, which is what the check is for.
 */
export function repeatedOrdersIn(raw: string): RepeatedOrder[] {
  const groups = new Map<string, RepeatedOrder>();
  for (const { at, key, session } of deliveriesIn(raw)) {
    if (session === undefined) continue;
    const group = groups.get(`${session}\t${key}`) ?? { session, causeKey: key, deliveredAt: [] };
    group.deliveredAt.push(at);
    groups.set(`${session}\t${key}`, group);
  }
  return [...groups.values()].filter((group) => group.deliveredAt.length >= 2);
}

/** The decision switch that turns the repeat detector on. Off by default: an absent `.agent-org/decisions.json` turns every use off. */
export const ORDERS_VERIFIABLE_USE: DecisionUse = "orders-verifiable";

/** The failure-ledger class a repeat is filed under: one entry per (holder, causeKey). */
export const ORDER_REPEATED_CLASS = "order-repeated";

export type GateOrder = { session: string, causeKey: string, cause: string, subject: string, prompt: string };

/**
 * The gate's tick for the detector. Each repeat is filed in the failure ledger under its (holder, causeKey) pair, and the first filing
 * wakes `orchestrator` with the order the holder ignored. `recordFailures` skips a pair already logged, so the tick that finds the same
 * repeat again does not wake `orchestrator` again, and a refused filing is not counted as filed.
 */
export function repeatedOrdersNow({ ledgerPath, switches, now, read = (path) => readFileSync(path, "utf8"), record = recordFailures }: {
  ledgerPath: string, switches: Partial<Record<DecisionUse, boolean>>, now: number,
  read?: (path: string) => string, record?: typeof recordFailures,
}): GateOrder[] {
  if (switches[ORDERS_VERIFIABLE_USE] !== true) return [];
  const logPath = join(dirname(ledgerPath), FAILURE_LEDGER_FILE);
  return repeatedOrdersIn(read(ledgerPath)).flatMap(({ session, causeKey, deliveredAt }) => {
    const { skipped } = record({ logPath, events: [{ classKey: ORDER_REPEATED_CLASS, ref: `${session}/${causeKey}` }], now });
    if (skipped > 0) return [];
    return [{
      session: "orchestrator",
      causeKey: `orchestrator/${ORDER_REPEATED_CLASS}/${session}/${causeKey}`,
      cause: ORDER_REPEATED_CLASS,
      subject: session,
      prompt: `${session} was delivered the same order (${causeKey}) ${deliveredAt.length} times and its head did not move, so it ignored it. `
        + "Read its row and the order, then wake it or record why it is not acting on it (`agent-org worker:state blocked <row> <reason>`).",
    }];
  });
}

/** The gate's entry point: the real switch and the real wake ledger, read once per tick. */
export function repeatedOrdersTick(now: number = Date.now()): GateOrder[] {
  const switches = readSwitches(decisionSwitchesPath(HOME_CHECKOUT), { diagnostic: printDiagnostic, state: processState, read: readFileSync });
  return repeatedOrdersNow({ ledgerPath: stateEntryPath("wake-ledger"), switches, now });
}

/** `agent-org order:verify <id>`: exit 0 when the gate's ledger holds that delivery, 1 when it does not, 2 when the ledger cannot be read. */
export function main(argv: string[] = process.argv.slice(2), read: (path: string) => string = (path) => readFileSync(path, "utf8")): number {
  const [id] = argv;
  if (id === undefined) {
    process.stderr.write("usage: agent-org order:verify wake:<session>:<epoch ms>\n");
    return 1;
  }
  const verdict = verifyOrder(read(stateEntryPath("wake-ledger")), id);
  if (!verdict.verified) {
    process.stdout.write(`NOT VERIFIED ${id}: ${verdict.reason}\n`);
    return 1;
  }
  process.stdout.write(`verified ${id}: delivered to ${verdict.session} at ${new Date(verdict.at).toISOString()} under ${verdict.causeKey}\n`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ? realpathSync(process.argv[1]) : "").href) {
  try {
    process.exit(main());
  } catch (err) {
    process.stderr.write(`order:verify failed: ${String((err as Error)?.message ?? err)}\n`);
    process.exit(2);
  }
}
