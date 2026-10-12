// no-token: gh -- every `gh` call here is an injected seam (`run`); nothing imported reaches the real one
/**
 * agent-org#1113: THE CLOSED-CLAIM READ GOES OVER REST, SO AN EXHAUSTED GRAPHQL POOL NO LONGER LEAVES A CLOSED ROW'S CLAIM UNREAD.
 *
 * The read was one `gh api graphql` call per tracker per tick, and the GraphQL pool of the account that runs the tick ran dry (measured 2026-10-12: 0 to 30 of 5000,
 * the line repeating for 30+ ticks). REST is another pool (`core`) on the same token. EVERY CASE CALLS `readClosedClaimedRows` ITSELF, and the fake `run` REFUSES any
 * `graphql` argument, so a read that still reaches GraphQL is refused and comes back `null`, which the cases below catch.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readClosedClaimedRows } from "./work-gate/causes/rows-claims-closed.ts";

const REPO = "a11ign/agent-org";
const CLAIM = [{ name: "in-progress" }, { name: "started" }, { name: "session:worker-5011" }];
const issue = (number: number, state: "open" | "closed", labels: { name: string; }[], comments = 0) => ({ number, state, labels, comments });
const comment = (body: string, login = "a11ign-ai-workers") => ({ body, created_at: "2026-10-12T19:30:00Z", user: { login } });

/**
 * A `gh` seam answering the REST paths in `answers` (keyed by the path after `repos/<owner>/<name>/`, query included). Any other path is a 404, and a
 * `graphql` argument is refused as a 403, so a read that still reaches GraphQL answers `null`.
 */
function seam(answers: Record<string, unknown>, refuse: Record<string, string> = {}) {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    if (args.includes("graphql")) throw Object.assign(new Error("Command failed: gh api graphql"), { status: 1, stderr: "HTTP 403: graphql is refused in this test" });
    const path = args[args.length - 1].replace(/^repos\/[^/]+\/[^/]+\//, "");
    if (path in refuse) throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: refuse[path] });
    if (!(path in answers)) throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: "gh: Not Found (HTTP 404)" });
    return JSON.stringify(answers[path]);
  };
  return { calls, run };
}

test("#1113 (1) a closed claimed row comes back with its labels, its last comments and the pull request that cross-referenced it, over REST only", () => {
  const { calls, run } = seam({
    "issues/5011": issue(5011, "closed", CLAIM, 1),
    "issues/5011/comments?per_page=100&page=1": [comment("the claim record")],
    "issues/5011/timeline": [{ event: "labeled" }, { event: "cross-referenced", source: { issue: { number: 412, title: "the fix", pull_request: {} } } }],
    "pulls/412": { head: { ref: "agent/a-fix-5011" } },
  });
  const rows = readClosedClaimedRows([5011], run, undefined, () => assert.fail("nothing is refused"));
  assert.deepEqual(rows, [{ number: 5011, labels: CLAIM, comments: [{ body: "the claim record", createdAt: "2026-10-12T19:30:00Z", author: { login: "a11ign-ai-workers" } }],
    closedByPullRequestsReferences: [{ number: 412, headRefName: "agent/a-fix-5011", title: "the fix" }] }]);
  assert.ok(calls.every((args) => !args.includes("graphql")), "no GraphQL call is made on this path");
  assert.deepEqual(calls.map((args) => args[args.length - 1].replace(/^repos\/[^/]+\/[^/]+\//, "")), ["issues/5011", "issues/5011/comments?per_page=100&page=1", "issues/5011/timeline", "pulls/412"]);
});

test("#1113 (2) an open row, a closed row without the claim and an absent row are dropped, and only their issue is ever read", () => {
  const { calls, run } = seam({
    "issues/5011": issue(5011, "open", CLAIM),
    "issues/5012": issue(5012, "closed", [{ name: "started" }], 3),
  });
  const log: string[] = [];
  assert.deepEqual(readClosedClaimedRows([5011, 5012, 5013], run, undefined, (line) => log.push(line)), []);
  assert.deepEqual(calls.map((args) => args[args.length - 1].replace(/^repos\/[^/]+\/[^/]+\//, "")), ["issues/5011", "issues/5012", "issues/5013"],
    "the comments and the timeline are read only for a closed claimed row");
  assert.deepEqual(log, [], "an absent row (HTTP 404) is no claim, not a refusal");
});

test("#1113 (3) a refused issue read answers null and says why on the log", () => {
  const { run } = seam({}, { "issues/5011": "HTTP 502: Bad Gateway" });
  const log: string[] = [];
  assert.equal(readClosedClaimedRows([5011], run, undefined, (line) => log.push(line)), null, "a refusal is UNREAD, not an empty list");
  assert.ok(log.some((line) => /^closed-claim: the read of \S+ was refused: HTTP 502: Bad Gateway\n$/.test(line)), JSON.stringify(log));
});

test("#1113 (4) a refused comments read is UNREAD too: a closed claimed row whose record cannot be read is not returned without it", () => {
  const { run } = seam({ "issues/5011": issue(5011, "closed", CLAIM, 1) }, { "issues/5011/comments?per_page=100&page=1": "HTTP 502: Bad Gateway" });
  const log: string[] = [];
  assert.equal(readClosedClaimedRows([5011], run, undefined, (line) => log.push(line)), null);
  assert.ok(log.some((line) => /was refused: HTTP 502: Bad Gateway/.test(line)), JSON.stringify(log));
});

test("#1113 (5) CONTROL: every listed row open returns [], not null, and logs nothing", () => {
  const { run } = seam({ "issues/5011": issue(5011, "open", CLAIM), "issues/5012": issue(5012, "open", CLAIM) });
  const log: string[] = [];
  assert.deepEqual(readClosedClaimedRows([5011, 5012], run, undefined, (line) => log.push(line)), []);
  assert.deepEqual(log, []);
});

test("#1113 (6) a keyed tracker's rows are read in that tracker's repository and tagged with it", () => {
  const { calls, run } = seam({
    "issues/730": issue(730, "closed", [{ name: "in-progress" }, { name: "session:worker-agent-org-730" }], 1),
    "issues/730/comments?per_page=100&page=1": [comment("the claim record")],
    "issues/730/timeline": [],
  });
  const tracker = { key: "agent-org", repo: "a11ign/agent-org" };
  const rows = readClosedClaimedRows([730], run, tracker, () => assert.fail("nothing is refused"));
  assert.deepEqual(rows?.map((row) => [row.number, row.tracker]), [[730, tracker]]);
  assert.deepEqual(calls.map((args) => args.at(-1)), [`repos/${REPO}/issues/730`, `repos/${REPO}/issues/730/comments?per_page=100&page=1`, `repos/${REPO}/issues/730/timeline`],
    "every call is aimed at the tracker's repository");
});

test("#1113 (7) the comments read is the LAST 100, as GraphQL's `comments(last: 100)` gave them: a row with 150 comments reads pages 1 and 2 and keeps 51 to 150", () => {
  const pages = Array.from({ length: 150 }, (_, i) => comment(`c${i + 1}`));
  const { calls, run } = seam({
    "issues/5011": issue(5011, "closed", CLAIM, 150),
    "issues/5011/comments?per_page=100&page=1": pages.slice(0, 100),
    "issues/5011/comments?per_page=100&page=2": pages.slice(100),
    "issues/5011/timeline": [],
  });
  const [row] = readClosedClaimedRows([5011], run, undefined, () => assert.fail("nothing is refused"))!;
  const comments = row.comments ?? [];
  assert.equal(comments.length, 100);
  assert.deepEqual([comments[0]?.body, comments.at(-1)?.body], ["c51", "c150"]);
  assert.deepEqual(calls.map((args) => args.at(-1)?.replace(/^repos\/[^/]+\/[^/]+\//, "")), ["issues/5011", "issues/5011/comments?per_page=100&page=1", "issues/5011/comments?per_page=100&page=2", "issues/5011/timeline"]);
});

test("#1113 (8) a timeline on two pages is read whole: `gh api --paginate` prints one array per page back to back, so the read asks for --slurp and flattens the pages", () => {
  const firstPage = Array.from({ length: 100 }, (_, i) => ({ event: "labeled", id: i }));
  const secondPage = [{ event: "cross-referenced", source: { issue: { number: 412, title: "the fix", pull_request: {} } } }];
  const answers: Record<string, unknown> = {
    "issues/5011": issue(5011, "closed", CLAIM, 1),
    "issues/5011/comments?per_page=100&page=1": [comment("the claim record")],
    "pulls/412": { head: { ref: "agent/a-fix-5011" } },
  };
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    const path = args[args.length - 1].replace(/^repos\/[^/]+\/[^/]+\//, "");
    if (path === "issues/5011/timeline" && args.includes("--slurp")) return JSON.stringify([firstPage, secondPage]);
    if (path === "issues/5011/timeline" && args.includes("--paginate")) return `${JSON.stringify(firstPage)}\n${JSON.stringify(secondPage)}`;
    if (path in answers) return JSON.stringify(answers[path]);
    throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: "gh: Not Found (HTTP 404)" });
  };
  const rows = readClosedClaimedRows([5011], run, undefined, () => assert.fail("nothing is refused"));
  assert.deepEqual(rows?.[0]?.closedByPullRequestsReferences, [{ number: 412, headRefName: "agent/a-fix-5011", title: "the fix" }],
    "the cross-reference on the second page is found, not refused as invalid JSON");
  assert.ok(calls.some((args) => args.includes("--slurp")), "the timeline is asked for with --slurp");
});
