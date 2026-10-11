// @ts-check
// module: an option a merged pull request declared as a consumer's to set, and the consumer never set, is a LEDGER INCIDENT two hours after the merge
// (agent-org#839, class `closed-on-merge-not-outcome`, a11ign/a11ign#4953 ask 2)
//
// agent-org#782 added `routing.question`; a11ign routed by `traits` for seven hours (76 routes) and nobody was told until the chairman read a decision line. The refusal
// (`closes-mismatch-check.ts`, agent-org#873) stops a CLOSE while the consumer lacks the value; THIS is the detector for when it was not in force or was passed with
// `Closes: none`. It reads the grammar through `consumer-declaration.ts`'s parser and never re-parses the acceptance text or reads prose.
//
// PURE: merged pull requests (each with the text of the acceptance file it ADDED), a reader for the consumer's file and the clock in; incidents and ledger events out. The live read
// is `org-retro.ts`'s `readInertOptions`, which wires the reader to `lookupConsumerFile`.
//
// THREE STATES, NEVER TWO: a key that holds the value (no incident), a key that is absent or holds another value (an INCIDENT once the clock is past), and a file or key that could not be
// READ (UNKNOWN: not an incident, not "present", and said so). Absence of a reading is not a finding.
import { parseConsumerDeclarations, valueAtKey, valueMatches } from "./consumer-declaration.ts";
import type { FailureEvent } from "./failure-ledger.ts";

const MINUTE_MS = 60_000;

/** The ledger kind: an EXISTING class of a11ign's `.agent-org/failure-classes.json`, so this names no class of its own. */
export const CLOSED_ON_MERGE_NOT_OUTCOME = "closed-on-merge-not-outcome";

/** How long a consumer has to set a declared option after the merge before it is an incident: the chairman's figure (agent-org#839), not a derived one. */
export const INERT_OPTION_MINUTES = 120;
export const INERT_OPTION_MS = INERT_OPTION_MINUTES * MINUTE_MS;

/** A merged pull request of `repo` with the acceptance text it added (`null`: it could not be read, which is unknown and never "no declaration"). `body` is read only for the switch row. */
export type MergedOptionPr = { repo: string, number: number, mergedAt?: string | null, acceptanceText: string | null, body?: string | null };

/** What the consumer's file holds at the key: `absent`, or `holds` with the value it wrote. */
export type FoundValue = { state: "absent" } | { state: "holds", value: unknown };

export type InertOptionIncident = {
  ref: string, pr: { repo: string, number: number }, consumer: string, path: string, key: string, wanted: string, found: FoundValue,
  openMinutes: number, switchRow: string | null,
};
export type InertOptionUnknown = { ref: string, reason: string };
export type InertOptionReading = { incidents: InertOptionIncident[], unknown: InertOptionUnknown[] };

/** The file's text, or `null` when it could not be READ (missing, unreadable, the call failed). Injected: the live one is a gh call, and a test's is a table. */
export type ConsumerFileReader = (repo: string, path: string) => string | null;

const NAMED_ROW = /(?:[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)?#\d+/;

/** The row the pull request's `Closes: none -- <reason>` names as the consumer's switch row, or `null`. A row in prose elsewhere in the body is not read. */
function switchRowOf(body: string | null | undefined): string | null {
  const line = (body ?? "").split(/\r?\n/).find((text) => /^\s*Closes:\s*none\b/i.test(text));
  return line === undefined ? null : NAMED_ROW.exec(line)?.[0] ?? null;
}

/**
 * Every declared option of every merged pull request, read once per distinct consumer file.
 * INCIDENT: past `INERT_OPTION_MINUTES` of `mergedAt` (exactly at it is not), the key absent or holding another value, and the ref not in `recorded`. The ref is
 * `<repo>#<pr>:<key>`, so a second pull request on the same key is a second incident and one pull request's key is one.
 * UNKNOWN: the acceptance text, the consumer's file or its JSON could not be read, or `mergedAt` does not parse. Neither an incident nor a pass.
 * A key already satisfied is reported as nothing at all.
 * @param {{ mergedPrs: MergedOptionPr[], readConsumerFile: ConsumerFileReader, now: number, recorded?: Iterable<string> }} input
 * @returns {InertOptionReading}
 */
export function inertOptionIncidents({ mergedPrs, readConsumerFile, now, recorded = [] }: {
  mergedPrs: MergedOptionPr[], readConsumerFile: ConsumerFileReader, now: number, recorded?: Iterable<string>,
}): InertOptionReading {
  const already = new Set(recorded);
  const files = new Map<string, unknown | Error | null>();
  const fileJson = (repo: string, path: string): unknown | Error | null => {
    const id = `${repo}:${path}`;
    if (!files.has(id)) {
      const text = readConsumerFile(repo, path);
      let parsed: unknown | Error | null = null;
      if (text !== null) { try { parsed = JSON.parse(text); } catch (err) { parsed = err instanceof Error ? err : new Error(String(err)); } }
      files.set(id, parsed);
    }
    return files.get(id) as unknown | Error | null;
  };
  const result: InertOptionReading = { incidents: [], unknown: [] };
  for (const pr of mergedPrs) {
    const where = `${pr.repo}#${pr.number}`;
    if (pr.acceptanceText === null) {
      result.unknown.push({ ref: where, reason: "the acceptance file this pull request added could not be read" });
      continue;
    }
    const { declarations } = parseConsumerDeclarations(pr.acceptanceText);
    if (declarations.length === 0) continue;
    const mergedAt = Date.parse(pr.mergedAt ?? "");
    for (const wanted of declarations) {
      const ref = `${where}:${wanted.key}`;
      if (already.has(ref)) continue;
      if (!Number.isFinite(mergedAt)) { result.unknown.push({ ref, reason: "the merge time is absent or does not parse" }); continue; }
      if (now - mergedAt <= INERT_OPTION_MS) continue;
      const json = fileJson(wanted.repo, wanted.path);
      if (json === null) { result.unknown.push({ ref, reason: `${wanted.repo}:${wanted.path} could not be read` }); continue; }
      if (json instanceof Error) { result.unknown.push({ ref, reason: `${wanted.repo}:${wanted.path} is not JSON` }); continue; }
      const got = valueAtKey(json, wanted.key);
      if (got.found && valueMatches(got.value, wanted.value)) continue;
      result.incidents.push({
        ref, pr: { repo: pr.repo, number: pr.number }, consumer: wanted.repo, path: wanted.path, key: wanted.key, wanted: wanted.value,
        found: got.found ? { state: "holds", value: got.value } : { state: "absent" },
        openMinutes: Math.floor((now - mergedAt) / MINUTE_MS), switchRow: switchRowOf(pr.body),
      });
    }
  }
  return result;
}

/** The ledger events: one per incident. `recordFailures` skips a (kind, ref) already logged, so the ref is what makes one episode one line. */
export function inertOptionEvents(incidents: InertOptionIncident[]): FailureEvent[] {
  return incidents.map(({ ref }) => ({ classKey: CLOSED_ON_MERGE_NOT_OUTCOME, ref }));
}

const FIRST_REFS = 3;

/** What the daily pass prints: counts and the first refs. `null` is a population nobody could read (`unknown`, never 0). */
export function inertOptionSummary(reading: InertOptionReading | null | undefined): { count: number, unknown: number, first: string[], details: string[] } | null {
  if (reading === null || reading === undefined) return null;
  const foundText = (found: FoundValue) => (found.state === "absent" ? "absent" : `holds ${JSON.stringify(found.value)}`);
  const details = reading.incidents.slice(0, FIRST_REFS).map((i) => {
    const fix = i.switchRow === null ? "file the consumer's switch row" : `the consumer's switch row is ${i.switchRow}`;
    return `${i.ref}: ${i.consumer}:${i.path} \`${i.key}\` must be \`${i.wanted}\`, ${foundText(i.found)}, ${i.openMinutes} minutes after the merge; ${fix}`;
  });
  return { count: reading.incidents.length, unknown: reading.unknown.length, first: reading.incidents.slice(0, FIRST_REFS).map(({ ref }) => ref), details };
}
