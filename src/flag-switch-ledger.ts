// module: the flags the code ships OFF that nobody set -- the "merged but off" count (agent-org#1135, class `hand-reroute`, parent a11ign#4437)
//
// CODE MERGED BEHIND A FLAG IS OFF WHEN THE FLAG IS ABSENT, AND NOTHING NOTICED THAT A11IGN NEVER SET IT. Four times in two days: `routing.question` (a11ign#4953), the scheduler identity
// (a11ign#4906), the Haiku flags (a11ign#5138) and `rows.autoUnpark` (a11ign#5194) each shipped, each stayed off, and each was found by a human flipping the switch hours later
// (a11ign#5041, #5139 and #5195 are the three genuine `hand-reroute` events of the ledger's 36). The chairman's rule (a11ign#928, 2026-10-12) is that a flagged change ships with
// its a11ign switch row, filed at the same time; it is a rule `product-manager` reads at filing, and "org-health counts violations" had no code behind it. THIS IS THE COUNT.
//
// THE REGISTRY IS THE CODE'S OWN, as `machinery-flag.ts` uses it: every `export const <NAME>_FLAG = "<group>.<name>"` in a non-test file of `src/`. A flag is DECIDED when its dotted key
// is a boolean in one of the project's declaration files, under `.agent-org/` (`project.json`, `decisions.json`, `seats.json`) or the host's (`host.json`), written either nested
// (`{ "workers": { "haikuBrief": false } }`) or flat (`{ "routing.haikuDefault": true }`), the two shapes the declarations already carry. `false` IS A DECISION: a flag the org looked at
// and left off is not the violation, and ABSENT is. No a11ign row is required to exist -- the declaration is what the code reads, and a row is only the means of writing it.
//
// A DECLARATION THAT CANNOT BE READ MAKES THE WHOLE ANSWER UNKNOWN, never a list: a flag looked for in a file that did not parse would be reported unset on no evidence, which is a false
// work list handed to the one session that acts on it. An OPTIONAL file that is simply not there (`seats.json` in a project with no seats) holds no key and is not a fault; `project.json` and `host.json` are required, and a missing one is a wrong path, which is unknown too.
//
// A LEAF: it reads files and one `git log` per unset flag and runs no tick; `org-health.ts` turns its answer into a reading.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sandboxGitEnv } from "./lib/git-env.ts";
import { hostConfigPath } from "./host-config.ts";
import { HOME_CHECKOUT } from "./project-config.ts";

/** The tool's root by this file's own location (`org-health.ts`'s `TOOL_ROOT`): the registry is read from the code that is running, not from the project's tree. */
const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The project's declaration files under `.agent-org/`; the host's `host.json` is read from `hostConfigPath()`, which `$AGENT_ORG_HOST` may move. */
export const PROJECT_DECLARATIONS: readonly string[] = Object.freeze(["project.json", "decisions.json", "seats.json"]);
/** The declarations a project may not have: `decisions.json` is absent for a project that switches nothing (`decision-provider.ts` reads absent as off) and `seats.json` for one with no seats. */
const OPTIONAL_DECLARATIONS: readonly string[] = Object.freeze(["decisions.json", "seats.json"]);

/**
 * FLAGS A DECLARATION FILE IS NOT WHERE THEY ARE SWITCHED, each with the reason. These are not exempt from being decided; their decision lives elsewhere, and a missing key in a
 * declaration is no evidence about them. The test pins this map to `machinery-flag.ts`'s `FLAG_REGISTRY`, so a fourth machinery flag is a red test and not a silent entry.
 */
export const FLAGS_WITH_ANOTHER_HOME: Readonly<Record<string, string>> = Object.freeze({
  "queue.reenqueueEjected": "switched by `machinery:flag` (agent-org#1061), which writes the canary state and not a declaration file",
  "queue.chainWaitWake": "switched by `machinery:flag` (agent-org#1061), which writes the canary state and not a declaration file",
  "rows.closedUnderOpenHalf": "switched by `machinery:flag` (agent-org#1061), which writes the canary state and not a declaration file",
  "rows.autoUnpark": "switched by `machinery:flag` (agent-org#1161), which writes the canary state and not a declaration file",
  "queue.queueEntryNoRun": "switched by `machinery:flag` (agent-org#1195), which writes the canary state and not a declaration file",
  "holds.recheck": "switched by `machinery:flag` (agent-org#1187), which writes the canary state and not a declaration file",
  "prune.holdOpenPr": "switched by `machinery:flag` (agent-org#1221), which writes the canary state and not a declaration file",
  "messaging.refuseAskingAnnouncements": "switched by `machinery:flag` (agent-org#1222), which writes the canary state and not a declaration file",
});

/** `export const AUTO_UNPARK_FLAG = "rows.autoUnpark"`: the shape the row's open-check greps, with a digit allowed after the first letter so `queue.reenqueue2` is not skipped. */
const FLAG_DECLARATION = /^export const ([A-Z][A-Z0-9_]*_FLAG)(?::\s*string)?\s*=\s*"([a-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*)"/gm;

export type ShippedFlag = { name: string; key: string; file: string; };
export type UnsetFlag = ShippedFlag & {
  /** The date of the merge commit on the first-parent line that added the key, or `null` when git could not say (no history, or the file moved). */
  mergedAt: string | null;
  /** That merge's pull request number, or `null` under the same conditions. */
  pr: number | null;
};
/** What the tick reads: `unset` is the violation, and `unknown` is a read that could not be made (never an empty `unset`). */
export type FlagLedger = { shipped: number; unset: UnsetFlag[]; } | { unknown: string; };

/** @returns every non-test `.ts` or `.mjs` under `dir`, as paths relative to `root`; `node_modules` and `fixtures` are not source */
function sourcesUnder(dir: string, root: string, list: (dir: string) => { name: string; directory: boolean; }[]): string[] {
  return list(dir).flatMap(({ name, directory }) => {
    const path = join(dir, name);
    if (directory) return name === "node_modules" || name === "fixtures" ? [] : sourcesUnder(path, root, list);
    return /\.(ts|mjs)$/.test(name) && !name.includes(".test.") ? [relative(root, path)] : [];
  });
}

const listDirectory = (dir: string) => readdirSync(dir, { withFileTypes: true }).map((entry) => ({ name: entry.name, directory: entry.isDirectory() }));

/**
 * THE FLAGS THE CODE SHIPS: one per `*_FLAG` constant naming a dotted key, sorted by key. A key declared in two files is one flag, named for its first file in path order.
 * @param toolRoot the tool's root, whose `src/` is walked
 * @returns the flags, or `null` when `src/` cannot be listed
 */
export function discoverFlags({ toolRoot = TOOL_ROOT, read = (path) => readFileSync(path, "utf8"), list = listDirectory }: { toolRoot?: string; read?: (path: string) => string; list?: (dir: string) => { name: string; directory: boolean; }[]; } = {}): ShippedFlag[] | null {
  let files: string[];
  try {
    files = sourcesUnder(join(toolRoot, "src"), toolRoot, list).sort();
  } catch {
    return null;
  }
  const byKey = new Map<string, ShippedFlag>();
  for (const file of files) {
    let text: string;
    try {
      text = read(join(toolRoot, file));
    } catch {
      continue; // a file that vanished between the listing and the read holds no flag this tick; the next tick lists it again
    }
    for (const match of text.matchAll(FLAG_DECLARATION)) if (!byKey.has(match[2])) byKey.set(match[2], { name: match[1], key: match[2], file });
  }
  return [...byKey.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** @returns whether `doc` carries `key` as a boolean, nested (`workers` then `haikuBrief`) or flat (`"routing.haikuDefault"`) */
export function declaresKey(doc: unknown, key: string): boolean {
  if (typeof doc !== "object" || doc === null || Array.isArray(doc)) return false;
  const top = doc as Record<string, unknown>;
  if (typeof top[key] === "boolean") return true;
  const [group, name] = key.split(".");
  const nested = top[group];
  return typeof nested === "object" && nested !== null && !Array.isArray(nested) && typeof (nested as Record<string, unknown>)[name] === "boolean";
}

/**
 * THE VIOLATION, PURE: the shipped flags that no declaration carries and that have no other home. `false` is carried; a key set to anything but a boolean is not (the readers
 * say "not true or false; it is off" for one), so it is reported rather than taken for a decision.
 * @param declarations each declaration file's parsed document
 */
export function unsetFlags({ shipped, declarations, anotherHome = FLAGS_WITH_ANOTHER_HOME }: { shipped: readonly ShippedFlag[]; declarations: readonly unknown[]; anotherHome?: Readonly<Record<string, string>>; }): ShippedFlag[] {
  return shipped.filter(({ key }) => !Object.hasOwn(anotherHome, key) && !declarations.some((doc) => declaresKey(doc, key)));
}

/** The two git facts of a flag: when the pull request that added its key merged, and which one it was. `null` for both when history does not say. */
export function mergeOf(flag: ShippedFlag, { toolRoot = TOOL_ROOT, run = (args: string[]) => execFileSync("git", args, { cwd: toolRoot, env: sandboxGitEnv(), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 10_000 }) }: { toolRoot?: string; run?: (args: string[]) => string; } = {}): { mergedAt: string | null; pr: number | null; } {
  let out: string;
  try {
    // The first commit on the first-parent line (main's own merges) that changed how often the quoted key occurs in its file: the merge that brought it in, whose subject names the pull request.
    out = run(["log", "--first-parent", "--reverse", "-S", `"${flag.key}"`, "--format=%cI%x09%s", "--", flag.file]);
  } catch {
    return { mergedAt: null, pr: null };
  }
  const [first] = out.split("\n").filter(Boolean);
  if (first === undefined) return { mergedAt: null, pr: null };
  const [date, subject = ""] = first.split("\t");
  const pr = /#(\d+)/.exec(subject)?.[1];
  return { mergedAt: /^\d{4}-\d{2}-\d{2}T/.test(date) ? date : null, pr: pr === undefined ? null : Number(pr) };
}

/**
 * THE COUNT: the tool's shipped flags read against the declarations. `unknown` names the file that could not be parsed, or that `src/` could not be listed. A tree that holds NO flag is
 * `unknown` too, not clean: this registry has held seven or more since 2026-10-12, so none found is a walk that did not work (`copyDriftReading`'s rule for an empty discovery).
 * @param projectRoot the checkout whose `.agent-org/` holds the project's declarations
 * @param hostPath the host declaration, `$AGENT_ORG_HOST` or the file beside the checkout
 */
export function readFlagLedger({ toolRoot = TOOL_ROOT, projectRoot = HOME_CHECKOUT, hostPath = hostConfigPath(), read = (path) => readFileSync(path, "utf8"), list = listDirectory, merge = (flag) => mergeOf(flag, { toolRoot }) }:
  { toolRoot?: string; projectRoot?: string; hostPath?: string; read?: (path: string) => string; list?: (dir: string) => { name: string; directory: boolean; }[]; merge?: (flag: ShippedFlag) => { mergedAt: string | null; pr: number | null; }; } = {}): FlagLedger {
  const shipped = discoverFlags({ toolRoot, read, list });
  if (shipped === null) return { unknown: `${join(toolRoot, "src")} could not be listed, so no flag was found` };
  if (shipped.length === 0) return { unknown: `no \`*_FLAG\` constant was found under ${join(toolRoot, "src")}, so none was compared` };
  const paths = [...PROJECT_DECLARATIONS.map((file) => ({ path: join(projectRoot, ".agent-org", file), optional: OPTIONAL_DECLARATIONS.includes(file) })), { path: hostPath, optional: false }];
  const declarations: unknown[] = [];
  for (const { path, optional } of paths) {
    let text: string;
    try {
      text = read(path);
    } catch (cause) {
      // An optional file that is not there holds no key. A REQUIRED one that is missing is a wrong path (`$AGENT_ORG_HOST` unset or stale), and reading it as "no key" would name every flag.
      if (optional && (cause as NodeJS.ErrnoException)?.code === "ENOENT") continue;
      return { unknown: `${path} could not be read (${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}), so no flag is known unset` };
    }
    try {
      declarations.push(JSON.parse(text));
    } catch (cause) {
      return { unknown: `${path} is not valid JSON (${String((cause as Error)?.message ?? cause).split("\n")[0].slice(0, 160)}), so no flag is known unset` };
    }
  }
  return { shipped: shipped.length, unset: unsetFlags({ shipped, declarations }).map((flag) => ({ ...flag, ...merge(flag) })) };
}
