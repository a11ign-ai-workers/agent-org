// a11ign/a11ign#5128: the gate's hot polling reads go to REST with If-None-Match, read only what changed, and stop at a per-tick GraphQL budget.
// no-token: gh -- the `ask` seam is a fake GitHub that answers a 304 to the ETag it last gave, so what the reader SENDS is what these tests read; no `gh` starts.
//
// Three claims, the three Done-when lines of the row, each with its positive control beside it:
//   (a) a repeated unchanged URL sends the stored ETag and returns the cached value on a 304, across a process restart too;
//   (b) a pull request whose head and `updatedAt` are unchanged is not re-read, and one whose either moved is;
//   (c) the budget refuses the spend that would pass its cap, leaves the total where it was, and says where the points went.

import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { budgetLine, budgetOf, conditionalGate, meteredRun, partitionUnchanged, restConditionalOn, seenOf, TICK_POINTS_CAP } from "./gh-conditional.ts";
import { readValidators, saveValidators, type Validated } from "./trace/publish.ts";

const ETAG = 'W/"abc123"';
const HEAD = { commit: { sha: "9f2c1d0" } };
const scratch = () => mkdtempSync(join(tmpdir(), "gh-conditional-"));

/** A fake GitHub for ONE path: 200 with `etag` the first time, and a 304 to that ETag after. Records what each request carried. */
function fakeGitHub(etag: string, body: unknown) {
  const sent: (string | null)[] = [];
  const ask = (_path: string, validator: string | null) => {
    sent.push(validator);
    if (validator === etag) return { status: 304, etag: validator, body: null };
    return { status: 200, etag, body };
  };
  return { ask, sent };
}

test("(a) a repeated unchanged URL sends the stored ETag and answers the 304 from the cached value", () => {
  const github = fakeGitHub(ETAG, HEAD);
  const held = {};
  const head = conditionalGate({ held, ask: github.ask, now: 1 }).read("repos/a11ign/a11ign/branches/main", (branch) => branch.commit.sha);
  const second = conditionalGate({ held, ask: github.ask, now: 2 });
  const again = second.read("repos/a11ign/a11ign/branches/main", (branch) => branch.commit.sha);

  assert.deepEqual(github.sent, [null, ETAG], "the second request must carry the ETag the first reply gave");
  assert.equal(head, "9f2c1d0");
  assert.equal(again, "9f2c1d0", "a 304 returns the value kept with the ETag");
  assert.equal(second.reads.notModified, 1);
});

test("(a) the validators survive a restart: a new process reads them from disk and still gets the 304", () => {
  const out = scratch();
  try {
    const github = fakeGitHub(ETAG, HEAD);
    const tick1 = { held: {} as Record<string, Validated> };
    conditionalGate({ held: tick1.held, ask: github.ask, now: 1 }).read("repos/a11ign/a11ign/branches/main", (branch) => branch.commit.sha);
    saveValidators({ out, held: tick1.held, now: 1 });

    const fresh = conditionalGate({ held: readValidators(out), ask: github.ask, now: 2 });
    fresh.read("repos/a11ign/a11ign/branches/main", (branch) => branch.commit.sha);
    assert.deepEqual(github.sent, [null, ETAG]);
    assert.equal(fresh.reads.notModified, 1);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("(a) positive control: a path with no kept ETag is asked without one, and a changed body is read as new", () => {
  const github = fakeGitHub(ETAG, HEAD);
  const gate = conditionalGate({ held: {}, ask: github.ask, now: 1 });
  gate.read("repos/a11ign/a11ign/branches/main", (branch) => branch.commit.sha);
  gate.read("repos/a11ign/agent-org/branches/main", (branch) => branch.commit.sha);
  assert.deepEqual(github.sent, [null, null], "an unknown path carries no validator");
  assert.equal(gate.reads.notModified, 0);
});

const pr = (number: number, headRefOid: string, updatedAt: string) => ({ number, headRefOid, updatedAt, title: `PR ${number}` });

test("(b) a pull request whose head and updatedAt are unchanged is not re-read", () => {
  const tick1 = [pr(10, "aaa", "2026-10-12T01:00:00Z"), pr(11, "bbb", "2026-10-12T01:00:00Z")];
  const seen = seenOf(tick1);
  const tick2 = [pr(10, "aaa", "2026-10-12T01:00:00Z"), pr(11, "bbb", "2026-10-12T02:00:00Z")];

  const { reread, unchanged } = partitionUnchanged(tick2, seen);
  assert.deepEqual(unchanged.map((p) => p.number), [10]);
  assert.deepEqual(reread.map((p) => p.number), [11], "updatedAt moved, so PR 11 is read again");
});

test("(b) positive control: a head that moved is re-read even when updatedAt did not, and a new PR is re-read", () => {
  const seen = seenOf([pr(10, "aaa", "2026-10-12T01:00:00Z")]);
  const { reread, unchanged } = partitionUnchanged([pr(10, "ccc", "2026-10-12T01:00:00Z"), pr(12, "ddd", "2026-10-12T01:00:00Z")], seen);
  assert.deepEqual(unchanged, []);
  assert.deepEqual(reread.map((p) => p.number), [10, 12]);
});

test("(c) the budget refuses the spend that would pass its cap and spends nothing on the refusal", () => {
  const budget = budgetOf({ cap: 60 });
  assert.equal(budget.spend("open-prs", 25), true);
  assert.equal(budget.spend("open-prs", 25), true);
  assert.equal(budget.spend("open-rows", 25), false, "50 + 25 would pass 60");
  assert.equal(budget.summary().total, 50, "a refused spend is not charged");
  assert.equal(budget.spend("open-rows", 10), true);
  assert.equal(budget.exhausted(), true);
});

test("(c) positive control: the budget reports its spend by cause, and the default cap is the row's 60 points", () => {
  const budget = budgetOf();
  budget.spend("open-prs", 20);
  budget.spend("open-rows", 5);
  budget.spend("open-prs", 5);
  assert.equal(TICK_POINTS_CAP, 60);
  assert.deepEqual(budget.summary(), { total: 30, cap: 60, byCause: { "open-prs": 25, "open-rows": 5 } });
  assert.equal(budget.exhausted(), false);
  assert.equal(budgetLine(budget.summary()), "gate-budget: 30/60 points (open-prs 25, open-rows 5)");
});

test("the flag is a marker file: present turns the REST path on, absent leaves the GraphQL reads as they were", () => {
  assert.equal(restConditionalOn("/some/where/gate-rest-conditional", () => true), true);
  assert.equal(restConditionalOn("/some/where/gate-rest-conditional", () => false), false);
  const dir = scratch();
  try {
    const marker = join(dir, "gate-rest-conditional");
    assert.equal(restConditionalOn(marker), false);
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, "");
    assert.equal(existsSync(marker), true);
    assert.equal(restConditionalOn(marker), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("(c) metered: the GraphQL read that would pass the cap is refused before gh runs, and the refusal throws as a failed gh does", () => {
  const sent: string[][] = [];
  const run = (args: string[]) => { sent.push(args); return "[]"; };
  const budget = budgetOf({ cap: 2 });
  const metered = meteredRun(run, budget);
  metered(["pr", "list", "--limit", "100"]);
  metered(["issue", "list", "--limit", "500"]);
  assert.throws(() => metered(["pr", "list"]), /gate-budget: refused `gh pr list` at 2\/2 points/);
  assert.equal(sent.length, 2, "a refused read never reaches gh");
  assert.equal(budget.summary().total, 2);
});

test("(c) positive control: REST, a mutation and a plain write are not charged, so the cap cannot refuse them", () => {
  const sent: string[][] = [];
  const run = (args: string[]) => { sent.push(args); return ""; };
  const budget = budgetOf({ cap: 1 });
  const metered = meteredRun(run, budget);
  metered(["api", "repos/a11ign/a11ign/pulls/5/files?per_page=100"]);
  metered(["api", "graphql", "-f", "query=mutation { enablePullRequestAutoMerge(input: {}) { clientMutationId } }"]);
  metered(["pr", "merge", "5", "--squash"]);
  metered(["api", "graphql", "-f", "query=query { viewer { login } }"]);
  assert.equal(sent.length, 4, "the three non-reads ran, and the one GraphQL query was the one the cap allowed");
  assert.deepEqual(budget.summary(), { total: 1, cap: 1, byCause: { "api graphql": 1 } });
});

test("(c) flag off: a null budget hands the run back unchanged, and nothing is charged", () => {
  const run = (_args: string[]) => "ok";
  assert.equal(meteredRun(run, null), run);
});
