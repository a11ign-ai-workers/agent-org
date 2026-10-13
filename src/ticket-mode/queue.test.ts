// no-token: gh -- pure transitions, and one file in a temporary directory
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { tmpDir } from "../lib/tmp-fixture.ts";
import {
  amend, emptyQueue, enqueue, finish, loadQueue, markRunning, markStarting, nextStarts, observe, remove, retry, saveQueue, setMax, type Queue,
} from "./queue.ts";
import type { Ticket } from "./source.ts";

const ticket = (key: string) => ({ key, title: key, description: "", url: "", branch: key.toLowerCase(), status: "Backlog", statusOrder: 0, team: "NBF", project: null, priority: 0 }) as Ticket;
const choice = { repos: ["nbl-ui-netbox"], model: "opus", effort: "high" };
const keys = (queue: Queue) => queue.entries.map((e) => e.ticket.key);

test("enqueue adds what you selected, in order, once each, and refuses a choice with no repository", () => {
  let queue = enqueue(emptyQueue(3), [ticket("A"), ticket("B")], choice, 1);
  queue = enqueue(queue, [ticket("B"), ticket("C")], { ...choice, repos: ["nbl-ui-netbox", "nbl-ui-platform-libs"] }, 2);
  assert.deepEqual(keys(queue), ["A", "B", "C"]);
  assert.deepEqual(queue.entries[1].repos, ["nbl-ui-netbox"], "B kept the choice it was first queued with");
  assert.deepEqual(queue.entries[2].repos, ["nbl-ui-netbox", "nbl-ui-platform-libs"], "a ticket can be queued to several repositories");
  assert.throws(() => enqueue(queue, [ticket("D")], { ...choice, repos: [] }, 3), /at least one repository/);
});

test("amend and remove touch a queued entry only", () => {
  let queue = enqueue(emptyQueue(3), [ticket("A"), ticket("B")], choice, 1);
  queue = markStarting(queue, "A", 2);
  queue = amend(amend(queue, "A", { model: "sonnet" }), "B", { model: "sonnet", repos: ["platform-monorepo"] });
  assert.equal(queue.entries[0].model, "opus", "A started with opus and keeps it");
  assert.deepEqual([queue.entries[1].model, queue.entries[1].repos], ["sonnet", ["platform-monorepo"]]);
  assert.deepEqual(keys(remove(remove(queue, "A"), "B")), ["A"], "a started entry is not removed");
});

test("nextStarts fills free slots in queue order, counts starting and running alike, and starts nothing past the host's cores", () => {
  let queue = enqueue(emptyQueue(2), [ticket("A"), ticket("B"), ticket("C")], choice, 1);
  assert.deepEqual(nextStarts(queue, 1, 14).map((e) => e.ticket.key), ["A", "B"]);
  queue = markStarting(queue, "A", 2);
  assert.deepEqual(nextStarts(queue, 1, 14).map((e) => e.ticket.key), ["B"]);
  queue = markRunning(markStarting(queue, "B", 3), "B", "w2");
  assert.deepEqual(nextStarts(queue, 1, 14), [], "both slots are taken");
  queue = setMax(queue, 3);
  assert.deepEqual(nextStarts(queue, 14, 14).map((e) => e.ticket.key), ["C"], "exactly equal to the cores does not refuse");
  assert.deepEqual(nextStarts(queue, 14.01, 14), [], "past them it does");
  assert.throws(() => setMax(queue, 0), /1 or more/);
});

test("observe marks working, and a status that is none of the four ordinary ones as waiting on a person", () => {
  let queue = markRunning(markStarting(enqueue(emptyQueue(1), [ticket("A")], choice, 1), "A", 2), "A", "w1");
  queue = observe(queue, "A", "idle");
  assert.equal(queue.entries[0].seenWorking, false, "idle before the first prompt is taken is not a finished turn");
  queue = observe(observe(queue, "A", "working"), "A", "idle");
  assert.equal(queue.entries[0].seenWorking, true);
  assert.equal(observe(queue, "A", "blocked").entries[0].waiting, true);
  assert.equal(observe(queue, "A", "working").entries[0].waiting, false);
});

test("retry puts a finished entry back at the end, except a draft pull request, which is the result", () => {
  let queue = enqueue(emptyQueue(3), [ticket("A"), ticket("B"), ticket("C")], choice, 1);
  queue = finish(queue, "A", { kind: "crashed", reason: "x" }, 5);
  queue = finish(queue, "B", { kind: "draft-pr", prs: [{ repo: "nbl-ui-netbox", url: "u" }] }, 5);
  queue = retry(retry(queue, "A", 9), "B", 9);
  assert.deepEqual(keys(queue), ["B", "C", "A"]);
  assert.deepEqual([queue.entries[2].phase, queue.entries[2].outcome, queue.entries[2].queuedAt], ["queued", undefined, 9]);
  assert.equal(queue.entries[0].phase, "finished");
});

test("the queue file round-trips, and a missing one is an empty queue", () => {
  const path = join(tmpDir("ticket-queue-"), "tickets", "queue.json");
  assert.deepEqual(loadQueue(path, 4), emptyQueue(4));
  const queue = enqueue(emptyQueue(2), [ticket("A")], choice, 1);
  saveQueue(path, queue);
  assert.deepEqual(loadQueue(path, 9), queue, "the saved max wins over the default");
});
