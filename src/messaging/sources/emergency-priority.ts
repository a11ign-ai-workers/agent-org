// THE EMERGENCY-PRIORITY SOURCE (a11ign/a11ign#5032, change 4 of the chairman's ruling of 2026-10-11): each time the gate HONOURS `priority:emergency` the chairman is told, once, with the
// row, the incident and `ceo`'s one-line reason.
//
// **THE GATE DECIDES AND THIS ONLY TELLS.** Whether a label counts is the gate's verdict (setter, open org-blocking incident), written as one `emergency-priority-used` line per row and
// incident in the failure ledger; this reads those lines and nothing else decides here, so a use the gate refused is never announced and an announcement cannot outrun the verdict.
// `emergency-priority-used:<repo>#<row>:<incident>` is told once: the key is the row and incident, so a tick that re-reads the same line sends nothing (the core dedupes by key), and
// a use that came back after a refused send is offered again, which is the safe way to be wrong.
//
// A line older than a day is history, not news: a messaging ledger that was emptied must not re-announce a week of uses.
//
// A LEAF and INJECTED, as `milestones.ts` is: it imports siblings and node's own, and reads only through the two readers it is handed. A row that cannot be read is `cannot-ask`,
// never an announcement without the reason and never silence.

import { EMERGENCY_PRIORITY_USED_KIND, parseFailureLedger } from "../../failure-ledger.ts";
import { observe } from "./stall.ts";

export const EMERGENCY_PRIORITY_KEY_PREFIX = "watch:emergency-priority:";
const A_DAY_MS = 24 * 60 * 60_000;
const USED_REF = /^(?<repo>[\w.-]+\/[\w.-]+)#(?<number>\d+):(?<incident>.+)$/;
const REASON_LINE = /^Emergency-reason:[ \t]*(\S.*?)[ \t]*$/m;

export type EmergencyUse = { repo: string; number: number; incident: string; at: number; };

/** The uses the failure ledger holds, oldest first. A line of another class, and a ref this does not recognise, is not a use. */
export function usesIn(ledgerText: string): EmergencyUse[] {
  return parseFailureLedger(ledgerText).filter((entry) => entry.classKey === EMERGENCY_PRIORITY_USED_KIND).flatMap(({ ref, at }) => {
    const found = USED_REF.exec(ref)?.groups;
    return found === undefined ? [] : [{ repo: found.repo, number: Number(found.number), incident: found.incident, at }];
  }).sort((a, b) => a.at - b.at);
}

/** `ceo`'s one line, or the sentence that says there was none: the chairman is told the label was used either way. */
const reasonOf = (body: string): string => REASON_LINE.exec(body)?.[1] ?? "none given on the row";

/**
 * One event per use in the last day. `readLedger` returns the failure ledger's text (`null` when the file is absent: nothing was ever used); `readRow` the row as the tracker gives it,
 * whose `body` carries the reason. Neither is asked for a use that is already past the day.
 */
export async function observeEmergencyUses({ readLedger, readRow, now, log = () => {} }: {
  readLedger: () => string | null; readRow: (query: { repo: string; number: number; }) => Promise<Record<string, any>> | Record<string, any>; now: () => number; log?: (line: string) => void;
}): Promise<{ events: Record<string, unknown>[]; cannotAsk: { source: string; reason: string; }[]; }> {
  const ledger = await observe("emergency-priority", () => {
    const text = readLedger();
    return text === null ? [] : usesIn(text).filter(({ at }) => now() - at < A_DAY_MS).map((use) => ({ ...use }));
  }, log);
  const parts = await Promise.all((ledger.events as unknown as EmergencyUse[]).map((use) => observe(
    `${EMERGENCY_PRIORITY_KEY_PREFIX}${use.repo}#${use.number}`,
    async () => {
      const row = await readRow({ repo: use.repo, number: use.number });
      return [{
        key: `${EMERGENCY_PRIORITY_KEY_PREFIX}${use.repo}#${use.number}:${use.incident}`, kind: "watch", severity: "warning", firstSeenAt: use.at,
        text: `Emergency priority used on ${use.repo}#${use.number}: it is ordered ahead of every other row, the chairman's included, while ${use.incident} is open. ceo's reason: ${reasonOf(String(row?.body ?? ""))}`,
        links: [`https://github.com/${use.repo}/issues/${use.number}`], resolved: false, state: "used",
      }];
    },
    log,
  )));
  return { events: parts.flatMap((part) => part.events), cannotAsk: [...ledger.cannotAsk, ...parts.flatMap((part) => part.cannotAsk)] };
}
