// no-token: none -- imports fixture modules written into a private temp directory; nothing here spawns a process or reaches a tracker.
/**
 * agent-org#902: A CLASS IS A FILE, AND `loadClasses` REFUSES, BY FILE NAME, WHAT IS NOT ONE.
 *
 * POSITIVE CONTROL: two well-formed class files load, by cause, and a test file and a non-`.ts` file beside them are not imported.
 * NEGATIVE CONTROL: a module whose default export is not a class, a module with none, a file that does not import and two classes for one cause are
 * each refused with the file's name; an absent directory is no classes and is not an error.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadClasses, whyNotClass, DecisionClassError } from "./registry.ts";

/** A class module's source: plain JS, which a `.ts` file may be. */
const classSource = (cause: string, over: Record<string, string> = {}): string => {
  const fields: Record<string, string> = {
    cause: JSON.stringify(cause),
    schema: "{ type: \"object\", required: [\"answer\"], properties: { answer: { type: \"string\" } } }",
    allowed: "[\"merge\", \"hold\"]",
    buildQuestion: "() => ({ text: \"q\", default: \"hold\", allowed: [\"merge\", \"hold\"] })",
    actionsFor: "() => []",
    ...over,
  };
  return `export default { ${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join(", ")} };\n`;
};

/** Every fixture directory is a child of this one, removed once the file's tests are done (the private TMPDIR is checked empty at the end of a run). */
const ROOT = mkdtempSync(join(tmpdir(), "registry-902-"));
after(() => rmSync(ROOT, { recursive: true, force: true }));
let made = 0;

function fixture(files: Record<string, string>): string {
  const dir = join(ROOT, `case-${made += 1}`);
  mkdirSync(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

const refusal = async (dir: string): Promise<DecisionClassError> => {
  try {
    await loadClasses(dir);
  } catch (err) {
    assert.ok(err instanceof DecisionClassError, String(err));
    return err;
  }
  throw new assert.AssertionError({ message: "loadClasses did not refuse" });
};

test("POSITIVE CONTROL: every non-test .ts file is a class and the map is keyed by cause", async () => {
  const dir = fixture({
    "answer-owed.ts": classSource("answer-owed"),
    "review-requested.ts": classSource("review-requested", { tierQuestion: "() => ({ text: \"t\", default: \"sonnet\", allowed: [\"sonnet\", \"opus\"] })" }),
    // Neither of these is a class file: the first would throw if it were imported, the second is not a module.
    "answer-owed.test.ts": "throw new Error(\"a test file was imported\");\n",
    "notes.md": "not a module\n",
  });
  const classes = await loadClasses(dir);
  assert.deepEqual([...classes.keys()].sort(), ["answer-owed", "review-requested"]);
  assert.equal(classes.get("answer-owed")?.cause, "answer-owed");
  assert.equal(typeof classes.get("review-requested")?.tierQuestion, "function");
  assert.equal(classes.get("answer-owed")?.tierQuestion, undefined);
});

test("POSITIVE CONTROL: a class that only the directory makes known is the whole of adding one", async () => {
  const empty = fixture({});
  assert.equal((await loadClasses(empty)).size, 0);
  const one = fixture({ "x.ts": classSource("x") });
  assert.deepEqual([...(await loadClasses(one)).keys()], ["x"]);
});

test("NEGATIVE CONTROL: an absent directory is no classes, not an error", async () => {
  const dir = join(ROOT, "classes-never-made");
  assert.equal((await loadClasses(dir)).size, 0);
});

test("NEGATIVE CONTROL: a default export that is not a class is refused by file name, and the good file beside it is not enough", async () => {
  const dir = fixture({ "good.ts": classSource("good"), "bad.ts": "export default { cause: \"bad\" };\n" });
  const err = await refusal(dir);
  assert.equal(err.file, "bad.ts");
  assert.ok(err.message.includes("bad.ts"));
});

test("NEGATIVE CONTROL: a module with no default export, and one exporting a string, are refused by file name", async () => {
  const none = await refusal(fixture({ "named-only.ts": "export const cls = 1;\n" }));
  assert.equal(none.file, "named-only.ts");
  const str = await refusal(fixture({ "string.ts": "export default \"answer-owed\";\n" }));
  assert.equal(str.file, "string.ts");
});

test("NEGATIVE CONTROL: each missing or mistyped field is its own refusal, and none repeats the content", async () => {
  const cases: [string, Record<string, string>][] = [
    ["cause", { cause: "7" }],
    ["schema", { schema: "\"not-an-object\"" }],
    ["allowed", { allowed: "[]" }],
    ["allowed", { allowed: "[1]" }],
    ["buildQuestion", { buildQuestion: "\"SECRET-VALUE\"" }],
    ["tierQuestion", { tierQuestion: "\"SECRET-VALUE\"" }],
    ["actionsFor", { actionsFor: "null" }],
  ];
  for (const [field, over] of cases) {
    const err = await refusal(fixture({ "c.ts": classSource("c", over) }));
    assert.equal(err.file, "c.ts", field);
    assert.ok(err.message.includes(`\`${field}\``), `${field}: ${err.message}`);
    assert.ok(!err.message.includes("SECRET-VALUE"), err.message);
  }
});

test("NEGATIVE CONTROL: a file that does not import is refused by file name", async () => {
  const err = await refusal(fixture({ "broken.ts": "export default {{{\n" }));
  assert.equal(err.file, "broken.ts");
});

test("NEGATIVE CONTROL: two classes for one cause are refused, naming the second file and the first", async () => {
  const err = await refusal(fixture({ "a-first.ts": classSource("same"), "b-second.ts": classSource("same") }));
  assert.equal(err.file, "b-second.ts");
  assert.ok(err.message.includes("b-second.ts") && err.message.includes("a-first.ts"), err.message);
});

test("whyNotClass: null for a class, a reason for everything else", () => {
  const ok = { cause: "c", schema: {}, allowed: ["a"], buildQuestion: () => null, actionsFor: () => [] };
  assert.equal(whyNotClass(ok), null);
  for (const value of [null, undefined, 3, [], { ...ok, cause: "" }]) assert.notEqual(whyNotClass(value), null, JSON.stringify(value));
});
