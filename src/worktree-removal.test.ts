// no-token: gh -- every `gh` here is a fake that answers from a table; nothing spawns one
/**
 * a11ign/agent-org#1216: A TREE'S ROW IS READ IN THE REPOSITORY THE TREE BELONGS TO, NEVER IN THE PRIMARY'S.
 *
 * The incident: `wt-agent-org-1159` was refused removal on `a11ign/a11ign#1159`, a MERGED row of another repository that happened to
 * carry a `session:` label. The primary's number was read for a tree whose row is in agent-org, so a dead claim was never released.
 *
 * Every `gh` answer comes from the table each test builds, and the table records which `repo#row` was asked about.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { claimRefusal, rowsClosed, treeRepo, type Gh } from "./worktree-removal.ts";
import type { Tracker } from "./project-config.ts";

const PRIMARY = "a11ign/a11ign";
const TRACKERS: Tracker[] = [
  { key: "", repo: PRIMARY, board: { owner: "a11ign", number: 1 } },
  { key: "agent-org", repo: "a11ign/agent-org", board: { owner: "a11ign", number: 2 } },
];

/** A `gh` that answers `issue view` from `rows`, keyed `repo#row`, and records every `repo#row` it was asked about. */
function fakeGh(rows: Record<string, { state: string, labels?: string[] }>) {
  const asked: string[] = [];
  const gh: Gh = (args) => {
    const repo = args[args.indexOf("--repo") + 1];
    const row = args[2];
    asked.push(`${repo}#${row}`);
    const found = rows[`${repo}#${row}`];
    if (found === undefined) throw new Error(`no fake row ${repo}#${row}`);
    return JSON.stringify({ state: found.state, labels: (found.labels ?? []).map((name) => ({ name })) });
  };
  return { gh, asked };
}

const AGENT_ORG_TREE = { path: "/home/agent/repos/wt-agent-org-1159", branch: "agent/some-slug-1159" };

test("a row with the same number in the primary is not read for an agent-org tree", () => {
  // The primary's #1159 is open and claimed by another session; agent-org's #1159 is open and unclaimed. Only agent-org's answers.
  const { gh, asked } = fakeGh({
    [`${PRIMARY}#1159`]: { state: "OPEN", labels: ["session:worker-judge"] },
    "a11ign/agent-org#1159": { state: "OPEN", labels: [] },
  });
  assert.deepEqual(claimRefusal(AGENT_ORG_TREE, { gh, trackers: TRACKERS }), { refused: false });
  assert.deepEqual(asked, ["a11ign/agent-org#1159"]);
});

test("a claim held in agent-org refuses the agent-org tree, and the primary's row is not read", () => {
  const { gh, asked } = fakeGh({
    [`${PRIMARY}#1159`]: { state: "OPEN", labels: ["session:worker-judge"] },
    "a11ign/agent-org#1159": { state: "OPEN", labels: ["session:worker-agent-org-1159"] },
  });
  const verdict = claimRefusal(AGENT_ORG_TREE, { gh, trackers: TRACKERS });
  assert.equal(verdict.refused, true);
  assert.match((verdict as { reason: string }).reason, /row #1159, which still carries session:worker-agent-org-1159/);
  assert.deepEqual(asked, ["a11ign/agent-org#1159"]);
});

test("a primary tree is read in the primary", () => {
  const { gh, asked } = fakeGh({
    [`${PRIMARY}#1159`]: { state: "OPEN", labels: ["session:worker-judge"] },
    "a11ign/agent-org#1159": { state: "OPEN", labels: [] },
  });
  assert.equal(claimRefusal({ path: "/home/agent/repos/wt-1159", branch: "agent/some-slug-1159" }, { gh, trackers: TRACKERS }).refused, true);
  assert.deepEqual(asked, [`${PRIMARY}#1159`]);
});

test("a tree naming a key no tracker declares is refused as undeterminable, and no row is read", () => {
  const { gh, asked } = fakeGh({ [`${PRIMARY}#1159`]: { state: "OPEN", labels: [] } });
  const verdict = claimRefusal({ path: "/home/agent/repos/wt-nowhere-1159", branch: "agent/some-slug-1159" }, { gh, trackers: TRACKERS });
  assert.equal(verdict.refused, true);
  assert.match((verdict as { reason: string }).reason, /could not be determined/);
  assert.deepEqual(asked, [], "a number read in the primary would answer for a different row");
  assert.deepEqual(treeRepo({ path: "/home/agent/repos/wt-nowhere-1159" }, TRACKERS), { undetermined: "/home/agent/repos/wt-nowhere-1159 names tracker `nowhere`, which no tracker declares, so its row's repository could not be determined" });
});

test("a closed primary row does not close an open agent-org row of the same number", () => {
  const { gh, asked } = fakeGh({
    [`${PRIMARY}#1159`]: { state: "CLOSED" },
    "a11ign/agent-org#1159": { state: "OPEN" },
  });
  assert.deepEqual(rowsClosed(AGENT_ORG_TREE, { gh, trackers: TRACKERS }), { closed: false, reason: "row #1159 is open, so the stamp is not stale (#3850)" });
  assert.deepEqual(asked, ["a11ign/agent-org#1159"]);
});
