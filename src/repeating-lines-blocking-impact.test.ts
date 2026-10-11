// no-token: gh -- no gh and no journalctl here: the lines come from blocking-impact.ts's own formatter, the allowlist is read from disk, and the ticks are text
/**
 * `repeating-lines.allowlist.json`, agent-org#818: THE BLOCKING-IMPACT READOUT BELOW ITS INCIDENT THRESHOLD IS NOT A REPEATING FAULT.
 *
 * Measured 2026-10-11T01:43Z in the tick journal: `blocking-impact: worker-agent-org-741 shelves 2 rows: #742 #792` repeated for 59 ticks while its
 * pull request waited in review, and was offered to `orchestrator` three times in an hour. The line is the readout `blocking-impact.ts` prints
 * for every holder every tick. The FAULT form of the same count is its own incident at `BLOCKING_MIN_ROWS` (5) for `BLOCKING_MIN_MINUTES` (30):
 * the line gains `(episode open)` and is recorded in the failure ledger. So the below-threshold form is allowlisted, and the episode form is not.
 *
 * THE LINES ARE THE FORMATTER'S OWN OUTPUT (`holdingLines`), so a change to the wording fails here rather than silently stopping the match.
 * The keyed form is a literal: `holdingLines` prints numbers only (`#N`), and the keyed spelling is the one the SHELVED entry also covers (a11ign#4617).
 *
 * THE CONTROLS GO BOTH WAYS: the below-threshold forms ARE offered at 40 ticks with an empty allowlist (so "not offered" below could not pass on a
 * fixture that never repeated), and the episode form and a line with no row list are still offered with the shipped one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { holdingLines, type Episode, type Holding } from "./blocking-impact.ts";
import { loadAllowlist, normaliseLine, parseTicks, repeatingLines } from "./repeating-lines.ts";

const TICKS = 40;
const TICK_MINUTES = 2;
const pad = (n: number) => String(n).padStart(2, "0");
const at = (i: number) => `2026-10-11T${pad(Math.floor((i * TICK_MINUTES) / 60))}:${pad((i * TICK_MINUTES) % 60)}:00+00:00`;
const row = (i: number, unit: string, message: string) => `${at(i)} agents ${unit}[1]: ${message}`;

/** `TICKS` complete ticks each printing `line`, as `journalctl -o short-iso` would. */
function ticksOf(line: string) {
  return parseTicks(Array.from({ length: TICKS }, (_, i) => [
    row(i, "systemd", "Starting a11ign-work-tick.service - a11ign: ask work-gate whether there is work..."),
    row(i, "node", line),
    row(i, "systemd", "Finished a11ign-work-tick.service - a11ign: ask work-gate whether there is work."),
  ].join("\n")).join("\n"));
}

/** The line `holdingLines` prints for one holder, with its episode open when `open`. */
function readoutOf(holder: string, rows: number[], heldRows: number[] = [], open = false): string {
  const holdings = new Map<string, Holding>([[holder, { rows, heldRows }]]);
  const episodes: Record<string, Episode> = open ? { [holder]: { since: 0, rows, heldRows, fired: true } } : {};
  const [line] = holdingLines(holdings, { episodes, unattributed: 0 });
  return line;
}

const UNKEYED = readoutOf("worker-agent-org-741", [742, 792]);
const BEHIND = readoutOf("worker-4899", [752, 796], [4899]);
const BEHIND_SEVERAL = readoutOf("worker-4899", [752, 796], [4899, 4900]);
const KEYED = "blocking-impact: worker-agent-org-741 shelves 2 rows: agent-org#742 agent-org#792";
const KEYED_BEHIND = "blocking-impact: worker-4899 shelves 2 rows behind agent-org#4899: agent-org#752 agent-org#796";
const EPISODE = readoutOf("worker-agent-org-741", [742, 792, 800, 801, 802], [], true);
const EPISODE_BELOW = readoutOf("worker-agent-org-741", [742, 792], [], true);
const NO_LIST = "blocking-impact: worker-agent-org-741 shelves 2 rows:";
const UNATTRIBUTED = "blocking-impact: 2 B4 shelvings name a row or pull request nobody is known to hold";

test("UNKEYED, KEYED and BEHIND readouts below the threshold are allowed by the SHIPPED allowlist", () => {
  const allow = loadAllowlist();
  const allowed = (line: string) => allow.some((a) => a.pattern.test(normaliseLine(line)));
  assert.match(UNKEYED, /^blocking-impact: worker-agent-org-741 shelves 2 rows: #742 #792$/, "the formatter's own line, for the measured holder");
  assert.ok(allowed(UNKEYED), "the unkeyed form");
  assert.ok(allowed(BEHIND), "the `behind` form, one held row");
  assert.ok(allowed(BEHIND_SEVERAL), "the `behind` form, several held rows");
  assert.ok(allowed(KEYED), "the keyed form, a row in a keyed repository");
  assert.ok(allowed(KEYED_BEHIND), "the keyed form with `behind`");
});

test("the SHIPPED allowlist does NOT allow the episode form, a line with no row list, or the unattributed line", () => {
  const allow = loadAllowlist();
  const allowed = (line: string) => allow.some((a) => a.pattern.test(normaliseLine(line)));
  assert.match(EPISODE, /\(episode open\)$/, "the formatter's own episode line, at 5 rows");
  assert.ok(!allowed(EPISODE), "the episode form is an incident and is not allowlisted");
  assert.ok(!allowed(EPISODE_BELOW), "an open episode is not allowed even at a count below 5");
  assert.ok(!allowed(NO_LIST), "`shelves N rows` with no row list is a different line");
  assert.ok(!allowed(UNATTRIBUTED), "the unattributed line is a different line");
});

test("40 ticks of the below-threshold readout are offered with an empty allowlist and not with the shipped one", () => {
  for (const line of [UNKEYED, BEHIND, KEYED, KEYED_BEHIND]) {
    assert.equal(repeatingLines({ ticks: ticksOf(line), allow: [] }).length, 1, `control: offered without the entry: ${line}`);
    assert.deepEqual(repeatingLines({ ticks: ticksOf(line), allow: loadAllowlist() }), [], `not offered with the entry: ${line}`);
  }
});

test("40 ticks of the episode form and of the no-list line are still offered with the shipped allowlist", () => {
  for (const line of [EPISODE, NO_LIST]) {
    assert.equal(repeatingLines({ ticks: ticksOf(line), allow: loadAllowlist() }).length, 1, `still offered: ${line}`);
  }
});
