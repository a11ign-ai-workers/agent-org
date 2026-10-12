// no-token: gh -- every `gh` call here is an injected seam (`run`, `log`); nothing imported reaches the real one
/**
 * #948: A REFUSED CLOSED-CLAIM READ SAYS WHY.
 *
 * `readClosedClaimedRows` returned `null` from a bare `catch`, so the tick printed "UNREAD" on 31 consecutive ticks and nothing said what refused. Each case
 * calls the gate's own read (`closedClaimsWhenWorkerListed`), never a copy of it, and the log is the only thing asserted on a refusal: the answer is `null`
 * before and after the change. THE CONTROL is a closed claimed row read successfully, which must log NOTHING.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { closedClaimsWhenWorkerListed } from "./work-gate.ts";

const agents = [{ label: "worker-5011", status: "working" }];
const CLAIM = [{ name: "in-progress" }, { name: "session:worker-5011" }];
const issue = (number: number, state: string, labels: { name: string; }[]) => ({ number, state, labels: { nodes: labels }, comments: { nodes: [] },
  closedByPullRequestsReferences: { nodes: [] } });

test("#948 (1) a refused call names gh's own first stderr line on the log", () => {
  const log: string[] = [];
  const refused = () => { throw Object.assign(new Error("Command failed: gh api graphql"), { status: 1,
    stderr: "GraphQL: Could not resolve to an Issue with the number 5011.\nmore detail\n" }); };
  assert.deepEqual(closedClaimsWhenWorkerListed(agents, refused, (line) => log.push(line)), { rows: null, agents }, "a refusal is still UNREAD, not an empty list");
  assert.ok(log.some((line) => /^closed-claim: the read of \S+ was refused: GraphQL: Could not resolve to an Issue with the number 5011\.\n$/.test(line)), `the cause is on the log: ${JSON.stringify(log)}`);
});

test("#948 (2) an answer that is not JSON says so on the log", () => {
  const log: string[] = [];
  assert.deepEqual(closedClaimsWhenWorkerListed(agents, () => "garbage", (line) => log.push(line)), { rows: null, agents });
  assert.ok(log.some((line) => /was refused: its answer was not JSON/.test(line)), `${JSON.stringify(log)}`);
});

test("#948 (3) an answer with a null repository says so on the log", () => {
  const log: string[] = [];
  assert.deepEqual(closedClaimsWhenWorkerListed(agents, () => JSON.stringify({ data: { repository: null } }), (line) => log.push(line)), { rows: null, agents });
  assert.ok(log.some((line) => /was refused: its answer has data.repository null/.test(line)), `${JSON.stringify(log)}`);
});

test("#948 (4) CONTROL: a closed claimed row read successfully logs NOTHING", () => {
  const log: string[] = [];
  const answer = JSON.stringify({ data: { repository: { r5011: issue(5011, "CLOSED", CLAIM) } } });
  const read = closedClaimsWhenWorkerListed(agents, () => answer, (line) => log.push(line));
  assert.deepEqual(read?.rows?.map((row) => row.number), [5011], "the closed claim is read");
  assert.deepEqual(log, [], "no cause is printed for a read that succeeded");
});
