// no-token: none -- every port, `claude` and provider call is an injected stub; nothing here reaches a tracker or a model.
/**
 * agent-org#906 (Move 3 of a11ign/a11ign#4505): THE CLASS `org-health`.
 *
 * POSITIVE CONTROL: against a fixture item carrying the order's flag the question holds the order, its default and the two allowed answers, each allowed answer yields exactly
 * its declared actions, the class is a loadable `DecisionClass`, and the whole path through `serveByRun` posts the table on the record issue.
 * NEGATIVE CONTROL, each its own case: an answer outside `allowed` yields no action; an item that no longer carries the order's flag yields none; a `posted` that directs a
 * per-row write yields none; the tier question with no provider answers Haiku and with a low-confidence pick Sonnet.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import orgHealth, {
  ALLOWED, ESCALATE, RECORD_ID, recordItem, recordRepo, ROLE_EXCERPT, ROLE_EXCERPT_CAP_BYTES, TIER_DEFAULT, TIER_LARGER, actionsFor, buildQuestion, itemOf, tierQuestion,
} from "./org-health.ts";
import { loadClasses, whyNotClass, type DecisionOrder } from "../registry.ts";
import { serveByRun, type ServeOrder } from "../../serve-by-run.ts";
import type { ItemRef, TicketItem, TicketPort } from "../../ticket-port/port.ts";

const ROOT = mkdtempSync(join(tmpdir(), "org-health-906-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;
const fresh = (): string => { const dir = join(ROOT, `case-${made += 1}`); mkdirSync(dir, { recursive: true }); return dir; };

// The declaration is a host file this test must not need: the repository is a fixture, and a host that cannot be read is its own case below.
const declared = recordRepo.read;
recordRepo.read = () => "fixture-owner/record-repo";
after(() => { recordRepo.read = declared; });
const RECORD_ITEM = recordItem() as ItemRef;
const ORDER: ServeOrder = {
  session: "ceo", cause: "org-health", causeKey: "ceo/org-health/board-disagrees@2026-10-12",
  prompt: "THE BOARD DISAGREES WITH REALITY. Read the day's table and post it.",
};
const NOW = Date.parse("2026-10-12T10:00:00.000Z");
const TABLE = "### Board against reality, 2026-10-12\n0 disagree, 0 unread.";
const itemWith = (over: Partial<TicketItem> = {}): TicketItem => ({
  ref: RECORD_ITEM, title: "Org record", body: "The record.", state: "in-progress", flags: ["org-health:ceo"] as unknown as TicketItem["flags"],
  relations: { blockedBy: [], parent: null, children: [], linkedChanges: [], notBefore: null, waitingFor: [] },
  events: [{ at: "2026-10-12T09:00:00.000Z", actor: "gate", kind: "flag-added" }],
  ...over,
});
const portOf = (item: TicketItem | null) => ({ readItem: () => item });
const stubPort = (item: TicketItem | null) => {
  const log = { posts: [] as unknown[], changes: [] as unknown[] };
  const port = {
    readItem: () => item,
    postDecision: (_ref: unknown, d: unknown) => { log.posts.push(d); return "c-1"; },
    changeState: (_ref: unknown, c: unknown) => { log.changes.push(c); return true; },
  } as unknown as TicketPort;
  return { port, log };
};

test("POSITIVE CONTROL: the question holds the order, the default and the allowed answers, and each answer yields exactly its actions", () => {
  const q = buildQuestion(ORDER, portOf(itemWith()));
  assert.ok(q.text.includes(ORDER.prompt as string), "the order is in the question");
  assert.ok(q.text.includes("org-health:ceo"));
  assert.equal(q.default, ESCALATE);
  assert.deepEqual(q.allowed, [...ALLOWED]);
  assert.deepEqual(actionsFor({ answer: "posted", text: TABLE }, ORDER), [{ type: "post", item: RECORD_ITEM, kind: "board-truth", text: TABLE }]);
  assert.deepEqual(actionsFor({ answer: "escalate", text: "Row 7 needs a state label.", row: "#7" }, ORDER), []);
});

test("POSITIVE CONTROL: the file is a loadable class, the role excerpt is under its cap, and the tier question defaults to Haiku", async () => {
  assert.equal(whyNotClass(orgHealth), null);
  assert.equal((await loadClasses(import.meta.dirname)).get("org-health")?.cause, "org-health");
  assert.ok(Buffer.byteLength(ROLE_EXCERPT, "utf8") <= ROLE_EXCERPT_CAP_BYTES, "under the named cap");
  assert.match(ROLE_EXCERPT, /you never do/);
  assert.deepEqual(tierQuestion(), { text: tierQuestion().text, default: TIER_DEFAULT, allowed: [TIER_DEFAULT, TIER_LARGER] });
  // Read as text: importing the audit resolves the host's checkout at load, which this file must not need.
  const tableRow = /export const TABLE_ROW = "(\d+)"/.exec(readFileSync(join(import.meta.dirname, "../../board-truth-audit.ts"), "utf8"))?.[1];
  assert.equal(String(RECORD_ID), tableRow, "the record issue is the one the gate posts its table on");
  assert.equal(RECORD_ITEM.id, RECORD_ID);
  assert.deepEqual(itemOf(ORDER), RECORD_ITEM);
  assert.equal(itemOf({ causeKey: "ceo/answer-owed/row-12" }), null);
});

test("NEGATIVE CONTROL: an answer outside `allowed`, or a malformed one, yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()));
  for (const bad of [{ answer: "fixed", text: TABLE }, { answer: "POSTED", text: TABLE }, { answer: "posted" }, { answer: "posted", text: "  " }, { answer: "escalate", text: TABLE }, null, "posted", 3]) {
    assert.deepEqual(actionsFor(bad, ORDER), [], JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: an item that no longer carries the order's flag yields no action, and only `escalate` is allowed", () => {
  const q = buildQuestion(ORDER, portOf(itemWith({ flags: [] })));
  assert.deepEqual(q.allowed, [ESCALATE]);
  assert.deepEqual(actionsFor({ answer: "posted", text: TABLE }, ORDER), []);
  buildQuestion(ORDER, portOf(null));
  assert.deepEqual(actionsFor({ answer: "posted", text: TABLE }, ORDER), [], "an unreadable item");
  const never: DecisionOrder = { causeKey: "ceo/org-health/never-asked", session: "ceo" };
  assert.deepEqual(actionsFor({ answer: "posted", text: TABLE }, never), [], "never asked");
});

test("NEGATIVE CONTROL: a `posted` that directs a per-row write yields no action", () => {
  buildQuestion(ORDER, portOf(itemWith()));
  for (const text of [`${TABLE}\nRun gh project item-edit on #7.`, `${TABLE}\nUse --add-label parked on #7.`, `${TABLE}\nClose the row.`]) {
    assert.deepEqual(actionsFor({ answer: "posted", text }, ORDER), [], text);
  }
});

test("through serveByRun: the table is posted and nothing else is written; an escalate writes nothing and falls back to the seat", async () => {
  const run = async (structured: unknown) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "org-health": "run" }));
    const { port, log } = stubPort(itemWith());
    const result = await serveByRun(ORDER, {
      classes: new Map([["org-health", orgHealth]]), seats: { path: join(dir, "seats.json") }, itemOf: () => RECORD_ITEM, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW,
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: structured, session_id: "run-1" }), timedOut: false }) },
    });
    return { result, log };
  };
  const posted = await run({ answer: "posted", text: TABLE });
  assert.equal(posted.result.outcome, "served");
  assert.equal(posted.log.posts.length, 1);
  assert.deepEqual(posted.log.changes, []);
  const escalated = await run({ answer: "escalate", text: "Row 7 needs a label.", row: "#7" });
  assert.deepEqual(escalated.result, { outcome: "fallback", reason: "no-action" });
  assert.deepEqual(escalated.log, { posts: [], changes: [] });
});

test("NEGATIVE CONTROL: the tier is Haiku with no provider configured and Sonnet for a low-confidence pick", async () => {
  const tierOf = async (decide?: NonNullable<Parameters<typeof serveByRun>[1]["decide"]>) => {
    const dir = fresh();
    writeFileSync(join(dir, "seats.json"), JSON.stringify({ "org-health": "run" }));
    const { port } = stubPort(itemWith());
    const result = await serveByRun(ORDER, {
      classes: new Map([["org-health", orgHealth]]), seats: { path: join(dir, "seats.json") }, itemOf: () => RECORD_ITEM, port: () => port, stateDir: fresh(),
      roleExcerpt: () => ROLE_EXCERPT, now: () => NOW, decisionDeps: { host: {} }, ...(decide === undefined ? {} : { decide }),
      run: { cwd: dir, exec: async () => ({ exitCode: 0, stdout: JSON.stringify({ structured_output: { answer: "posted", text: TABLE }, session_id: "r" }), timedOut: false }) },
    });
    assert.equal(result.outcome, "served");
    return result.outcome === "served" ? result.tier : "";
  };
  assert.equal(await tierOf(), "haiku", "no provider configured");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: true, answers: { tier: { value: "haiku", fellBack: true, asked: "sonnet", confidence: 0.3 } } })), "sonnet", "low-confidence pick");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "sonnet", fellBack: false, confidence: 0.9 } } })), "sonnet", "the provider picks Sonnet");
  assert.equal(await tierOf(async () => ({ use: "model-routing", via: "jev", fellBack: false, answers: { tier: { value: "haiku", fellBack: false, confidence: 0.9 } } })), "haiku");
});

test("NEGATIVE CONTROL: a project whose declaration cannot be read has no record issue, so no item and no action", () => {
  const was = recordRepo.read;
  recordRepo.read = () => null;
  try {
    assert.equal(recordItem(), null);
    assert.equal(itemOf(ORDER), null);
    assert.deepEqual(buildQuestion(ORDER, portOf(itemWith())).allowed, [ESCALATE]);
    assert.deepEqual(actionsFor({ answer: "posted", text: TABLE }, ORDER), []);
  } finally {
    recordRepo.read = was;
  }
  // The real reader never throws: with no host in the environment it answers `null`.
  const host = process.env.AGENT_ORG_HOST;
  delete process.env.AGENT_ORG_HOST;
  try {
    assert.doesNotThrow(() => declared());
  } finally {
    if (host !== undefined) process.env.AGENT_ORG_HOST = host;
  }
});
