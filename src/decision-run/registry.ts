// no-token: none -- imports the class modules in a directory it is handed; nothing here spawns a process or reaches the tracker.
// agent-org#902 (Move 3 option of a11ign/a11ign#4505): THE CLASSES A DECISION RUN CAN SERVE, ONE FILE EACH.
//
// A class is a FILE in `src/decision-run/classes/` whose default export is a {@link DecisionClass}, so adding one touches no line another class
// lives on. `loadClasses(dir)` imports every non-test `*.ts` there and returns them by cause. It REFUSES, naming the file, a module whose default
// export is not a class, a file that cannot be imported, and a second class for a cause one file already holds: a class that is half-registered
// would be served by the wrong brief, and a refusal is what the caller's fall-back to the standing seat (`seat-mode.ts`) is for.
//
// This row adds no class (`classes/` does not exist yet, and an absent directory is no classes) and no caller.
//
// The one `import()` here is of a computed path, which the declaring guards refuse in THEIR import closure (`lib/walk-scope.ts`): no declaring guard
// imports this file, and one that did would be refused there.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { ItemRef, StateChange, TicketPort } from "../ticket-port/port.ts";
import type { BriefQuestion } from "./brief.ts";
import type { JsonSchema } from "./run.ts";

/** The part of a gate order a class reads: the cause it is woken for and who it was addressed to. `GateOrder` and `shadow-gate`'s `Order` both satisfy it. */
export type DecisionOrder = Readonly<{ causeKey: string; cause?: string; session?: string; subject?: string; discriminator?: string; prompt?: string }>;

/** What a decision turns into, applied by the caller through the ticket port; the class never writes anything itself. */
export type DecisionAction =
  | Readonly<{ type: "post"; item: ItemRef; kind: string; text: string }>
  | Readonly<{ type: "change"; item: ItemRef; change: StateChange }>;

export type DecisionClass = Readonly<{
  /** The wake cause this class serves, as `seats.json` names it. */
  cause: string;
  /** The JSON schema the run's answer is checked against (`runDecision`). */
  schema: JsonSchema;
  /** The answers the class permits. */
  allowed: readonly string[];
  /** The question for this order, built from the item as the port reads it. */
  buildQuestion(order: DecisionOrder, port: Pick<TicketPort, "readItem">): BriefQuestion;
  /** When present, the question that picks the model tier for this order; a class without one runs at the caller's default tier. */
  tierQuestion?(order: DecisionOrder, port: Pick<TicketPort, "readItem">): BriefQuestion;
  /** What a schema-checked answer asks to be done. An answer outside `allowed` is the class's to turn into no action. */
  actionsFor(answer: unknown, order: DecisionOrder): readonly DecisionAction[];
}>;

/** A class file that was refused, and the file's name: the caller serves the cause by its standing seat. */
export class DecisionClassError extends Error {
  readonly file: string;
  constructor(file: string, why: string) {
    super(`decision class refused: ${file}: ${why}`);
    this.name = "DecisionClassError";
    this.file = file;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Why `value` is not a {@link DecisionClass}, naming the field and never its content, or `null` when it is one. */
export function whyNotClass(value: unknown): string | null {
  if (!isRecord(value)) return "the export is not an object";
  if (typeof value.cause !== "string" || value.cause === "") return "`cause` is not a non-empty string";
  if (!isRecord(value.schema)) return "`schema` is not an object";
  if (!Array.isArray(value.allowed) || value.allowed.length === 0 || value.allowed.some((a) => typeof a !== "string")) return "`allowed` is not a non-empty array of strings";
  if (typeof value.buildQuestion !== "function") return "`buildQuestion` is not a function";
  if (value.tierQuestion !== undefined && typeof value.tierQuestion !== "function") return "`tierQuestion` is present and is not a function";
  if (typeof value.actionsFor !== "function") return "`actionsFor` is not a function";
  return null;
}

const isClassFile = (name: string): boolean => name.endsWith(".ts") && !name.endsWith(".test.ts") && !name.endsWith(".d.ts");

/**
 * Every class in `dir`, by cause. An absent directory is no classes. Files are imported in name order, so which file a duplicate is reported against
 * is the same on every machine. Throws {@link DecisionClassError} on the first file that cannot be a class.
 */
export async function loadClasses(dir: string): Promise<ReadonlyMap<string, DecisionClass>> {
  let names: string[];
  try {
    names = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile() && isClassFile(e.name)).map((e) => e.name).sort();
  } catch (err) {
    if ((err as { code?: string })?.code === "ENOENT") return new Map();
    throw err;
  }
  const classes = new Map<string, DecisionClass>();
  const fileOf = new Map<string, string>();
  for (const name of names) {
    let exported: unknown;
    try {
      exported = (await import(pathToFileURL(join(dir, name)).href) as { default?: unknown }).default;
    } catch (err) {
      throw new DecisionClassError(name, `it could not be imported (${err instanceof Error ? err.message : "not an Error"})`);
    }
    const why = whyNotClass(exported);
    if (why !== null) throw new DecisionClassError(name, `its default export is not a DecisionClass: ${why}`);
    const cls = exported as DecisionClass;
    const first = fileOf.get(cls.cause);
    if (first !== undefined) throw new DecisionClassError(name, `the cause ${JSON.stringify(cls.cause)} is already served by ${first}`);
    fileOf.set(cls.cause, name);
    classes.set(cls.cause, cls);
  }
  return classes;
}
