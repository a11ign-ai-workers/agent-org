// no-token: none -- the process is spawned only through the `exec` a caller injects; nothing here imports child_process, reads a file or reaches the tracker.
// agent-org#900 (Move 3 harness of a11ign/a11ign#4505): A DECISION RUN EXECUTES. A brief, a JSON schema and a tier go in; a parsed,
// schema-checked decision or a NAMED failure comes out.
//
// `decisionRunArgv` is the headless `claude -p` call. The brief's `prefix` is the system prompt (the byte-stable part leads, which is what the
// cache hits on) and its `dynamic` part is the prompt on STDIN, so it is never in argv. `runDecision` runs it through an injected `exec` under a
// wall-clock timeout and NEVER THROWS and NEVER RETRIES: a retry is a second copy of a run, and what a failure means is the caller's to decide.
//
// The flags were checked against `claude --help` 2.1.296 and one real `--output-format json --json-schema` call (its result is read below as it
// came: `structured_output`, `usage.cache_read_input_tokens`, `usage.cache_creation_input_tokens`, `total_cost_usd`, `session_id`, `subtype`,
// `is_error`). `--max-turns` is accepted by 2.1.296 but is not listed by `--help`; the real call ran with it.
import type { Brief } from "./brief.ts";

/** A JSON schema as far as {@link checkAgainstSchema} reads one: type, enum, const, required, properties, items, additionalProperties. */
export type JsonSchema = Readonly<Record<string, unknown>>;

export type DecisionRunInput = Readonly<{
  brief: Brief;
  schema: JsonSchema;
  /** The model tier handed to `--model`. */
  tier: string;
  maxTurns: number;
  maxBudgetUsd: number;
  timeoutMs: number;
}>;

export type ExecOptions = Readonly<{ stdin: string; env: Readonly<Record<string, string>>; cwd: string; timeoutMs: number }>;
export type ExecResult = Readonly<{ exitCode: number; stdout: string; timedOut?: boolean }>;
export type DecisionRunDeps = Readonly<{
  /** Runs `claude` with `argv`. May reject; a rejection is `exit-nonzero`. */
  exec: (argv: readonly string[], options: ExecOptions) => Promise<ExecResult>;
  /** The fixed working directory every decision run starts in. */
  cwd: string;
}>;

export type DecisionFailure = "timeout" | "exit-nonzero" | "unparseable" | "schema-mismatch" | "over-budget";
export type DecisionRunResult =
  | Readonly<{ ok: true; decision: unknown; runId: string; usage: Readonly<{ cacheReadTokens: number; cacheCreationTokens: number; costUsd: number }> }>
  | Readonly<{ ok: false; reason: DecisionFailure }>;

/** The env a decision run adds: no git instructions in the system prompt, which would vary by checkout and break the cache. */
export const DECISION_RUN_ENV: Readonly<Record<string, string>> = { CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS: "1" };

const isPositive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const capsValid = (input: DecisionRunInput): boolean =>
  isPositive(input.maxTurns) && Number.isInteger(input.maxTurns) && isPositive(input.maxBudgetUsd) && isPositive(input.timeoutMs);

/** The argv of the headless call, without the executable. Throws on a cap that is missing or not positive, as `headlessClaudeArgs` does. */
export function decisionRunArgv(input: DecisionRunInput): string[] {
  if (!capsValid(input)) throw new Error(`decision run caps must be positive (maxTurns a whole number): maxTurns=${input.maxTurns} maxBudgetUsd=${input.maxBudgetUsd} timeoutMs=${input.timeoutMs}`);
  return ["-p", "--model", input.tier,
    "--append-system-prompt", input.brief.prefix,
    "--json-schema", JSON.stringify(input.schema),
    "--output-format", "json",
    "--max-turns", String(input.maxTurns), "--max-budget-usd", String(input.maxBudgetUsd),
    "--permission-prompts", "none",
    "--exclude-dynamic-system-prompt-sections",
    "--disallowedTools", "AskUserQuestion"];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function typeMatches(type: string, value: unknown): boolean {
  switch (type) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    case "array": return Array.isArray(value);
    case "object": return isRecord(value);
    default: return false; // an unknown type name is not satisfied: a schema this check cannot read must not pass a decision
  }
}

/** A small structural check of `value` against `schema`. Returns the first problem, or null when it conforms. */
export function checkAgainstSchema(schema: unknown, value: unknown, path = "$"): string | null {
  if (!isRecord(schema)) return null;
  const { type, enum: allowed, const: constant, required, properties, items, additionalProperties } = schema;
  if (type !== undefined) {
    const types = Array.isArray(type) ? type : [type];
    if (!types.some((t) => typeof t === "string" && typeMatches(t, value))) return `${path}: expected ${types.join("|")}`;
  }
  if (Array.isArray(allowed) && !allowed.some((a) => JSON.stringify(a) === JSON.stringify(value))) return `${path}: not one of the allowed values`;
  if ("const" in schema && JSON.stringify(constant) !== JSON.stringify(value)) return `${path}: not the const value`;
  if (isRecord(value)) {
    if (Array.isArray(required)) for (const key of required) if (typeof key === "string" && !(key in value)) return `${path}.${key}: required and missing`;
    const props = isRecord(properties) ? properties : {};
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) { const bad = checkAgainstSchema(sub, value[key], `${path}.${key}`); if (bad) return bad; }
    }
    if (additionalProperties === false) for (const key of Object.keys(value)) if (!(key in props)) return `${path}.${key}: not an allowed property`;
  }
  if (Array.isArray(value) && isRecord(items)) {
    for (let i = 0; i < value.length; i += 1) { const bad = checkAgainstSchema(items, value[i], `${path}[${i}]`); if (bad) return bad; }
  }
  return null;
}

const failure = (reason: DecisionFailure): DecisionRunResult => ({ ok: false, reason });
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Runs one decision. Never throws, never retries. */
export async function runDecision(input: DecisionRunInput, deps: DecisionRunDeps): Promise<DecisionRunResult> {
  // A cap that is missing or not positive is refused BEFORE `exec`, and it is `over-budget`: there is no budget to run inside.
  if (!capsValid(input)) return failure("over-budget");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const argv = decisionRunArgv(input);
    const options: ExecOptions = { stdin: input.brief.dynamic, env: DECISION_RUN_ENV, cwd: deps.cwd, timeoutMs: input.timeoutMs };
    const deadline = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), input.timeoutMs); });
    const got = await Promise.race([deps.exec(argv, options), deadline]);
    if (got === "timeout" || got.timedOut === true) return failure("timeout");
    let parsed: unknown;
    try { parsed = JSON.parse(got.stdout); } catch { parsed = undefined; }
    // `claude` reports a budget stop as a result whose `subtype` names it, and exits non-zero; read the body first so that case keeps its name.
    if (isRecord(parsed) && parsed.subtype === "error_max_budget_usd") return failure("over-budget");
    if (got.exitCode !== 0) return failure("exit-nonzero");
    if (!isRecord(parsed)) return failure("unparseable");
    if (parsed.is_error === true) return failure("exit-nonzero");
    const decision = parsed.structured_output;
    if (decision === undefined) return failure("unparseable");
    if (checkAgainstSchema(input.schema, decision) !== null) return failure("schema-mismatch");
    const usage = isRecord(parsed.usage) ? parsed.usage : {};
    return {
      ok: true, decision,
      runId: typeof parsed.session_id === "string" ? parsed.session_id : "",
      usage: { cacheReadTokens: count(usage.cache_read_input_tokens), cacheCreationTokens: count(usage.cache_creation_input_tokens), costUsd: count(parsed.total_cost_usd) },
    };
  } catch {
    return failure("exit-nonzero"); // `exec` rejected: the process could not be run at all
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
