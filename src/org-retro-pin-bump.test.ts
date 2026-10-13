// no-token: gh -- `org-retro.ts` reaches `gh` only through the `read` seam of `pinBumpRead`, which every test here replaces with a fixture; `buildReport` reads nothing, so nothing imported reaches the real `ghJson`
// The pin/bump line on #928 (agent-org#1245), behind `PIN_BUMP_FLAG`. The flag OFF control is the one the row asks for: a report built with
// the flag off is the report it was, byte for byte, and the flag ON report is that report with the one line added and nothing else.
// The reads are fixtures and the `gh` reader is a seam, so no `gh` runs here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, pinBumpRead, renderReport } from "./org-retro.ts";
import { PIN_BUMP_FLAG, pinBumpFlagOn, pinBumpLine, pinBumpMeasure } from "./pin-bump-measure.ts";
import { emptyCanaryState, machineryFlagOn, parseCanaryState, withMachineryFlag } from "./org-health.ts";

const NOW = Date.parse("2026-10-12T12:00:00Z");
const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(NOW - ms).toISOString();
// Every read the report takes, empty: the report is the same whatever the pin/bump reading is.
const BASE = { merged: [], openPrs: [], journal: "", ledger: "", turns: [], handFixes: null };

test("flag OFF: the report has no pin/bump line, and an absent reading is the same report as a null one", () => {
  const off = renderReport(buildReport(BASE, NOW));
  assert.equal(renderReport(buildReport({ ...BASE, pinBump: null }, NOW)), off, "a null reading is the flag OFF report");
  assert.doesNotMatch(off, /Hand-filed pin or bump rows/);
  assert.doesNotMatch(off, /Renovate PRs across/);
});

test("flag ON: the report is the flag OFF report with the one pin/bump line added, and the line quotes both figures", () => {
  const measure = pinBumpMeasure({
    now: NOW,
    rows: [{ title: "Bump left-pad to 1.3.0", body: "", author: "a11ign", createdAt: ago(DAY) }],
    repos: [{ repo: "a11ign/x", prs: [{ number: 3, author: "app/renovate", createdAt: ago(2 * HOUR) }] }],
  });
  const line = pinBumpLine(measure);
  assert.match(line, /Hand-filed pin or bump rows, last 7 days: 1\./);
  assert.match(line, /a11ign\/x 1 aged \/ 0 red/);
  const off = renderReport(buildReport(BASE, NOW));
  const on = renderReport(buildReport({ ...BASE, pinBump: measure }, NOW));
  assert.ok(on.split("\n").includes(line), "the line is one line of the report");
  assert.deepEqual(on.split("\n").filter((text) => text !== line), off.split("\n"), "nothing else in the report moves");
});

test("a refused read is `unknown` on the line, never 0", () => {
  const measure = pinBumpMeasure({ now: NOW, rows: null, repos: [{ repo: "a11ign/x", prs: null }] });
  const line = pinBumpLine(measure);
  assert.match(line, /Hand-filed pin or bump rows, last 7 days: unknown\./);
  assert.match(line, /a11ign\/x unknown/);
});

test("pinBumpRead reads the home repository's filed rows and each population repository's open PRs, and counts them", () => {
  const calls: string[][] = [];
  const read = (args: string[]) => {
    calls.push(args);
    if (args[0] === "issue") return [{ title: "Pin left-pad to 1.3.0", body: "", author: { login: "a11ign" }, createdAt: ago(DAY) }];
    if (args[3] === "a11ign/x") return [{ number: 3, author: { login: "app/renovate" }, createdAt: ago(2 * HOUR) }];
    return [];
  };
  const measure = pinBumpRead({ now: NOW, read, declaration: { repo: "a11ign/x", dora: [{ repo: "a11ign/y" }] } });
  assert.equal(measure.pinRows, 1);
  assert.deepEqual(measure.repos, [{ repo: "a11ign/x", aged: 1, red: 0 }, { repo: "a11ign/y", aged: 0, red: 0 }]);
  const issues = calls.find((args) => args[0] === "issue");
  assert.ok(issues?.includes("a11ign/x"), "the rows are asked of the home repository");
  assert.ok(!issues?.includes("--search"), "as a plain list, never a search (#5074)");
});

test("pinBumpRead: a list that is refused reads `unknown`, and a filed row that is refused is not a zero", () => {
  const measure = pinBumpRead({ now: NOW, read: () => null, declaration: { repo: "a11ign/x", dora: [] } });
  assert.equal(measure.pinRows, null);
  assert.deepEqual(measure.repos, [{ repo: "a11ign/x", unknown: true }]);
});

test("the flag reads from the canary text exactly as `machineryFlagOn` reads it, and OFF when the file is absent", () => {
  const on = JSON.stringify(withMachineryFlag(emptyCanaryState(), { name: PIN_BUMP_FLAG, on: true }));
  const off = JSON.stringify(withMachineryFlag(emptyCanaryState(), { name: PIN_BUMP_FLAG, on: false }));
  assert.equal(pinBumpFlagOn(null), false, "no file is OFF");
  assert.equal(pinBumpFlagOn(on), true);
  assert.equal(pinBumpFlagOn(off), false);
  for (const text of [on, off]) assert.equal(pinBumpFlagOn(text), machineryFlagOn(parseCanaryState(text), PIN_BUMP_FLAG), "the two readers agree");
});
