// no-token: gh -- pure functions, and a fake storage
import { test } from "node:test";
import assert from "node:assert/strict";
import { COLUMNS, NO_PROJECT, groupByStatus, projectCounts, queueLabel, recall, remember, selectable, toggled, visibleTickets, type ViewTicket } from "./board-view.ts";

const t = (key: string, status: string, statusOrder: number, priority: number, project: string | null, title = key): ViewTicket =>
  ({ key, title, status, statusOrder, priority, project });
const TICKETS = [
  t("NBF-1", "Backlog", 0, 3, "Visual Explorer - GA", "Fit to View does nothing"),
  t("NBF-2", "Backlog", 0, 1, "Visual Explorer - GA", "Racks removed on Save"),
  t("NBF-3", "Backlog", 0, 0, null, "Favicon"),
  t("NBCA-4", "In Progress", 2, 2, "Billing", "Stripe card"),
  t("NBCA-5", "Todo", 1, 0, "Billing", "Plan picker"),
];
const keys = (tickets: readonly ViewTicket[]) => tickets.map((x) => x.key);

test("no project chosen shows every ticket; chosen projects show only theirs, several at once, and (no project) is one of them", () => {
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(), "")), ["NBF-1", "NBF-2", "NBF-3", "NBCA-4", "NBCA-5"]);
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(["Billing"]), "")), ["NBCA-4", "NBCA-5"]);
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(["Billing", NO_PROJECT]), "")), ["NBF-3", "NBCA-4", "NBCA-5"]);
});

test("the search narrows within the chosen projects, matching key, title or project, in any case", () => {
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(["Visual Explorer - GA"]), "  RACKS ")), ["NBF-2"]);
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(), "nbca")), ["NBCA-4", "NBCA-5"]);
  assert.deepEqual(keys(visibleTickets(TICKETS, new Set(["Billing"]), "racks")), [], "a search outside the chosen projects finds nothing");
});

test("project chips count their tickets, most first, then by name", () => {
  assert.deepEqual(projectCounts(TICKETS), [["Billing", 2], ["Visual Explorer - GA", 2], [NO_PROJECT, 1]]);
});

test("groups follow the workflow's order, and within a group urgent comes first and no priority last", () => {
  const groups = groupByStatus(TICKETS);
  assert.deepEqual(groups.map(([status]) => status), ["Backlog", "Todo", "In Progress"]);
  assert.deepEqual(keys(groups[0][1]), ["NBF-2", "NBF-1", "NBF-3"], "priority 1 (urgent) before 3 (medium) before 0 (none)");
});

test("a ticket already on the queue cannot be selected again", () => {
  assert.equal(selectable(TICKETS[0], [{ ticket: { key: "NBF-1" }, phase: "queued" }]), false);
  assert.equal(selectable(TICKETS[1], [{ ticket: { key: "NBF-1" }, phase: "queued" }]), true);
});

test("toggling adds or removes a value and leaves the old set alone", () => {
  const before = new Set(["Backlog"]);
  assert.deepEqual([...toggled(before, "Todo")], ["Backlog", "Todo"]);
  assert.deepEqual([...toggled(before, "Backlog")], []);
  assert.deepEqual([...before], ["Backlog"]);
});

test("open sections and chosen projects are remembered, and a browser that refuses storage or holds junk gets the defaults", () => {
  const kept = new Map<string, string>();
  const storage = { getItem: (name: string) => kept.get(name) ?? null, setItem: (name: string, value: string) => { kept.set(name, value); } };
  remember(storage, "ticket-mode.open", new Set(["Backlog", "Todo"]));
  assert.deepEqual([...recall(storage, "ticket-mode.open")], ["Backlog", "Todo"]);
  const refusing = { getItem: () => { throw new Error("SecurityError"); }, setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.deepEqual([...recall(refusing, "x")], []);
  assert.doesNotThrow(() => remember(refusing, "x", new Set(["a"])));
  assert.deepEqual([...recall({ getItem: () => "{not json", setItem: () => {} }, "x")], []);
  assert.deepEqual([...recall(null, "x")], [], "no storage at all");
});

test("each run sits in exactly one board column", () => {
  const where = (entry: Parameters<typeof COLUMNS[number]["holds"]>[0]) => COLUMNS.filter((c) => c.holds(entry)).map((c) => c.title);
  assert.deepEqual(where({ ticket: { key: "A" }, phase: "queued" }), ["Queued"]);
  assert.deepEqual(where({ ticket: { key: "A" }, phase: "starting" }), ["Running"]);
  assert.deepEqual(where({ ticket: { key: "A" }, phase: "finished", outcome: { kind: "draft-pr" } }), ["Draft PR"]);
  for (const kind of ["needs-human", "wrong-repo", "no-outcome"]) assert.deepEqual(where({ ticket: { key: "A" }, phase: "finished", outcome: { kind } }), ["Needs human"]);
  for (const kind of ["crashed", "stopped"]) assert.deepEqual(where({ ticket: { key: "A" }, phase: "finished", outcome: { kind } }), ["Failed"]);
});

test("the Queue button says what it will do", () => {
  assert.equal(queueLabel(0), "Select tickets to queue");
  assert.equal(queueLabel(1), "Queue 1 ticket");
  assert.equal(queueLabel(3), "Queue 3 tickets");
});
