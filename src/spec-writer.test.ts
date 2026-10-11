// no-token: gh -- every input is injected (the prompt file's reader, the model call, the test run, the promotion); nothing reaches `gh`.
/**
 * ONE SPEC WRITER PRODUCES EVERY BUILD SPEC (a11ign#5116, the Haiku push): a one-shot Sonnet run turns product-manager's intent into the
 * row's spec block and the tests, PROVES THE TESTS FAIL ON MAIN, records that failing output as `errors:`, and only then promotes the row.
 *
 * Why the proof is the gate: Haiku went 3/12 to 11/12 with a test oracle, and an oracle that already passes is not one -- it specifies no
 * behaviour change, so a worker handed it can claim "done" having changed nothing.
 *
 * Behind `rows.specWriter` in `.agent-org/project.json`, absent meaning OFF; every refusal below has a twin on the same fixture that is
 * promoted, so a refusal that fires always cannot pass.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SPEC_WRITER_PROMPT_PATH, specWriterFlagOf, readSpecWriterPrompt, proveTestsFail, writeSpec, type SpecDraft,
} from "./spec-writer.ts";

const RED = { exitCode: 1, output: "not ok 1 - a refused claim names the row\n  AssertionError: expected a reason, got null" };
const GREEN = { exitCode: 0, output: "ok 1 - a refused claim names the row" };

const DRAFT: SpecDraft = {
  spec: "files: src/row-claim.ts\nbehaviour: a claim of a row with no Region is refused\nrun: npx rstest run src/row-claim.test.ts",
  testFiles: ["src/row-claim.test.ts"],
  run: "npx rstest run src/row-claim.test.ts",
};

const EXAMPLE = (n: number) => `### Example ${n}\n\nspec: ...\n`;
const promptText = (examples: number) => `# Spec writer\n\nWrite the spec.\n\n## Examples\n\n${Array.from({ length: examples }, (_, i) => EXAMPLE(i + 1)).join("\n")}`;

const made: string[] = [];
after(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });

function checkoutWith(prompt: string | null): string {
  const root = mkdtempSync(join(tmpdir(), "spec-writer-"));
  made.push(root);
  if (prompt !== null) {
    mkdirSync(join(root, ".agent-org/roles"), { recursive: true });
    writeFileSync(join(root, SPEC_WRITER_PROMPT_PATH), prompt);
  }
  return root;
}

// --- THE FLAG: ABSENT IS OFF ---------------------------------------------------------------------------------------------------

test("`rows.specWriter` is on only when exactly true; absent, false, a string and unreadable text are all off", () => {
  assert.equal(specWriterFlagOf(JSON.stringify({ schema: 1, rows: { specWriter: true } })), true);
  for (const text of [JSON.stringify({ schema: 1 }), JSON.stringify({ rows: {} }), JSON.stringify({ rows: { specWriter: false } }),
    JSON.stringify({ rows: { specWriter: "true" } }), JSON.stringify({ rows: null }), "not json", ""]) {
    assert.equal(specWriterFlagOf(text), false, text);
  }
});

// --- DONE-WHEN 1c: THE PROMPT FILE IS THE ONLY PROMPT SOURCE ----------------------------------------------------------------------

test("DONE-WHEN 1c: the prompt is the file's text, read from the declared path, and nothing else", () => {
  const text = promptText(3);
  const read = readSpecWriterPrompt(checkoutWith(text));
  assert.deepEqual(read, { ok: true, prompt: text });
  assert.equal(SPEC_WRITER_PROMPT_PATH, ".agent-org/roles/spec-writer.md");
});

test("DONE-WHEN 1c: no prompt file is a refusal that names the path, never a built-in prompt", () => {
  const read = readSpecWriterPrompt(checkoutWith(null));
  assert.equal(read.ok, false);
  assert.match((read as { reason: string }).reason, /\.agent-org\/roles\/spec-writer\.md/);
});

test("the prompt carries three to five examples: two and six are refused, three and five are read", () => {
  for (const n of [2, 6]) {
    const read = readSpecWriterPrompt(checkoutWith(promptText(n)));
    assert.equal(read.ok, false, `${n} examples`);
    assert.match((read as { reason: string }).reason, /3.5 examples/);
  }
  for (const n of [3, 5]) assert.equal(readSpecWriterPrompt(checkoutWith(promptText(n))).ok, true, `${n} examples`);
});

// --- DONE-WHEN 1a / 1b: THE TESTS MUST FAIL ON MAIN ---------------------------------------------------------------------------

test("DONE-WHEN 1a: tests that PASS on main are refused as `no behaviour change specified`", () => {
  const verdict = proveTestsFail(GREEN);
  assert.equal(verdict.status, "refused");
  assert.match((verdict as { reason: string }).reason, /no behaviour change specified/);
});

test("DONE-WHEN 1b: tests that FAIL on main are proved, and their output is what `errors:` will carry", () => {
  const verdict = proveTestsFail(RED);
  assert.deepEqual(verdict, { status: "failing", errors: RED.output });
});

test("a run that could not be read (killed, no exit code, no output) is CANNOT_ASK, never failing and never passing", () => {
  for (const reading of [{ exitCode: null, output: "" }, { exitCode: 1, output: "" }, { exitCode: null, output: "partial" }]) {
    assert.equal(proveTestsFail(reading).status, "cannot-ask", JSON.stringify(reading));
  }
});

test("a very long failing output is cut to a bounded `errors:` and says so", () => {
  const verdict = proveTestsFail({ exitCode: 1, output: "x".repeat(20000) });
  assert.equal(verdict.status, "failing");
  const errors = (verdict as { errors: string }).errors;
  assert.ok(errors.length < 6000, "bounded");
  assert.match(errors, /truncated/);
});

// --- THE RUN: ORDER IS THE POINT -----------------------------------------------------------------------------------------------

function harness(over: { flag?: boolean; reading?: { exitCode: number | null; output: string }; prompt?: string | null } = {}) {
  const calls: string[] = [];
  const root = checkoutWith(over.prompt === undefined ? promptText(3) : over.prompt);
  return {
    calls,
    run: () => writeSpec({
      row: 5116,
      intent: "refuse a claim of a row with no Region",
      checkout: root,
      enabled: over.flag ?? true,
      generate: (prompt: string, intent: string) => { calls.push(`generate:${prompt === promptText(3)}:${intent.length > 0}`); return DRAFT; },
      runOnMain: (command: string) => { calls.push(`run:${command}`); return over.reading ?? RED; },
      commitTests: (files: string[]) => { calls.push(`commit:${files.join(",")}`); },
      promote: (spec: { errors: string; }) => { calls.push(`promote:${spec.errors.length > 0}`); },
      refuse: (reason: string) => { calls.push(`refuse:${reason}`); },
    }),
  };
}

test("DONE-WHEN 1b: failing tests are committed, the run is recorded, and only then is the row promoted", async () => {
  const h = harness();
  const result = await h.run();
  assert.equal(result.status, "promoted");
  assert.deepEqual(h.calls, ["generate:true:true", `run:${DRAFT.run}`, "commit:src/row-claim.test.ts", "promote:true"]);
});

test("DONE-WHEN 1a: passing tests are never committed or promoted; the row is refused with the reason", async () => {
  const h = harness({ reading: GREEN });
  const result = await h.run();
  assert.equal(result.status, "refused");
  assert.equal(h.calls.some((c) => c.startsWith("commit:") || c.startsWith("promote:")), false);
  assert.match(h.calls.at(-1) as string, /^refuse:.*no behaviour change specified/);
});

test("flag off: nothing is generated, run, committed or promoted -- product-manager writes specs by hand", async () => {
  const h = harness({ flag: false });
  assert.equal((await h.run()).status, "skipped");
  assert.deepEqual(h.calls, []);
});

test("no prompt file: the model is never called and the row is refused", async () => {
  const h = harness({ prompt: null });
  assert.equal((await h.run()).status, "refused");
  assert.equal(h.calls.some((c) => c.startsWith("generate:")), false);
});

test("a draft with no test file, or with no run command, is refused before anything is run", async () => {
  for (const bad of [{ ...DRAFT, testFiles: [] }, { ...DRAFT, run: "" }]) {
    const calls: string[] = [];
    const result = await writeSpec({
      row: 5116, intent: "x", checkout: checkoutWith(promptText(3)), enabled: true,
      generate: () => bad, runOnMain: (c) => { calls.push(c); return RED; },
      commitTests: () => { calls.push("commit"); }, promote: () => { calls.push("promote"); }, refuse: () => {},
    });
    assert.equal(result.status, "refused");
    assert.deepEqual(calls, []);
  }
});
