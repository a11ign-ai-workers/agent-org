// no-token: gh -- every `herdr` call here is an injected seam
/**
 * `src/herdr-agents.ts`: EVERY herdr CALL TAKES A `session`, AND EVERY ONE DEFAULTS TO THE ORG'S.
 *
 * The org's callers pass nothing, so each call must still name `--session org` when the option is absent: that is
 * the half that proves the move out of `wake.ts` changed nothing. Ticket mode passes its own session, so each call
 * must name exactly that one and never `org`: that is the half that keeps its workers out of the org's listing.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ORG_SESSION, agentStartArgs, closedNote, openPane, readAgentSessions, readAgents } from "./herdr-agents.ts";

/** A herdr that answers each verb the way the live one does, recording every argv. */
function herdr() {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    if (args.includes("create")) return JSON.stringify({ result: { root_pane: { pane_id: "w1:p1" }, workspace: { workspace_id: "w1" } } });
    if (args.includes("workspace") && args.includes("list")) return JSON.stringify({ result: { workspaces: [{ label: "NBF-1", agent_status: "idle" }] } });
    if (args.includes("agent") && args.includes("list")) return JSON.stringify({ result: { agents: [{ name: "NBF-1", agent_session: { value: "u-1" } }] } });
    return JSON.stringify({ type: "ok" });
  };
  return { run, calls, sessions: () => calls.map((args) => args[args.indexOf("--session") + 1]) };
}

test("the org's session is `org`", () => {
  assert.equal(ORG_SESSION, "org");
});

test("absent, every call is made in the org's session, exactly as before the move", () => {
  const h = herdr();
  assert.deepEqual(openPane(h.run, "worker-1", {}), { pane: "w1:p1", workspace: "w1" });
  closedNote(h.run, "w1");
  readAgents(h.run);
  readAgentSessions(h.run);
  const start = agentStartArgs("worker-1", "claude", "w1:p1", ["--model", "sonnet"]);
  assert.deepEqual(start, ["--session", "org", "agent", "start", "worker-1", "--kind", "claude", "--pane", "w1:p1", "--", "--model", "sonnet"]);
  assert.deepEqual(h.sessions(), ["org", "org", "org", "org"]);
});

test("named, every call is made in that session and never in the org's", () => {
  const h = herdr();
  const session = "tickets";
  assert.deepEqual(openPane(h.run, "NBF-1", {}, "/w/NBF-1", { session }), { pane: "w1:p1", workspace: "w1" });
  closedNote(h.run, "w1", { session });
  assert.deepEqual(readAgents(h.run, { session }), [{ label: "NBF-1", status: "idle" }]);
  assert.deepEqual(readAgentSessions(h.run, { session }), new Map([["NBF-1", "u-1"]]));
  assert.equal(agentStartArgs("NBF-1", "claude", "w1:p1", [], { session })[1], session);
  assert.deepEqual(h.sessions(), [session, session, session, session]);
  assert.ok(h.calls[0].includes("--cwd") && h.calls[0].includes("/w/NBF-1"), "the cwd still reaches `workspace create`");
});

test("a workspace that names no pane is closed in the session it was opened in", () => {
  const calls: string[][] = [];
  const run = (args: string[]) => {
    calls.push(args);
    return args.includes("create") ? JSON.stringify({ result: { workspace: { workspace_id: "w9" } } }) : JSON.stringify({ type: "ok" });
  };
  const opened = openPane(run, "NBF-2", {}, undefined, { session: "tickets" });
  assert.ok("refusal" in opened && opened.refusal.includes("(w9) was closed"), JSON.stringify(opened));
  assert.deepEqual(calls[1], ["--session", "tickets", "workspace", "close", "w9"]);
});
