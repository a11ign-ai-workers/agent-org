// no-token: gh -- no `gh` call is made here; the shelvings, the pull request's holder and the rows' `blockedBy` edges are handed in, and every effect (record file, ledger, row write) is a seam (agent-org#5009)
// agent-org#878 stood red for 1h45m in a CIRCULAR WAIT the gate printed as two unrelated lines every tick: its worker waited for #884, and B4 shelved #884 because #878 also touched `ci.yml`. The fixture is that
// shape as read 2026-10-11: PR #878 (held by worker-agent-org-862, closes #862) shelves #884, #874 and #888; #862 waits on #884 (the native edge `worker:state blocked --on 884` writes, agent-org#921).
//
// POSITIVE CONTROLS: the cycle is found and its holder woken once (a detector that never fires fails the first test, and the same fixture is the negative controls' base), and a cycle still standing on
// the next tick escalates once. NEGATIVE CONTROLS: #874 and #888 are shelved by the same pull request and are plain B4 shelves, and a pull request whose closed row waits on nothing is not a cycle.
import assert from "node:assert/strict";
import { test } from "node:test";
import { B4_DEADLOCK_KIND, blockingImpactTick, DEADLOCK_ESCALATION_SESSION, deadlockSummary, MAX_TICK_GAP_MS, parseRecord, resolverOf, type BlockingOrder, type Shelved } from "./blocking-impact.ts";

const KEYED = "a11ign/agent-org";
const HOLDER = "worker-agent-org-862";
const T0 = Date.parse("2026-10-11T08:53:00Z");
const MINUTE = 60_000;
const TICK = 2 * MINUTE;
const B4_PR = (n: number) => `overlaps #${n} in ${KEYED}, which already touches: .github/workflows/ci.yml. B4: no two open pull requests touch the same file`;
const SHELVED = (...rows: number[]): Shelved[] => rows.map((number) => ({ number, reason: B4_PR(878), repo: KEYED }));
const edge = (...blockers: number[]) => ({ blockedBy: { nodes: blockers.map((number) => ({ number, state: "OPEN" })) } });

/** PR #878 closes #862. `waits` is what #862 waits on: `[884]` is the #878 shape, `[]` is a plain shelf. `session` is who holds the pull request. */
function resolverFor({ waits, session = HOLDER }: { waits: number[]; session?: string | null }) {
  const trackers = { [KEYED]: [{ number: 862, ...edge(...waits) }, { number: 884 }, { number: 874 }, { number: 888 }] };
  const prs = [{ number: 878, repo: KEYED, session, closes: [862] }];
  return resolverOf({ rows: [], prs, trackers, sessionOf: (item) => item.session ?? null, closesOf: (pr) => pr.closes });
}

/** The gate's seams in memory: one record file, the ledger, the row writes and the log, across as many ticks as the test runs. */
function world({ unwritable = false }: { unwritable?: boolean } = {}) {
  let stored: string | null = null;
  const seen = { log: [] as string[], comments: [] as { row: number; body: string; repo?: string }[], ledger: [] as { classKey: string; ref: string }[] };
  const io = {
    read: () => { if (stored === null) throw Object.assign(new Error("absent"), { code: "ENOENT" }); return stored; },
    write: (_path: string, text: string) => { if (unwritable) throw new Error("read-only"); stored = text; },
    comment: (row: number, body: string, repo?: string) => { seen.comments.push({ row, body, repo }); },
    record: (event: { classKey: string; ref: string }) => { seen.ledger.push({ classKey: event.classKey, ref: event.ref }); return { appended: 1, skipped: 0, refused: null }; },
    log: (line: string) => { seen.log.push(line); },
  };
  const tick = (resolve: ReturnType<typeof resolverFor>, { at, blocked = SHELVED(884, 874, 888) }: { at: number; blocked?: Shelved[] }): BlockingOrder[] =>
    blockingImpactTick({ blocked, resolve, stateDir: "/unused", now: at, ...io } as Parameters<typeof blockingImpactTick>[0]);
  return { seen, tick, record: () => parseRecord(stored ?? "") };
}
const CYCLE = resolverFor({ waits: [884] });
const PLAIN = resolverFor({ waits: [] });

test("the #878 shape: the holder is woken ONCE, with both ways out, and the row it names is #884 only", () => {
  const w = world();
  const first = w.tick(CYCLE, { at: T0 });
  assert.equal(first.length, 1, `one order for the one cycle, not one per shelved row: ${JSON.stringify(first.map((o) => o.subject))}`);
  assert.equal(first[0].session, HOLDER);
  assert.equal(first[0].subject, "row-884");
  for (const part of ["#862, which waits on #884", "narrow agent-org#878 to drop the overlapping file", "take it into agent-org#878", ".github/workflows/ci.yml", DEADLOCK_ESCALATION_SESSION]) {
    assert.ok(first[0].prompt.includes(part), `the wake says ${part}: ${first[0].prompt}`);
  }
  assert.equal(w.seen.log.filter((line) => line.includes("DEADLOCK #884")).length, 1, "the tick still prints the line");
  assert.deepEqual(w.seen.ledger, [], "the first tick is a wake, not an incident");
  assert.deepEqual(w.seen.comments, []);
});

test("a plain B4 shelf with no reverse wait is not called a deadlock, and nobody is woken", () => {
  const w = world();
  for (let i = 0; i < 4; i += 1) assert.deepEqual(w.tick(PLAIN, { at: T0 + i * TICK }), []);
  assert.deepEqual(w.seen.log.filter((line) => line.includes("DEADLOCK")), []);
  assert.equal(w.record().deadlocks, undefined, "no cycle is remembered");
  assert.deepEqual(w.seen.ledger, []);
});

test("a cycle still standing on the second tick escalates: the incident names both rows and wakes orchestrator, once", () => {
  const w = world();
  w.tick(CYCLE, { at: T0 });
  const second = w.tick(CYCLE, { at: T0 + TICK });
  assert.equal(second.length, 1, "the holder is not woken a second time: only the escalation");
  assert.equal(second[0].session, DEADLOCK_ESCALATION_SESSION);
  for (const part of ["agent-org#878", "#862", "#884", HOLDER]) assert.ok(second[0].prompt.includes(part), `the escalation names ${part}: ${second[0].prompt}`);
  assert.deepEqual(w.seen.ledger.map((e) => e.classKey), [B4_DEADLOCK_KIND]);
  assert.deepEqual(w.seen.comments.map((c) => [c.row, c.repo]), [[862, KEYED], [884, KEYED]], "a row write on each of the two rows, in the tracker they are in");
  assert.deepEqual(w.tick(CYCLE, { at: T0 + 2 * TICK }), [], "a third tick in the same cycle adds nothing");
  assert.deepEqual(w.tick(CYCLE, { at: T0 + 3 * TICK }), []);
  assert.equal(w.seen.ledger.length, 1);
  assert.equal(w.seen.comments.length, 2);
});

test("a cycle the holder broke is counted with how long it stood, and is not escalated", () => {
  const w = world();
  w.tick(CYCLE, { at: T0 });
  assert.deepEqual(w.tick(PLAIN, { at: T0 + TICK }), [], "the wait is gone on the second tick: nothing is escalated");
  assert.deepEqual(w.seen.ledger, []);
  const summary = deadlockSummary(w.record(), T0 + TICK);
  assert.deepEqual(summary, { found: 1, standing: [], broken: [{ key: `${KEYED}#884<-agent-org#878`, minutes: 2, escalated: false }] });
  assert.equal(w.record().deadlocks, undefined);
});

test("the daily count reads a standing cycle by its age, and a broken one for 24 hours only", () => {
  const w = world();
  w.tick(CYCLE, { at: T0 });
  w.tick(CYCLE, { at: T0 + TICK });
  assert.deepEqual(deadlockSummary(w.record(), T0 + 10 * MINUTE).standing.map((s) => s.minutes), [10]);
  w.tick(PLAIN, { at: T0 + 3 * TICK });
  assert.deepEqual(deadlockSummary(w.record(), T0 + 3 * TICK).broken.map((b) => [b.minutes, b.escalated]), [[6, true]]);
  assert.equal(deadlockSummary(w.record(), T0 + 25 * 60 * MINUTE).found, 0, "past the window it is not counted");
  assert.deepEqual(deadlockSummary({ at: T0, episodes: {}, samples: [] }, T0), { found: 0, standing: [], broken: [] }, "a record with no cycle reads found: 0");
});

test("a pull request nobody is known to hold goes straight to the escalation, once", () => {
  const w = world();
  const unheld = resolverFor({ waits: [884], session: null });
  const first = w.tick(unheld, { at: T0 });
  assert.deepEqual(first.map((o) => o.session), [DEADLOCK_ESCALATION_SESSION]);
  assert.ok(first[0].prompt.includes("No session is known to hold agent-org#878"), first[0].prompt);
  assert.equal(w.seen.ledger.length, 1);
  assert.deepEqual(w.tick(unheld, { at: T0 + TICK }), []);
  assert.equal(w.seen.ledger.length, 1);
});

test("a gap in observation starts the cycle afresh, as it does an episode: the holder is woken, not escalated", () => {
  const w = world();
  w.tick(CYCLE, { at: T0 });
  const after = w.tick(CYCLE, { at: T0 + MAX_TICK_GAP_MS + MINUTE });
  assert.deepEqual(after.map((o) => o.session), [HOLDER]);
  assert.deepEqual(w.seen.ledger, []);
});

test("a record that cannot be kept makes no order, because it could never be a second tick, and says so", () => {
  const control = world();
  assert.equal(control.tick(CYCLE, { at: T0 }).length, 1, "positive control: the same tick with a writable record does wake");
  const w = world({ unwritable: true });
  assert.deepEqual(w.tick(CYCLE, { at: T0 }), []);
  assert.ok(w.seen.log.some((line) => line.includes("no circular-wait order was made")), w.seen.log.join(" | "));
});

test("a wait that has cleared (a CLOSED edge) is no cycle", () => {
  const prs = [{ number: 878, repo: KEYED, session: HOLDER, closes: [862] }];
  const trackers = { [KEYED]: [{ number: 862, blockedBy: { nodes: [{ number: 884, state: "CLOSED" }] } }, { number: 884 }] };
  const closed = resolverOf({ rows: [], prs, trackers, sessionOf: (item) => item.session ?? null, closesOf: (pr) => pr.closes });
  assert.deepEqual(world().tick(closed, { at: T0, blocked: SHELVED(884) }), []);
});
