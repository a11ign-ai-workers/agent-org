// no-token: none -- pure string reading and writing; no tracker, process or import beyond this file.
// agent-org#908: the verdict comment's writer and reader, in a LEAF module. `row-call-count-orders.ts` imports `work-gate.ts`, which reaches `wake.ts`;
// a decision class (`decision-run/classes/`) is imported by `loadClasses` from inside the tick, and one that imported that chain waited on `wake.ts`
// from within `wake.ts`'s own top-level await (the tick never settled). A class takes these from here.

/** The comment `product-manager` posts to record a "not split" verdict, carrying the call count it was
 * made at -- `CLAIM_RECORD_MARKER`'s shape, a structured marker rather than prose, because nothing
 * re-parses every comment on every tick to recover a number written in English. */
export const ROW_CALL_COUNT_ASSESSED_MARKER = "<!-- row-call-count-signal: split assessment -->";
const ASSESSED_CALLS = /\bcalls=(\d+)\b/;

/**
 * The call count `product-manager` last assessed this row at, from the newest comment carrying
 * `ROW_CALL_COUNT_ASSESSED_MARKER` -- `null` for no such comment, or one whose count cannot be read
 * (`claimRecordOf`'s own rule: an assessment that cannot be read is never guessed at, so it signals again
 * rather than staying silent).
 * @param {any[]} comments
 * @returns {number | null}
 */
export function rowCallCountAssessedCalls(comments: any[]): number | null {
  const newest = comments.filter((c) => String(c?.body ?? "").includes(ROW_CALL_COUNT_ASSESSED_MARKER)).at(-1);
  if (newest === undefined) return null;
  const match = ASSESSED_CALLS.exec(String(newest.body));
  if (match === null) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * The body of the verdict comment `product-manager` posts on a row-call-count signal (#2762): the WRITER the
 * marker and `rowCallCountAssessedCalls` were specified without, so the marker and `calls=N` were typed by
 * hand and a hand-typed verdict with neither left the doubling guard nothing to compare against.
 *
 * `calls=N` comes straight after the marker and BEFORE the free-text note: `ASSESSED_CALLS` takes the first
 * match, so a note that happens to quote another `calls=` figure cannot displace the real one. A count that
 * is not a non-negative integer throws rather than posting a comment the reader would read back as `null`.
 * @param {{ calls: number, split: boolean, note?: string }} verdict `calls` is the figure named in the signal's prompt
 * @returns {string}
 */
export function formatRowCallCountAssessment({ calls, split, note = "" }: { calls: number; split: boolean; note?: string; }): string {
  if (!Number.isInteger(calls) || calls < 0) throw new RangeError(`calls must be a non-negative integer, got ${calls}`);
  const head = `${ROW_CALL_COUNT_ASSESSED_MARKER}\ncalls=${calls}\n${split ? "Split" : "One unit, not split"}.`;
  return note.trim() === "" ? head : `${head} ${note.trim()}`;
}
