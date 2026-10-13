// no-token: gh -- every read here is a fake `run`; no GitHub call is made, and nothing imported reaches the real `gh`.
/**
 * `src/row-claim.ts`, agent-org#1302 (a11ign/a11ign#5282, class `claim-refused`): THE CLAIM PATH'S ISSUE READS GO OVER REST. `fetchLabels` and `fetchClaimComments` were
 * `gh issue view`, which is GraphQL, so an exhausted GraphQL pool refused every claim it read. REST is another pool on the same token (#1113), and both reads now ask it.
 *
 * EVERY CASE CALLS THE READER ITSELF, and the fake `run` REFUSES any `issue view` argument as a 403, so a read that still reaches GraphQL answers a refusal the case catches.
 *
 * MUTATIONS, each run by hand with the file copied to the scratchpad and restored byte-identical after: the labels read put back on `gh issue view` (cases 1 and 4 go red);
 * the state mapping dropped (case 2 goes red); the comments window widened past the last 100 (case 6 goes red).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchClaimComments, fetchLabels } from "./row-claim.ts";

const REPO = "a11ign/agent-org";
const ROW = 1302;

/** A `gh` seam answering the REST paths in `answers`, keyed by the path after `repos/<owner>/<name>/`. Any other path is a 404, and an `issue view` is refused as GraphQL. */
function seam(answers: Record<string, unknown>) {
  const calls: string[][] = [];
  const run = (_cmd: string, args: string[]) => {
    calls.push(args);
    if (args[0] === "issue") throw Object.assign(new Error("Command failed: gh issue view"), { status: 1, stderr: "GraphQL: API rate limit already exceeded" });
    const path = args[1].replace(/^repos\/[^/]+\/[^/]+\//, "");
    if (!(path in answers)) throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: "gh: Not Found (HTTP 404)" });
    return JSON.stringify(answers[path]);
  };
  return { calls, run };
}

const label = (name: string) => ({ name });
const comment = (n: number) => ({ body: `comment ${n}` });

test("#1302 (1) the row's labels are read over REST: `gh api repos/<repo>/issues/<n>`, never `gh issue view`", () => {
  const { calls, run } = seam({ [`issues/${ROW}`]: { number: ROW, title: "A row", state: "open", labels: [label("ready")] } });
  fetchLabels(ROW, { run, repo: REPO });
  assert.deepEqual(calls, [["api", `repos/${REPO}/issues/${ROW}`]]);
});

test("#1302 (2) a REST body maps to the same IssueClaim the GraphQL one did: labels, title, number, and the state in the upper case callers read", () => {
  const { run } = seam({ [`issues/${ROW}`]: { number: ROW, title: "A row", state: "closed", labels: [label("in-progress"), label("started")] } });
  assert.deepEqual(fetchLabels(ROW, { run, repo: REPO }), { number: ROW, title: "A row", labels: ["in-progress", "started"], state: "CLOSED" });
  const open = seam({ [`issues/${ROW}`]: { number: ROW, title: "A row", state: "open", labels: [] } });
  assert.equal(fetchLabels(ROW, { run: open.run, repo: REPO }).state, "OPEN");
});

test("#1302 (3) an answer with no state is read as not verified closed, as before (state undefined, not a refusal)", () => {
  const { run } = seam({ [`issues/${ROW}`]: { number: ROW, title: "A row", labels: [] } });
  assert.equal(fetchLabels(ROW, { run, repo: REPO }).state, undefined);
});

test("#1302 (4) a failed REST read refuses to guess: it throws `could not read issue`, and says what gh said", () => {
  const argv: string[][] = [];
  const run = (_cmd: string, args: string[]) => {
    argv.push(args);
    throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: "gh: API rate limit exceeded for user ID 328832207." });
  };
  assert.throws(() => fetchLabels(ROW, { run, repo: REPO }), (error: Error) => {
    assert.equal(argv[0]?.[0], "api", "the failing read is the REST one, so its refusal names the pool it used");
    assert.match(error.message, /could not read issue #1302 from a11ign\/agent-org -- refusing to guess/);
    assert.match(error.message, /\(api-pool-exhausted; gh said: gh: API rate limit exceeded/);
    return true;
  });
});

test("#1302 (5) a non-JSON or shapeless REST answer refuses to guess and throws, and names no empty label list", () => {
  assert.throws(() => fetchLabels(ROW, { run: () => "<html>502</html>", repo: REPO }), /was not JSON -- refusing to guess/);
  assert.throws(() => fetchLabels(ROW, { run: () => JSON.stringify({ number: ROW, labels: [] }), repo: REPO }), /is missing number\/title\/labels/);
});

test("#1302 (6) the comments are read over REST, every page slurped into one list, and the last 100 kept as GraphQL's comments(last: 100) gave them", () => {
  const pages = [Array.from({ length: 100 }, (_, i) => comment(i + 1)), Array.from({ length: 50 }, (_, i) => comment(i + 101))];
  const { calls, run } = seam({ [`issues/${ROW}/comments?per_page=100`]: pages });
  const bodies = fetchClaimComments(ROW, { run, repo: REPO });
  assert.deepEqual(calls, [["api", `repos/${REPO}/issues/${ROW}/comments?per_page=100`, "--paginate", "--slurp"]]);
  assert.equal(bodies.length, 100);
  assert.equal(bodies[0], "comment 51");
  assert.equal(bodies.at(-1), "comment 150");
});

test("#1302 (7) a comments answer that is not a list of pages refuses to guess, and a failed read names what gh said", () => {
  const { run } = seam({ [`issues/${ROW}/comments?per_page=100`]: { comments: [] } });
  assert.throws(() => fetchClaimComments(ROW, { run, repo: REPO }), /was not a list of pages -- refusing to guess/);
  const refused = () => {
    throw Object.assign(new Error("Command failed: gh api"), { status: 1, stderr: "HTTP 403: API rate limit exceeded" });
  };
  assert.throws(() => fetchClaimComments(ROW, { run: refused, repo: REPO }), /could not read issue #1302's comments .*api-pool-exhausted; gh said: HTTP 403/);
});

test("#1302 (8) CONTROL: a row with no comments reads as none, one page asked for", () => {
  const { calls, run } = seam({ [`issues/${ROW}/comments?per_page=100`]: [[]] });
  assert.deepEqual(fetchClaimComments(ROW, { run, repo: REPO }), []);
  assert.equal(calls.length, 1);
});
