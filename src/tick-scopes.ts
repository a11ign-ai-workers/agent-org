/**
 * The tick's scopes (a11ign/a11ign#5043, design item 3): WHICH PULL REQUESTS, ISSUES AND COMMITS THE TICK'S EVENTS NAMED, handed from the tick to the gate.
 *
 * The tick reads the event queue (`event-queue.ts`) and the gate is a fresh process, so what the events named has to cross on disk. A scope is
 * what `scopesOf(events)` returns, in first-seen order, one per pull request. NOTHING CALLS THIS YET: the wiring is a later row, so this module is
 * pure apart from the one file it is handed.
 *
 * `null` MEANS "NOT KNOWN" AND `[]` MEANS "THE EVENTS NAMED NOTHING", and the two are never one value: a reader that turned a missing or half-written
 * file into `[]` would tell the gate that nothing changed, and it would serve the remembered list as current. A caller that gets `null` reads whole.
 * For the same reason a failed WRITE throws rather than being said on stderr: the file left behind would be the PREVIOUS tick's scopes, which read
 * back fine and are the wrong ones.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Scope } from "./event-queue.ts";

const VERSION = 1;
const NUMBERED = ["pr", "issue"];
const COMMITTED = ["sha", "merge-group"];

const isScope = (value: unknown): value is Scope => {
  if (typeof value !== "object" || value === null) return false;
  const { repo, kind, number, sha } = value as Record<string, unknown>;
  if (typeof repo !== "string" || repo === "") return false;
  if (NUMBERED.includes(kind as string)) return Number.isInteger(number);
  return COMMITTED.includes(kind as string) && typeof sha === "string" && sha !== "";
};

/** The scope with only its own fields, so a caller's extra properties are not stored. */
const plain = (scope: Scope): Scope => ("number" in scope ? { repo: scope.repo, kind: scope.kind, number: scope.number } : { repo: scope.repo, kind: scope.kind, sha: scope.sha });

/**
 * Writes the whole file to a sibling and renames it over, so a reader sees the old scopes or the new ones, never half of either. Throws on a value
 * that is not a scope, and on a disk that refuses the write (see the header for why that is not swallowed).
 */
export function writeTickScopes({ path, scopes }: { path: string; scopes: readonly Scope[]; }): void {
  const bad = scopes.find((scope) => !isScope(scope));
  if (bad !== undefined) throw new TypeError(`writeTickScopes: not a scope: ${JSON.stringify(bad)}`);
  mkdirSync(dirname(path), { recursive: true });
  const partial = `${path}.${process.pid}.tmp`;
  writeFileSync(partial, `${JSON.stringify({ version: VERSION, scopes: scopes.map(plain) })}\n`);
  renameSync(partial, path);
}

/** @returns the scopes as written, `[]` for a tick whose events named nothing, and `null` for a missing, unreadable or malformed file. Never throws. */
export function readTickScopes(path: string): Scope[] | null {
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    if (parsed?.version !== VERSION || !Array.isArray(parsed.scopes) || !parsed.scopes.every(isScope)) return null;
    return (parsed.scopes as Scope[]).map(plain);
  } catch {
    return null;
  }
}
