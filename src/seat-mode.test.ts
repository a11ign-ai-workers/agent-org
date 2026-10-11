// no-token: none -- `read` is a stub and `diagnostic` collects lines; nothing here spawns a process, reads the real tree or reaches a tracker.
/**
 * agent-org#902: A PROJECT CHOOSES, PER WAKE CLASS, A STANDING SEAT OR A ONE-SHOT RUN, AND EVERY DOUBT READS `seat`.
 *
 * POSITIVE CONTROL: `{ "answer-owed": "run" }` with a registry that holds that cause gives `run`. Without this case, "every doubt is seat" would
 * hold for a function that returns `seat` always.
 * NEGATIVE CONTROL: no file, an empty file, `{}`, malformed JSON, a value other than seat/run, a cause the file does not name and `run` for a cause the
 * registry does not hold each give `seat`, each as its own case, and a malformed file's diagnostic names the file and not what it held.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seatModeOf, seatsPath } from "./seat-mode.ts";
import type { SeatModeDeps } from "./seat-mode.ts";

const PATH = "/project/.agent-org/seats.json";
const KNOWN = new Set(["answer-owed", "review-requested"]);

/** A deps whose file holds `text` (or is absent when `text` is null, or fails with `code`). */
function deps(text: string | null | { code: string }, over: Partial<SeatModeDeps> = {}): { deps: SeatModeDeps; lines: string[]; reads: string[] } {
  const lines: string[] = [];
  const reads: string[] = [];
  const read = ((path: string) => {
    reads.push(path);
    if (text === null) throw Object.assign(new Error("no such file"), { code: "ENOENT" });
    if (typeof text !== "string") throw Object.assign(new Error("denied"), { code: text.code });
    return text;
  }) as unknown as SeatModeDeps["read"];
  return { deps: { path: PATH, known: KNOWN, read, diagnostic: (l) => lines.push(l), warned: new Set(), ...over }, lines, reads };
}

test("POSITIVE CONTROL: the file says run, the registry holds the cause: run", () => {
  const d = deps(JSON.stringify({ "answer-owed": "run" }));
  assert.equal(seatModeOf("answer-owed", d.deps), "run");
  assert.deepEqual(d.lines, []);
  assert.deepEqual(d.reads, [PATH]);
});

test("POSITIVE CONTROL: the choice is per cause, so a second cause is its own answer", () => {
  const d = deps(JSON.stringify({ "answer-owed": "run", "review-requested": "seat" }));
  assert.equal(seatModeOf("answer-owed", d.deps), "run");
  assert.equal(seatModeOf("review-requested", d.deps), "seat");
});

test("NEGATIVE CONTROL: no file is seat, and quietly", () => {
  const d = deps(null);
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
  assert.deepEqual(d.lines, []);
});

test("NEGATIVE CONTROL: an empty file is seat", () => {
  const d = deps("");
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
});

test("NEGATIVE CONTROL: `{}` is seat, and quietly: the project has not chosen", () => {
  const d = deps("{}");
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
  assert.deepEqual(d.lines, []);
});

test("NEGATIVE CONTROL: malformed JSON turns EVERY class to seat, and the line names the file and not what it held", () => {
  const secret = "{ \"answer-owed\": \"run\", TOKEN-hunter2";
  const d = deps(secret);
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
  assert.equal(seatModeOf("review-requested", d.deps), "seat");
  assert.equal(d.lines.length, 1, "said once per file, not once per call");
  assert.ok(d.lines[0].includes(PATH));
  assert.ok(!d.lines[0].includes("hunter2") && !d.lines[0].includes("answer-owed"), d.lines[0]);
});

test("NEGATIVE CONTROL: JSON that is not an object (array, string, null, number) is seat for every class", () => {
  for (const text of ["[\"run\"]", "\"run\"", "null", "7"]) {
    const d = deps(text);
    assert.equal(seatModeOf("answer-owed", d.deps), "seat", text);
    assert.equal(d.lines.length, 1, text);
    assert.ok(d.lines[0].includes(PATH), text);
  }
});

test("NEGATIVE CONTROL: a file that exists and cannot be read is seat and says which file", () => {
  const d = deps({ code: "EACCES" });
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
  assert.equal(d.lines.length, 1);
  assert.ok(d.lines[0].includes(PATH));
});

test("NEGATIVE CONTROL: a value other than seat/run is seat for that cause, and its neighbour keeps its own value", () => {
  for (const value of ["Run", "RUN", "one-shot", "", true, 1, null, ["run"], { mode: "run" }]) {
    const d = deps(JSON.stringify({ "answer-owed": value, "review-requested": "run" }));
    assert.equal(seatModeOf("answer-owed", d.deps), "seat", JSON.stringify(value));
    assert.equal(seatModeOf("review-requested", d.deps), "run", JSON.stringify(value));
    assert.equal(d.lines.length, 1, JSON.stringify(value));
    assert.ok(d.lines[0].includes(PATH));
    assert.ok(d.lines[0].includes("answer-owed"), "it names the cause the caller asked about");
  }
});

test("NEGATIVE CONTROL: a cause the file does not name is seat", () => {
  const d = deps(JSON.stringify({ "review-requested": "run" }));
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
});

test("NEGATIVE CONTROL: `run` for a cause the registry does not hold is seat, and the file is not even read", () => {
  const d = deps(JSON.stringify({ "no-such-cause": "run" }));
  assert.equal(seatModeOf("no-such-cause", d.deps), "seat");
  assert.deepEqual(d.reads, []);
});

test("NEGATIVE CONTROL: an empty registry makes every cause seat, which is the state of the tree today", () => {
  const d = deps(JSON.stringify({ "answer-owed": "run" }), { known: new Map() });
  assert.equal(seatModeOf("answer-owed", d.deps), "seat");
});

test("NEGATIVE CONTROL: names that live on Object.prototype are not causes the file named", () => {
  const known = new Set(["constructor", "__proto__", "toString"]);
  const d = deps("{}", { known });
  for (const cause of known) assert.equal(seatModeOf(cause, d.deps), "seat", cause);
  // ...and a file that really does name one of them as an own key is read like any other cause.
  const named = deps("{\"constructor\": \"run\"}", { known });
  assert.equal(seatModeOf("constructor", named.deps), "run");
});

test("the file is read at <project>/.agent-org/seats.json", () => {
  assert.equal(seatsPath("/project"), PATH);
});
