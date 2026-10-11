// no-token: none -- `exec` is a stub; nothing here spawns a process or reaches a tracker.
/**
 * agent-org#900: A DECISION RUN EXECUTES, AND EVERY FAILURE HAS A NAME.
 *
 * POSITIVE CONTROL: a well-formed result gives ok:true with the decision and the three usage numbers, and the argv carries every flag.
 * NEGATIVE CONTROL: non-zero exit, timeout, non-JSON, schema mismatch and bad caps are each ok:false with their reason, and none throws.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDecision, decisionRunArgv, checkAgainstSchema } from "./run.ts";
import type { DecisionRunInput, ExecOptions, ExecResult } from "./run.ts";

const SCHEMA = {
  type: "object", required: ["answer", "reason"], additionalProperties: false,
  properties: { answer: { type: "string", enum: ["merge", "hold"] }, reason: { type: "string" } },
};
const BRIEF = { prefix: "SHARED PREFIX\n=== BOUNDARY ===", dynamic: "DYNAMIC PART OF THIS RUN", boundary: "=== BOUNDARY ===" };
const INPUT: DecisionRunInput = { brief: BRIEF, schema: SCHEMA, tier: "sonnet", maxTurns: 3, maxBudgetUsd: 0.25, timeoutMs: 1000 };

const result = (over: Record<string, unknown> = {}): string => JSON.stringify({
  type: "result", subtype: "success", is_error: false, session_id: "run-1", total_cost_usd: 0.0048,
  usage: { cache_read_input_tokens: 22264, cache_creation_input_tokens: 110, input_tokens: 6, output_tokens: 222 },
  structured_output: { answer: "hold", reason: "r" }, ...over,
});

function stub(res: ExecResult | (() => Promise<ExecResult>)) {
  const calls: { argv: readonly string[]; options: ExecOptions }[] = [];
  const exec = async (argv: readonly string[], options: ExecOptions): Promise<ExecResult> => {
    calls.push({ argv, options });
    return typeof res === "function" ? res() : res;
  };
  return { exec, calls, deps: { exec, cwd: "/fixed/cwd" } };
}

test("POSITIVE CONTROL: a well-formed result is a decision with its usage, and argv carries every flag with the prefix and not the dynamic part", async () => {
  const s = stub({ exitCode: 0, stdout: result() });
  const got = await runDecision(INPUT, s.deps);
  assert.deepEqual(got, { ok: true, decision: { answer: "hold", reason: "r" }, runId: "run-1", usage: { cacheReadTokens: 22264, cacheCreationTokens: 110, costUsd: 0.0048 } });
  const { argv, options } = s.calls[0];
  const at = (flag: string) => argv[argv.indexOf(flag) + 1];
  assert.equal(at("--model"), "sonnet");
  assert.equal(at("--append-system-prompt"), BRIEF.prefix);
  assert.equal(at("--json-schema"), JSON.stringify(SCHEMA));
  assert.equal(at("--output-format"), "json");
  assert.equal(at("--max-turns"), "3");
  assert.equal(at("--max-budget-usd"), "0.25");
  assert.equal(at("--permission-prompts"), "none");
  assert.equal(at("--disallowedTools"), "AskUserQuestion");
  assert.ok(argv.includes("--exclude-dynamic-system-prompt-sections"));
  assert.ok(!argv.some((a) => a.includes(BRIEF.dynamic)), "the dynamic part goes on stdin, never in argv");
  assert.equal(options.stdin, BRIEF.dynamic);
  assert.equal(options.env.CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, "1");
  assert.equal(options.cwd, "/fixed/cwd");
});

test("NEGATIVE CONTROL: a non-zero exit is exit-nonzero", async () => {
  assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 1, stdout: "" }).deps), { ok: false, reason: "exit-nonzero" });
});

test("NEGATIVE CONTROL: an exec that rejects is exit-nonzero and does not throw", async () => {
  const deps = { cwd: "/x", exec: async () => { throw new Error("spawn ENOENT"); } };
  assert.deepEqual(await runDecision(INPUT, deps), { ok: false, reason: "exit-nonzero" });
});

test("NEGATIVE CONTROL: an exec that reports timedOut, or never returns, is timeout", async () => {
  assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 143, stdout: "", timedOut: true }).deps), { ok: false, reason: "timeout" });
  const hang = { cwd: "/x", exec: () => new Promise<ExecResult>(() => {}) };
  assert.deepEqual(await runDecision({ ...INPUT, timeoutMs: 20 }, hang), { ok: false, reason: "timeout" });
});

test("NEGATIVE CONTROL: text that is not JSON is unparseable, and a result with no structured output is too", async () => {
  assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 0, stdout: "I think merge." }).deps), { ok: false, reason: "unparseable" });
  assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 0, stdout: result({ structured_output: undefined }) }).deps), { ok: false, reason: "unparseable" });
});

test("NEGATIVE CONTROL: JSON that fails the schema is schema-mismatch (wrong type, outside the enum, missing field, extra field)", async () => {
  for (const bad of [{ answer: "hold", reason: 7 }, { answer: "close", reason: "r" }, { answer: "hold" }, { answer: "hold", reason: "r", extra: 1 }, "hold"]) {
    assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 0, stdout: result({ structured_output: bad }) }).deps), { ok: false, reason: "schema-mismatch" }, JSON.stringify(bad));
  }
});

test("NEGATIVE CONTROL: a budget stop is over-budget", async () => {
  const out = result({ subtype: "error_max_budget_usd", is_error: true, structured_output: undefined });
  assert.deepEqual(await runDecision(INPUT, stub({ exitCode: 1, stdout: out }).deps), { ok: false, reason: "over-budget" });
});

test("NEGATIVE CONTROL: a missing or non-positive cap is refused before exec is called", async () => {
  for (const caps of [{ maxTurns: 0 }, { maxTurns: -1 }, { maxTurns: undefined }, { maxBudgetUsd: 0 }, { maxBudgetUsd: Number.NaN }, { maxBudgetUsd: undefined }]) {
    const s = stub({ exitCode: 0, stdout: result() });
    const got = await runDecision({ ...INPUT, ...caps } as DecisionRunInput, s.deps);
    assert.deepEqual(got, { ok: false, reason: "over-budget" }, JSON.stringify(caps));
    assert.equal(s.calls.length, 0, "exec must not be called");
  }
  assert.throws(() => decisionRunArgv({ ...INPUT, maxTurns: 0 }));
});

test("a failure is never retried: exec is called once", async () => {
  const s = stub({ exitCode: 1, stdout: "" });
  await runDecision(INPUT, s.deps);
  assert.equal(s.calls.length, 1);
});

test("checkAgainstSchema: the enum check is not vacuous", () => {
  assert.equal(checkAgainstSchema(SCHEMA, { answer: "merge", reason: "r" }), null);
  assert.notEqual(checkAgainstSchema(SCHEMA, { answer: "nope", reason: "r" }), null);
});
