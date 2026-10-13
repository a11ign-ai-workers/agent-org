// no-token: gh -- no `gh` is reached; the referenced item's state is a fixture
// #1281 (class `row-not-finishable`): `unmetWaitingFor` is the reading a CLAIM asks of a row's `Waiting-for:` line, the one the gate's release acts on.
// Each refusal has its control with one fact changed: the same line with its condition met, and the same line read as unknown.
import { test } from "node:test";
import assert from "node:assert/strict";
import { unmetWaitingFor } from "./claim-stall.ts";
import type { RefFact } from "./wait-condition.ts";

const fact = (state: RefFact["state"]): RefFact => ({ state, labels: [], resolvedAt: null, changedAt: null });
const body = (line: string) => `## What\n\nx\n\n${line}\n`;

test("an open referenced item makes the line unmet, and the same line is met once it merged or closed", () => {
  assert.equal(unmetWaitingFor(body("Waiting-for: merged #1055"), "a11ign/agent-org", () => fact("open")), "merged #1055");
  assert.equal(unmetWaitingFor(body("Waiting-for: merged #1055"), "a11ign/agent-org", () => fact("merged")), null);
  assert.equal(unmetWaitingFor(body("Waiting-for: closed #1055"), "a11ign/agent-org", () => fact("closed")), null);
});

test("an unknown condition is not unmet: an unread reference, `manual`, a line outside the grammar and no line at all", () => {
  assert.equal(unmetWaitingFor(body("Waiting-for: merged #1055"), "a11ign/agent-org", () => null), null);
  assert.equal(unmetWaitingFor(body("Waiting-for: manual"), "a11ign/agent-org", () => fact("open")), null);
  assert.equal(unmetWaitingFor(body("Waiting-for: soon"), "a11ign/agent-org", () => fact("open")), null);
  assert.equal(unmetWaitingFor(body("nothing here"), "a11ign/agent-org", () => fact("open")), null);
  assert.equal(unmetWaitingFor(null, "a11ign/agent-org", () => fact("open")), null);
});

test("a bare `#n` is read in the row's tracker and a qualified one in its own repository", () => {
  const seen: string[] = [];
  unmetWaitingFor(body("Waiting-for: merged #1055\nWaiting-for: closed a11ign/a11ign#5156"), "a11ign/agent-org", (ref) => { seen.push(`${ref.repo}#${ref.number}`); return fact("merged"); });
  assert.deepEqual(seen, ["a11ign/agent-org#1055", "a11ign/a11ign#5156"]);
});
