/**
 * ONE SPEC WRITER PRODUCES EVERY BUILD SPEC (a11ign#5116, the Haiku push). When product-manager marks a build row `needs-spec`, a one-shot
 * Sonnet run turns the intent into the spec block (a11ign#5109) and the tests, and this module is what stands between that run and
 * `ready`: THE TESTS MUST FAIL ON MAIN, their failing output is recorded as `errors:`, and only then is the row promoted.
 *
 * Why the proof is the gate and not the model's say-so: a test oracle took Haiku from 3/12 to 11/12, and an oracle that already passes
 * specifies no behaviour change, so a worker handed it can claim "done" having changed nothing. Refusing it here costs one run; finding it
 * at review costs a worker's whole turn.
 *
 * Every effect is injected (the model call, the test run, the commit, the promotion), so the order is pinned by `spec-writer.test.ts` and
 * the module reaches neither `gh` nor a model itself. Behind `rows.specWriter` in `.agent-org/project.json`, absent meaning OFF; revert is
 * the flag off, and product-manager writes specs by hand.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_DECLARATION_PATH } from "./project-config.ts";

/** The prompt is fixed and versioned in the repository, and this is the ONLY place it is read from: no built-in copy, no default. */
export const SPEC_WRITER_PROMPT_PATH = ".agent-org/roles/spec-writer.md";
/** The chairman's target for one run, in US dollars; a run over it is reported, not refused. */
export const SPEC_WRITER_COST_TARGET_USD = 0.3;
const MIN_EXAMPLES = 3;
const MAX_EXAMPLES = 5;
const EXAMPLE_HEADING = /^### Example \d+/gm;
/** `errors:` goes into a row body; a test runner's whole log would bury the spec it sits beside. */
const MAX_ERRORS_CHARS = 4000;

export type SpecDraft = { spec: string; testFiles: string[]; run: string; costUsd?: number };
export type TestRun = { exitCode: number | null; output: string };
export type Proof =
  | { status: "failing"; errors: string }
  | { status: "refused"; reason: string }
  | { status: "cannot-ask"; reason: string };
export type SpecResult =
  | { status: "promoted"; errors: string; overBudget: boolean }
  | { status: "refused"; reason: string }
  | { status: "skipped"; reason: string }
  | { status: "cannot-ask"; reason: string };

/** `rows.specWriter` of a project declaration's TEXT: on only when exactly `true`, so absent, unreadable and mistyped are all OFF. */
export function specWriterFlagOf(declarationText: string): boolean {
  try {
    return JSON.parse(declarationText)?.rows?.specWriter === true;
  } catch (cause) {
    void cause; // not JSON is not a declaration that turned the flag on; the declaration reader refuses it where it matters
    return false;
  }
}

/** The flag as this checkout's declaration says it. A checkout with no declaration is a project that never declared it: OFF. */
export function readSpecWriterFlag(checkout: string): boolean {
  try {
    return specWriterFlagOf(readFileSync(join(checkout, PROJECT_DECLARATION_PATH), "utf8"));
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw new Error(`cannot read ${PROJECT_DECLARATION_PATH}`, { cause });
  }
}

/** The prompt file's text, or the reason there is none. An absent or example-less file refuses; it is never replaced by a built-in prompt. */
export function readSpecWriterPrompt(checkout: string): { ok: true; prompt: string } | { ok: false; reason: string } {
  let prompt: string;
  try {
    prompt = readFileSync(join(checkout, SPEC_WRITER_PROMPT_PATH), "utf8");
  } catch (cause) {
    return { ok: false, reason: `the spec writer's prompt ${SPEC_WRITER_PROMPT_PATH} cannot be read (${(cause as Error).message}); there is no built-in prompt` };
  }
  const examples = (prompt.match(EXAMPLE_HEADING) ?? []).length;
  if (examples < MIN_EXAMPLES || examples > MAX_EXAMPLES) {
    return { ok: false, reason: `${SPEC_WRITER_PROMPT_PATH} carries ${examples} examples; the spec writer's prompt holds ${MIN_EXAMPLES}–${MAX_EXAMPLES} examples of rows Haiku merged first time` };
  }
  return { ok: true, prompt };
}

function bounded(output: string): string {
  if (output.length <= MAX_ERRORS_CHARS) return output;
  return `${output.slice(0, MAX_ERRORS_CHARS)}\n… (truncated from ${output.length} characters)`;
}

/** What one run of the row's tests on main says. Exit 0 is a passing oracle; a run with no exit code or no output is unread, not red. */
export function proveTestsFail(reading: TestRun): Proof {
  if (reading.exitCode === null || reading.output.trim() === "") {
    return { status: "cannot-ask", reason: "the tests' run on main gave no exit code or no output, so it is neither failing nor passing" };
  }
  if (reading.exitCode === 0) {
    return { status: "refused", reason: "the tests pass on main: no behaviour change specified" };
  }
  return { status: "failing", errors: bounded(reading.output) };
}

export type WriteSpecInput = {
  row: number;
  intent: string;
  checkout: string;
  enabled: boolean;
  generate: (prompt: string, intent: string) => SpecDraft | Promise<SpecDraft>;
  runOnMain: (command: string) => TestRun | Promise<TestRun>;
  commitTests: (files: string[]) => void | Promise<void>;
  promote: (spec: { row: number; spec: string; errors: string }) => void | Promise<void>;
  refuse: (reason: string) => void | Promise<void>;
};

function draftFault(draft: SpecDraft): string | null {
  if (draft.testFiles.length === 0) return "the draft names no test file";
  if (draft.run.trim() === "") return "the draft names no command that runs the tests";
  return null;
}

/** The whole run, in the order that matters: prompt, draft, proof on main, THEN the tests are committed and the row promoted. */
export async function writeSpec(input: WriteSpecInput): Promise<SpecResult> {
  if (!input.enabled) return { status: "skipped", reason: "rows.specWriter is off: product-manager writes the spec by hand" };
  const prompt = readSpecWriterPrompt(input.checkout);
  if (!prompt.ok) return refused(input, prompt.reason);
  const draft = await input.generate(prompt.prompt, input.intent);
  const fault = draftFault(draft);
  if (fault) return refused(input, `#${input.row}: ${fault}`);
  const proof = proveTestsFail(await input.runOnMain(draft.run));
  if (proof.status === "cannot-ask") return proof;
  if (proof.status === "refused") return refused(input, `#${input.row}: ${proof.reason}`);
  await input.commitTests(draft.testFiles);
  await input.promote({ row: input.row, spec: draft.spec, errors: proof.errors });
  return { status: "promoted", errors: proof.errors, overBudget: (draft.costUsd ?? 0) > SPEC_WRITER_COST_TARGET_USD };
}

async function refused(input: WriteSpecInput, reason: string): Promise<SpecResult> {
  await input.refuse(reason);
  return { status: "refused", reason };
}
