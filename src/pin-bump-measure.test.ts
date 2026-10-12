// no-token: pure -- every input is a fixture handed to the measure; nothing here calls `gh` or reads the tracker.
//
// THE POSITIVE CONTROL THE ROW ASKS FOR: a fixture week with ONE hand-filed pin row reads 1, and the same week with none reads 0. A count
// that cannot read 1 cannot be trusted to read 0. The other tests pin what is and is not counted, and that a refused read is `unknown`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { handFiledPinRowCount, pinBumpLine, pinBumpMeasure, renovateCountOf, PIN_BUMP_WINDOW_DAYS, STUCK_RENOVATE_PR_MINUTES } from "./pin-bump-measure.ts";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const row = (title: string, extra: Record<string, unknown> = {}) => ({ title, body: "", author: "product-manager", createdAt: ago(DAY), ...extra });
const failing = (at: number) => [{ name: "ts / run", conclusion: "FAILURE", completedAt: ago(at) }];
const passing = (at: number) => [{ name: "ts / run", conclusion: "SUCCESS", completedAt: ago(at) }];
const pr = (author: string, createdAgo: number, rollup: unknown[] = passing(MINUTE)) => ({ number: 1, author, createdAt: ago(createdAgo), statusCheckRollup: rollup });

test("positive control: a fixture week with one hand-filed pin row reads 1, and with none reads 0", () => {
  assert.equal(handFiledPinRowCount({ now: NOW, rows: [row("Bump the gate to 2.1")] }), 1);
  assert.equal(handFiledPinRowCount({ now: NOW, rows: [row("Add a board column")] }), 0);
  assert.equal(handFiledPinRowCount({ now: NOW, rows: [] }), 0);
});

test("a pin or a bump is matched in the title or the body, and an unrelated row is not", () => {
  for (const title of ["Bump agent-org to 1.4", "re-pin the runner image", "Pin renovate to 39.2.0", "Fix the gate"]) {
    const expected = title !== "Fix the gate" ? 1 : 0;
    assert.equal(handFiledPinRowCount({ now: NOW, rows: [row(title)] }), expected, title);
  }
  assert.equal(handFiledPinRowCount({ now: NOW, rows: [row("Tidy the board", { body: "bump the lockfile" })] }), 1, "a body match counts");
});

test("a bot-authored row is not hand-filed, and a row outside the window is not counted", () => {
  const rows = [row("Bump x to 1", { author: "renovate[bot]" }), row("Bump y to 2", { author: "app/dependabot" }), row("Bump z to 3", { createdAt: ago((PIN_BUMP_WINDOW_DAYS + 1) * DAY) })];
  assert.equal(handFiledPinRowCount({ now: NOW, rows }), 0);
});

test("a row that cannot be dated makes the count unknown, and a refused read is unknown and not 0", () => {
  assert.equal(handFiledPinRowCount({ now: NOW, rows: null }), null);
  assert.equal(handFiledPinRowCount({ now: NOW, rows: [row("Bump x to 1", { createdAt: "not a date" })] }), null);
});

test("an aged Renovate PR with a red last check counts in both figures; a fresh green one counts in neither", () => {
  const prs = [
    pr("app/renovate", 2 * 60 * MINUTE, failing(90 * MINUTE)),
    pr("renovate[bot]", 10 * MINUTE, passing(5 * MINUTE)),
  ];
  assert.deepEqual(renovateCountOf({ now: NOW, repo: "a11ign/agent-org", prs }), { repo: "a11ign/agent-org", aged: 1, red: 1 });
});

test("a PR that is not Renovate's is not counted, whatever its age or colour", () => {
  const prs = [pr("app/dependabot", 5 * DAY, failing(4 * DAY)), pr("a-human", 5 * DAY, failing(4 * DAY))];
  assert.deepEqual(renovateCountOf({ now: NOW, repo: "a11ign/a11ign", prs }), { repo: "a11ign/a11ign", aged: 0, red: 0 });
});

test("the age threshold is strict: a PR exactly at it is not aged, one a minute past it is", () => {
  const at = renovateCountOf({ now: NOW, repo: "r", prs: [pr("app/renovate", STUCK_RENOVATE_PR_MINUTES * MINUTE)] });
  const past = renovateCountOf({ now: NOW, repo: "r", prs: [pr("app/renovate", (STUCK_RENOVATE_PR_MINUTES + 1) * MINUTE)] });
  assert.deepEqual(at, { repo: "r", aged: 0, red: 0 });
  assert.deepEqual(past, { repo: "r", aged: 1, red: 0 });
});

test("a repository whose PRs were refused is unknown, and a Renovate PR with no readable age makes its repository unknown", () => {
  assert.deepEqual(renovateCountOf({ now: NOW, repo: "a11ign/a11ign", prs: null }), { repo: "a11ign/a11ign", unknown: true });
  assert.deepEqual(renovateCountOf({ now: NOW, repo: "r", prs: [{ ...pr("app/renovate", MINUTE), createdAt: "nope" }] }), { repo: "r", unknown: true });
});

test("the daily line carries both figures, the repository count, unknown where a read was refused, and the named thresholds", () => {
  const measure = pinBumpMeasure({
    now: NOW,
    rows: [row("Bump the gate to 2.1")],
    repos: [
      { repo: "a11ign/agent-org", prs: [pr("app/renovate", 2 * 60 * MINUTE, failing(90 * MINUTE))] },
      { repo: "a11ign/a11ign", prs: null },
    ],
  });
  const line = pinBumpLine(measure);
  assert.match(line, /rows, last 7 days: 1\./);
  assert.match(line, /across 2 repositories/);
  assert.match(line, /a11ign\/agent-org 1 aged \/ 1 red/);
  assert.match(line, /a11ign\/a11ign unknown/);
  assert.match(line, /over 60 min/);
});

test("with the rows refused the line says unknown for the pin figure and does not say 0", () => {
  const line = pinBumpLine(pinBumpMeasure({ now: NOW, rows: null, repos: [] }));
  assert.match(line, /rows, last 7 days: unknown\./);
  assert.doesNotMatch(line, /: 0\./);
});
