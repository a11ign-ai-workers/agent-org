// a11ign/a11ign#5043, agent-org#1093: THE GATE'S SIDE OF THE DUE-INDEX (`due-index.ts` says what the file is). One repository's open rows become the instants
// their dated waits come due, and `writeDueIndex` replaces that repository's entries with them.
//
// `readOpenRows` (`reads.ts`) calls `recordDueInstants` on the rows it has just read, in `webhook` mode only; `poll` writes no index.
import { type DueEntry, writeDueIndex } from "../due-index.ts";
import { BACKLOG_LABEL } from "../project-vocabulary.ts";
import { fleetHoldUntil, notBeforeDate } from "../waiting-condition.ts";
import { AGED_BACKLOG_MS } from "./causes/rows-backlog.ts";
import { labelsOf } from "./vocabulary.ts";

/**
 * Each dated wait a row carries, as the instant it comes due. `Not-before:` and `Fleet-hold-until:` come due at the date they name; a backlog row comes
 * due once it is OLDER than `AGED_BACKLOG_MS`, which `rows-backlog.ts` compares strictly, so the instant is one millisecond past that. A row with no
 * parsable date contributes nothing: there is no instant to wait for.
 */
export function dueEntriesOf(rows: any[]): DueEntry[] {
  return rows.flatMap((row): DueEntry[] => {
    const number = Number(row?.number);
    if (!Number.isInteger(number)) return [];
    const entries: DueEntry[] = [];
    const notBefore = Date.parse(notBeforeDate(row.body) ?? "");
    if (Number.isFinite(notBefore)) entries.push({ number, dueAtMs: notBefore, kind: "not-before" });
    const fleetHold = Date.parse(fleetHoldUntil(row.body) ?? "");
    if (Number.isFinite(fleetHold)) entries.push({ number, dueAtMs: fleetHold, kind: "fleet-hold-until" });
    const createdAt = Date.parse(row.createdAt);
    if (labelsOf(row).includes(BACKLOG_LABEL) && Number.isFinite(createdAt)) entries.push({ number, dueAtMs: createdAt + AGED_BACKLOG_MS + 1, kind: "aged-backlog" });
    return entries;
  });
}

/** Writes `repo`'s due instants from its open rows, replacing what an earlier pass wrote for it. Other repositories' entries are kept. */
export function recordDueInstants({ path, repo, rows }: { path: string; repo: string; rows: any[]; }): void {
  writeDueIndex({ path, repo, entries: dueEntriesOf(rows) });
}
