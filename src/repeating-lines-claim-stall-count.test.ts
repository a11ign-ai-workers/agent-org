// no-token: gh -- no gh, herdr or git is run; the rows, comments and agents are fixtures, the tick's memory is an object, and the lines come from claim-stall-tick.ts's own formatter
/**
 * `repeating-lines.allowlist.json`, agent-org#941: THE CLAIM-STALL COUNT LINE IS A POSITION READING, NOT A FAULT.
 *
 * Measured 2026-10-11T10:23Z in the tick journal: `claim-stall: tracker \`agent-org\` (a11ign/agent-org): N claimed rows, N evaluated.` is printed
 * once per keyed tracker per tick while that tracker holds a claimed row, and was offered to `orchestrator` as a repeating fault after 30 ticks. The
 * count changes with the rows (3 to 11 over three hours) but `normaliseLine` turns every number to `N`, so the line is one line to the detector.
 *
 * THE LINES ARE THE FORMATTER'S OWN OUTPUT: they come from `claimStallTick` with a fake `log`, so a change to the wording fails here rather than
 * silently stopping the match. The faulting forms are produced the same way, where the formatter can reach them, and each must still be offered.
 *
 * THE CONTROLS GO BOTH WAYS: the count line IS offered at 40 ticks with an empty allowlist (so "not offered" below could not pass on a fixture that
 * never repeated), and each faulting form is still offered with the shipped one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { claimStallTick, type TrackerClaims } from "./work-gate/claim-stall-tick.ts";
import { claimRecordComment } from "./row-claim.ts";
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

const T0 = Date.parse("2026-10-11T09:00:00Z");
const MIN = 60_000;
const AGENT_ORG = { key: "agent-org", repo: "a11ign/agent-org" };
const noGit = { git: () => ({ status: 0, out: "" }), exists: () => false, mtime: () => null };
const ALL_IDLE = [{ label: "ceo", status: "done" }, { label: "orchestrator", status: "done" }];

/** A claimed row, young, with its claim record exactly as `row-claim.ts` writes it. */
const claimed = (number: number, session: string) => ({ number, comments: [{
  body: claimRecordComment({ session, branch: `agent/x-${number}`, worktree: `../wt-${number}` }),
  createdAt: new Date(T0 - 20 * MIN).toISOString(), author: { login: "a11ign-ai-workers" } }] });
const rowOf = (number: number, session: string) => ({ number, title: `row ${number}`, body: "", blockedBy: { nodes: [] },
  labels: [{ name: "in-progress" }, { name: `session:${session}` }, { name: "started" }] });

/** `n` claimed rows of `AGENT_ORG`, each held by its own worker, as the second tracker's pass reads them. */
function trackerWith(n: number): TrackerClaims {
  const sessions = Array.from({ length: n }, (_, i) => `worker-agent-org-${941 + i}`);
  return { ...AGENT_ORG, rows: sessions.map((s, i) => rowOf(941 + i, s)), claimedComments: sessions.map((s, i) => claimed(941 + i, s)) };
}

/** Every line one tick of the pass prints, with the newline the formatter ends each with taken off. */
function linesOf({ trackers = [], home = { rows: [], comments: [] as object[] | null }, agents = ALL_IDLE }: {
  trackers?: TrackerClaims[]; home?: { rows: object[]; comments: object[] | null }; agents?: { label: string; status: string; }[];
}): string[] {
  const log: string[] = [];
  claimStallTick({ rows: home.rows, claimedComments: home.comments, openPrs: [], mergedPrs: null, io: noGit, repo: "/repo", now: T0,
    restartAt: null, agents, agentSessions: null, stateDir: "/state", ledger: () => "", log: (line: string) => log.push(line), trackers,
    read: () => ({}), write: () => {} } as never);
  return log.map((line) => line.replace(/\n$/, ""));
}

const shipped = () => loadAllowlist();
const allowedBy = (allow: ReturnType<typeof loadAllowlist>, line: string) => allow.some((a) => a.pattern.test(normaliseLine(line)));

const COUNT_3 = linesOf({ trackers: [trackerWith(3)] }).find((l) => l.startsWith("claim-stall: tracker "));
const COUNT_11 = linesOf({ trackers: [trackerWith(11)] }).find((l) => l.startsWith("claim-stall: tracker "));

// The faulting forms, each from the formatter, and each in the shape the row names.
const UNREAD_OPEN = linesOf({ trackers: [{ ...AGENT_ORG, rows: null, claimedComments: null }] }).find((l) => l.includes("UNREAD"));
const UNREAD_COMMENTS = linesOf({ trackers: [{ ...AGENT_ORG, rows: trackerWith(2).rows, claimedComments: null }] }).find((l) => l.includes("UNREAD"));
const HOME_NO_COMMENTS = linesOf({ home: { rows: trackerWith(2).rows ?? [], comments: null } }).find((l) => l.includes("NO claim was evaluated"));
const NO_CLAIM_RECORD = linesOf({ trackers: [{ ...AGENT_ORG, rows: [rowOf(941, "worker-agent-org-941")], claimedComments: [] }] })
  .find((l) => l.includes("not evaluated"));

/** The formatter's catch line, reached by a `read` seam that throws: the one way to drive `claimStallTick`'s own catch from here. */
const COULD_NOT_RUN = (() => {
  const log: string[] = [];
  claimStallTick({ rows: [], claimedComments: [], openPrs: [], mergedPrs: null, io: noGit, repo: "/repo", now: T0, restartAt: null,
    agents: ALL_IDLE, agentSessions: null, stateDir: "/state", ledger: () => "", log: (line: string) => log.push(line), trackers: [trackerWith(1)],
    read: () => { throw new Error("boom"); }, write: () => {} } as never);
  return log.map((line) => line.replace(/\n$/, "")).find((l) => l.startsWith("claim-stall: could not run"));
})();

test("the count line is the formatter's own line for 3 and for 11 claimed rows, and both normalise to one line", () => {
  assert.equal(COUNT_3, "claim-stall: tracker `agent-org` (a11ign/agent-org): 3 claimed rows, 3 evaluated.", "the formatter's own line");
  assert.equal(COUNT_11, "claim-stall: tracker `agent-org` (a11ign/agent-org): 11 claimed rows, 11 evaluated.", "the same line at the measured top count");
  assert.equal(normaliseLine(COUNT_3 ?? ""), normaliseLine(COUNT_11 ?? ""), "one line to the detector");
});

test("the SHIPPED allowlist allows the count line at 3 and at 11 claimed rows", () => {
  assert.ok(allowedBy(shipped(), COUNT_3 ?? ""), "3 rows");
  assert.ok(allowedBy(shipped(), COUNT_11 ?? ""), "11 rows");
});

test("40 ticks of the count line are offered with an empty allowlist and not with the shipped one", () => {
  for (const line of [COUNT_3, COUNT_11]) {
    assert.equal(repeatingLines({ ticks: ticksOf(line ?? ""), allow: [] }).length, 1, `control: offered without the entry: ${line}`);
    assert.deepEqual(repeatingLines({ ticks: ticksOf(line ?? ""), allow: shipped() }), [], `not offered with the entry: ${line}`);
  }
});

test("the faulting forms are NOT allowed by the shipped allowlist, and 40 ticks of each are still offered", () => {
  const faulting: [string, string | undefined][] = [
    ["UNREAD open rows", UNREAD_OPEN],
    ["UNREAD comments", UNREAD_COMMENTS],
    ["home comments unreadable", HOME_NO_COMMENTS],
    ["row with no claim record", NO_CLAIM_RECORD],
    ["could not run", COULD_NOT_RUN],
  ];
  for (const [what, line] of faulting) {
    assert.ok(line !== undefined && line !== "", `the formatter prints a ${what} line`);
    assert.match(line ?? "", /^claim-stall: /, `${what} is a claim-stall line`);
    assert.ok(!allowedBy(shipped(), line ?? ""), `${what} is not allowlisted: ${line}`);
    assert.equal(repeatingLines({ ticks: ticksOf(line ?? ""), allow: shipped() }).length, 1, `${what} is still offered`);
  }
});
