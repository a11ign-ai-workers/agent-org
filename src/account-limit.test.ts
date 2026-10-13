// no-token: gh -- pure: the account's pause over in-memory records, `claimStalledOrders` over a fixture reading, and `deliver` against a recording herdr; nothing reaches `gh`, `git` or a Claude process
/**
 * agent-org#1307: WHEN THE CLAUDE ALLOWANCE IS SPENT, NO CLAUDE SEAT IS STARTED, PROMPTED OR CLAIMED FOR, AND CODEX REVIEWS GO ON.
 *
 * DRIVEN THROUGH `deliver`, the production entry, with the pause as an argument (`accountPause`) and a herdr that records every start. The first test
 * is the control in both directions: the same tick with the pause off starts the engineer, and with the pause on it starts only the Codex reviewer.
 * `claimStalledOrders` is driven with a release reading, so a claimed row is not released while the account is limited.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ACCOUNT_LIMIT_FLAG, nextLimit, pausedNow, readAccountLimits, writeAccountLimits, ACCOUNT_LIMIT_FILE, type AccountLimit } from "./account-limit.ts";
import { claimStalledOrders } from "./claim-stall.ts";
import { deliver as settlingDeliver } from "./wake.ts";
import { startedPanes } from "./packaging/started-pane.ts";
import { emptyCanaryState, withMachineryFlag, type CanaryState } from "./org-health.ts";

/** A test that is not ABOUT the clear's five-second settle does not wait it. */
const noSettle = () => {};
const deliver: typeof settlingDeliver = (orders, agents, roster, deps) => settlingDeliver(orders, agents, roster, { ...deps, sleep: noSettle });

const NOW = Date.parse("2026-10-13T09:00:00Z");
const RESET = Date.parse("2026-10-13T11:00:00Z");
const LIMIT: AccountLimit = { limitedUntil: RESET, seenOn: "ceo", text: "You've hit your session limit · resets 11am (UTC)" };

const agents = (spec: Record<string, string>) => Object.entries(spec).map(([label, status]) => ({ label, status }));
const checkout = {
  git: (_c: string, a: string[]) => (a.join(" ").includes("rev-parse") ? `${"d".repeat(40)}\n` : ""),
  link: () => null, exists: () => true, root: "/reviews-root", repoRoot: "/primary",
};

const engineerOrder = { session: "engineers", cause: "ready-row-unclaimed", causeKey: "engineers/ready-row-unclaimed/2131", prompt: "Ready row #2131 is unclaimed." };
const decisionOrder = { session: "ceo", cause: "state-reading", causeKey: "ceo/state-reading/1", prompt: "Decide the open question." };
const reviewOrder = { session: "reviewer-18", cause: "draft-awaiting-verdict", causeKey: "reviewer-18/draft-awaiting-verdict/pr-18/abc12345", prompt: "Draft #18 is green with no verdict at its head." };

/** A herdr that opens a workspace and starts whatever it is asked to, recording every call. */
function recordingHerdr() {
  const calls: string[] = [];
  const pane = startedPanes();
  const run = (args: string[]) => {
    calls.push(args.join(" "));
    const answered = pane(args);
    if (answered !== null) return answered;
    if (args.includes("workspace") && args.includes("create")) {
      return JSON.stringify({ result: { root_pane: { pane_id: "wB:p1" }, workspace: { workspace_id: "wB" } } });
    }
    return "{}";
  };
  return { run, started: () => calls.filter((c) => c.includes("agent start")), prompted: () => calls.filter((c) => c.includes("agent send") || c.includes("agent prompt")) };
}

// --- THE TRANSITION: said once on entering and once on leaving, and nothing per tick ---------------------------------------------------------

test("entering: a limit seen with no pause holding is said once, and the record holds until its reset", () => {
  const { next, events } = nextLimit(undefined, LIMIT, NOW);
  assert.deepEqual(next, LIMIT);
  assert.deepEqual(events.map((e) => e.kind), ["enter"]);
  assert.match(events[0].line, /^Claude allowance spent on "ceo" until 2026-10-13T11:00:00\.000Z: Claude work is paused account-wide/);
});

test("holding: the next ticks with the same limit say nothing, and the pause is still there", () => {
  let prev: AccountLimit | undefined = LIMIT;
  for (const at of [NOW + 60_000, NOW + 120_000, RESET - 1]) {
    const step = nextLimit(prev, LIMIT, at);
    assert.deepEqual(step.events, [], `no line at ${new Date(at).toISOString()}`);
    prev = step.next;
  }
  assert.deepEqual(prev, LIMIT);
});

test("leaving: at its reset, with no limit seen, the pause is said once as ended and its record is dropped", () => {
  const { next, events } = nextLimit(LIMIT, null, RESET);
  assert.equal(next, undefined);
  assert.deepEqual(events.map((e) => e.kind), ["leave"]);
  assert.deepEqual(nextLimit(undefined, null, RESET + 60_000), { next: undefined, events: [] }, "and not said again");
});

test("a session still showing the old message after its reset is not a new limit: the pause is left once", () => {
  const { next, events } = nextLimit(LIMIT, LIMIT, RESET);
  assert.equal(next, undefined);
  assert.deepEqual(events.map((e) => e.kind), ["leave"]);
});

test("refused again after the reset: the old pause is left and the new one entered, with the new reset time", () => {
  const again: AccountLimit = { limitedUntil: RESET + 3_600_000, seenOn: "worker-7", text: "You've hit your session limit · resets 12pm (UTC)" };
  const { next, events } = nextLimit(LIMIT, again, RESET + 60_000);
  assert.deepEqual(next, again);
  assert.deepEqual(events.map((e) => e.kind), ["leave", "enter"]);
  assert.match(events[1].line, /until 2026-10-13T12:00:00\.000Z/);
});

test("a newer reset while holding extends the pause silently", () => {
  const later: AccountLimit = { ...LIMIT, limitedUntil: RESET + 1_800_000 };
  const { next, events } = nextLimit(LIMIT, later, NOW);
  assert.deepEqual(next, later);
  assert.deepEqual(events, []);
});

// --- THE RECORD AND THE FLAG --------------------------------------------------------------------------------------------------------------

function stateDir(): string {
  return mkdtempSync(join(tmpdir(), "account-limit-"));
}
const flagOn = (on: boolean): CanaryState => withMachineryFlag(emptyCanaryState(), { name: ACCOUNT_LIMIT_FLAG, on });

test("the record is written whole and read back by account; an absent account is the one account", () => {
  const dir = stateDir();
  try {
    const path = join(dir, ACCOUNT_LIMIT_FILE);
    writeAccountLimits(path, { default: LIMIT });
    assert.deepEqual(readAccountLimits(path), { default: LIMIT });
    assert.deepEqual(readFileSync(path, "utf8").split("\n")[0], "{");
    writeFileSync(path, "not json");
    assert.deepEqual(readAccountLimits(path), {}, "a malformed file is no record");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the flag is default off: a limited record holds nothing until `gate.accountLimitPause` is on", () => {
  const dir = stateDir();
  try {
    writeAccountLimits(join(dir, ACCOUNT_LIMIT_FILE), { default: LIMIT });
    assert.equal(pausedNow(NOW, dir, flagOn(false)), null, "flag off");
    assert.equal(pausedNow(NOW, dir, { flags: {}, samples: [], memo: {} }), null, "flag absent");
    assert.deepEqual(pausedNow(NOW, dir, flagOn(true)), LIMIT, "flag on");
    assert.equal(pausedNow(RESET, dir, flagOn(true)), null, "and it ends by itself at the reset");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- DONE-WHEN 1: THROUGH `deliver` ---------------------------------------------------------------------------------------------------------

test("CONTROL: with no pause, the same tick starts the engineer and the Codex reviewer", () => {
  const herdr = recordingHerdr();
  const got = deliver([engineerOrder, decisionOrder, reviewOrder], agents({ ceo: "working" }), [], { run: herdr.run, checkout, hostLoad: () => ({ load: 4, cores: 16 }) } as never);
  assert.ok(got.sent.some((line) => line.startsWith("worker-2131 <- engineers/")), got.sent.join("\n"));
  assert.ok(herdr.started().length >= 2, "the engineer and the reviewer were started");
});

test("with one limited session recorded: a ready row, a decision order and a green unreviewed PR claim nothing, start no Claude process and prompt no Claude seat, and DO start the Codex reviewer", () => {
  const herdr = recordingHerdr();
  const servedByRun: string[] = [];
  const got = deliver([engineerOrder, decisionOrder, reviewOrder], agents({ ceo: "working" }), [], {
    run: herdr.run, checkout, hostLoad: () => ({ load: 4, cores: 16 }), accountPause: LIMIT,
    serve: (order: { causeKey: string; }) => { servedByRun.push(order.causeKey); return { runId: "run-1", tier: "sonnet" } as never; },
  } as never);
  assert.deepEqual(servedByRun, [], "no `claude -p` decision run is asked for while limited");
  assert.deepEqual(got.sent.map((line) => line.split(" ")[0]), ["reviewer-18"], "only the reviewer is sent: " + got.sent.join(" | "));
  assert.equal(got.refused.length, 2, "the engineer and the decision order are refused");
  assert.ok(got.refused.every((line) => line.includes("account's Claude allowance is spent on \"ceo\"")), got.refused.join("\n"));
  assert.equal(herdr.started().length, 1, "one process started, and it is the reviewer's");
  assert.ok(herdr.started()[0].includes("reviewer-18") || herdr.started()[0].includes("reviewer"), herdr.started()[0]);
  assert.deepEqual(herdr.prompted().filter((c) => !c.includes("reviewer")), [], "no prompt to a Claude seat");
});

test("after `limitedUntil` the same tick claims and starts again, from the record that is still on disk", () => {
  const dir = stateDir();
  try {
    writeAccountLimits(join(dir, ACCOUNT_LIMIT_FILE), { default: LIMIT });
    const herdr = recordingHerdr();
    const before = deliver([engineerOrder], agents({ ceo: "working" }), [], {
      run: herdr.run, checkout, hostLoad: () => ({ load: 4, cores: 16 }), accountPause: pausedNow(RESET - 1, dir, flagOn(true)),
    } as never);
    assert.equal(before.sent.length, 0, "one millisecond before the reset the engineer is still refused");
    const after = deliver([engineerOrder], agents({ ceo: "working" }), [], {
      run: herdr.run, checkout, hostLoad: () => ({ load: 4, cores: 16 }), accountPause: pausedNow(RESET, dir, flagOn(true)),
    } as never);
    assert.equal(after.sent.length, 1, "at the reset the pause is gone, so the engineer is started: " + after.refused.join(" | "));
    assert.equal(herdr.started().length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- DONE-WHEN 2: A CLAIMED ROW IS NOT RELEASED WHILE LIMITED ------------------------------------------------------------------------------

test("a claimed row is not released by claim-stall while the account is limited, and is released when it is not", () => {
  const facts = { row: 2407, session: "worker-7", branch: "agent/x", worktree: "/wt/x", claimedAt: NOW - 3_600_000, openPrs: 0, ownPrs: [] };
  const reading = { kind: "release", why: "stalled", lastMoveAt: NOW - 3_600_000, idleMs: 3_600_000, nudgedAt: NOW - 1_800_000 };
  const readings = [{ facts: facts as never, reading: reading as never }];
  assert.equal(claimStalledOrders(readings, NOW, true).length, 0, "limited: the claim is kept");
  assert.equal(claimStalledOrders(readings, NOW, false).length, 1, "not limited: the stalled claim is released as it always was");
});

// --- DONE-WHEN 1, THE MUTATION: the spawn refusal is the thing that holds the first test ----------------------------------------------------
// `deliver` refuses a non-reviewer order at `targetFor` while `accountPause` is set. Remove that check and the limited test above starts the
// engineer and the Claude decision seat, and goes red; restored, it is green again.
