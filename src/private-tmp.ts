// library + rstest globalSetup: every test run gets a PRIVATE `TMPDIR`, one directory per test file, removed when the run ends
//
// THE INCIDENT (a11ign/a11ign#3846, chairman's 16:55Z correction): `/tmp` held ~121,425 top-level entries under 706 name prefixes, every one a test
// temp dir that nothing removed (`pr-review-verdict-*` 17,422; `host-units-2184-*` 16,688; ...). The kernel lockup was `rmdir` -> `shrink_dcache_parent`
// -> `d_walk`: one directory with ~121k children while dozens of test processes created and deleted in it at once. #3848 fixes the files that leak, one
// family at a time, which cures the INSTANCES KNOWN; it does not stop the next test from leaking into the shared directory. This does: whatever a test
// forgets lands in a directory only this run uses, and goes with it.
//
// THE SHAPE: `<base>/run-<stamp>-<pid>-<random>/<one directory per test file>`, with `<base>` = `~/.cache/a11ign/tmp`. THE `run-*` NAME AND THE BASE ARE AN
// INTERFACE: #3849's user tmpfiles rule ages `~/.cache/a11ign/tmp/run-*` out after a day, which is what clears the run of a process that was killed before its
// teardown could. Change either and that rule stops matching.
//
//   - `setup` (the globalSetup entry, main process) makes the run root, publishes it in `A11Y_PRIVATE_TMP_RUN` for the workers, and returns the teardown.
//   - `enterFileDir` (called by `private-tmp-setup.ts` in each test file's worker) makes that file's directory and points `TMPDIR` at it.
//   - the teardown reads each file's directory, REPORTS the files that left something in it, then removes the run root. A leak is reported on a PASSING run
//     too, because a test that passes and leaves a directory behind is exactly the one nobody is looking at.
//
// EVERY REMOVAL GOES THROUGH `requirePrivate`, WHICH REFUSES AN EMPTY OR UNSET PATH AND ANYTHING NOT UNDER `<base>/run-*`. It is the `rm -f "${D:?}"/*.md`
// rule written as code (`.claude/rules/guards-and-assertions.md`): with `TMPDIR` unset the cleanup would otherwise resolve to the shared `/tmp`, which is
// the directory this file exists to stay out of.
//
// REMOVAL IS ONE ENTRY PER CALL (`unlink`, then `rmdir` of an emptied directory), NEVER ONE RECURSIVE `rm` OF A TREE. The incident WAS a large `rmdir`; a run
// root holds a few thousand entries at most, but the habit is the point and the cost is nothing.

import { randomBytes } from "node:crypto";
import { lstat, mkdir, readdir, rmdir, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** The env var the globalSetup publishes the run root in, and the workers read it from. */
export const RUN_ROOT_ENV = "A11Y_PRIVATE_TMP_RUN";
/** Where the runs live, overridable so a test can keep a fixture run out of the real base. */
export const BASE_ENV = "A11Y_PRIVATE_TMP_BASE";
/** A leak fails the run unless this is `report`, which names the leakers and passes. The row asked for red once #3848's fixes had landed (they have: 312 files, none left). */
export const LEAK_POLICY_ENV = "A11Y_PRIVATE_TMP_LEAKS";
const RUN_PREFIX = "run-";
const ENTRIES_NAMED_PER_FILE = 5;
const NAMES_SHOWN_PER_DIRECTORY = 3;
// Caches the RUNTIME writes into `TMPDIR` for any process, which no test made and none can remove: `tsx-<uid>` (tsx's transform cache), `v8-compile-cache-<uid>`
// and `node-compile-cache` (node's; CI's `installed-layout.test.ts` left the latter on #312's first run, from the `pnpm` it spawns, and no local run showed it).
// Measured on the first full run after #3848: the first two were the ONLY entries left in 5 files, and a report that always names the same entries is a report
// people learn to ignore, which would also make a leak red on every run, whatever it was. Exact names only: `tsx-1000-x` is still a leak.
const RUNTIME_CACHE = /^(?:(?:tsx|v8-compile-cache)-\d+|node-compile-cache)$/;

/**
 * What one leaked entry is, read with `lstat` and at most one `readdir` of the entry itself, never a walk. `ageMs` is how long before the teardown read it was
 * last modified. A directory's mtime moves when something is added to or removed from it, which is what tells a late writer from a removal that never ran.
 * `vanished` and `unreadable` are facts too: an entry the report could not read is still a leak and is never dropped for it.
 */
export type EntryDetail =
  | { name: string; kind: "directory"; count: number; first: string[]; ageMs: number }
  | { name: string; kind: "file" | "other"; ageMs: number }
  | { name: string; kind: "vanished" }
  | { name: string; kind: "unreadable"; reason: string };

/** A test file that left something behind: its path from the project root, the names of what is in its directory, and what the first `ENTRIES_NAMED_PER_FILE` of them are. */
export type Leak = { file: string; entries: string[]; details: EntryDetail[] };

export function privateBase(env: NodeJS.ProcessEnv = process.env): string {
  return env[BASE_ENV] || join(homedir(), ".cache", "a11ign", "tmp");
}

/**
 * Throws unless `path` is a non-empty absolute path that is, or is inside, a `<base>/run-*` directory. The one gate every removal passes: `<base>` itself,
 * a sibling of it, `..` out of it and `/tmp` all fail, because their first segment under the base is not `run-*`.
 */
export function requirePrivate(path: string | undefined, base: string): string {
  if (!path) throw new Error("private-tmp: refusing an empty or unset path; the cleanup would resolve to the shared temp directory");
  if (!isAbsolute(path)) throw new Error(`private-tmp: refusing the relative path ${JSON.stringify(path)}`);
  const resolved = resolve(path);
  const [run = ""] = relative(resolve(base), resolved).split(sep);
  if (!run.startsWith(RUN_PREFIX)) throw new Error(`private-tmp: refusing ${resolved}: not a run root or inside one under ${join(resolve(base), `${RUN_PREFIX}*`)}`);
  return resolved;
}

/**
 */
export async function createRunRoot({ base = privateBase(), now = new Date(), pid = process.pid }: { base?: string; now?: Date; pid?: number } = {}): Promise<string> {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const root = join(resolve(base), `${RUN_PREFIX}${stamp}-${pid}-${randomBytes(3).toString("hex")}`);
  await mkdir(root, { recursive: true });
  return root;
}

/**
 * A test file's directory name: its path from the project root as ONE path segment, readable back into the path. `/` is `@-` and a literal `@` is `@@`, so the
 * name stays inside `[A-Za-z0-9_.@-]`. NOT `encodeURIComponent`: its `%` broke 14 test files that build `file:` URLs and unit lines from `TMPDIR`
 * (`File URL path must not include encoded / characters`; `host-config`'s `UNIT_SAFE_PATH` refuses `%` as a systemd specifier), measured on the first full run.
 */
export function fileDirName(testPath: string, projectRoot: string): string {
  return relative(projectRoot, testPath).replace(/@/g, "@@").replace(/\//g, "@-");
}

export function testFileOf(dirName: string): string {
  return dirName.replace(/@([@-])/g, (_, mark) => (mark === "@" ? "@" : "/"));
}

/**
 * Makes this test file's own directory under the run root and points `TMPDIR` at it, so `os.tmpdir()` and every child process the test spawns land there.
 */
export async function enterFileDir({ runRoot, testPath, projectRoot, env = process.env, base = privateBase(env) }: {
  runRoot: string | undefined;
  testPath: string;
  projectRoot: string;
  env?: NodeJS.ProcessEnv;
  base?: string;
}): Promise<string> {
  const dir = join(requirePrivate(runRoot, base), fileDirName(testPath, projectRoot));
  await mkdir(dir, { recursive: true });
  env.TMPDIR = dir;
  return dir;
}

/**
 * What `name` in `dir` is. ENOENT is `vanished` (it was listed, then removed before it was read); any other failure is `unreadable` with its code. An `lstat`,
 * so a symlink is reported as itself and never followed out of the run root.
 */
export async function describeEntry(dir: string, name: string, now: number): Promise<EntryDetail> {
  const path = join(dir, name);
  try {
    const info = await lstat(path);
    const ageMs = Math.max(0, now - info.mtimeMs);
    if (!info.isDirectory()) return { name, kind: info.isFile() ? "file" : "other", ageMs };
    const inside = (await readdir(path)).toSorted();
    return { name, kind: "directory", count: inside.length, first: inside.slice(0, NAMES_SHOWN_PER_DIRECTORY), ageMs };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" ? { name, kind: "vanished" } : { name, kind: "unreadable", reason: code ?? String(error) };
  }
}

/**
 * Each test file whose directory still holds something, with what it holds. Absence of a directory is not a leak: a file whose worker never started has none. The runtime's own caches (`RUNTIME_CACHE`) are not a test's.
 * Only the names listed come from the directory read; `describe` annotates them and can never remove one, so an entry that cannot be read is still a leak.
 */
export async function findLeaks(
  runRoot: string,
  base: string = privateBase(),
  { now = Date.now(), describe = describeEntry }: { now?: number; describe?: typeof describeEntry } = {},
): Promise<Leak[]> {
  const root = requirePrivate(runRoot, base);
  const dirs = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  const left = async (name: string) => (await readdir(join(root, name))).filter((entry) => !RUNTIME_CACHE.test(entry)).toSorted();
  const read = await Promise.all(dirs.map(async ({ name }) => {
    const entries = await left(name);
    const details = await Promise.all(entries.slice(0, ENTRIES_NAMED_PER_FILE).map((entry) => describe(join(root, name), entry, now)));
    return { file: testFileOf(name), entries, details };
  }));
  return read.filter(({ entries }) => entries.length > 0).toSorted((a, b) => a.file.localeCompare(b.file));
}

/** `120ms`, `5.0s`, `3m07s`, `2h05m`: how long before the teardown, to the precision that tells a late writer from a removal that never ran. */
function ago(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m${String(Math.floor(seconds % 60)).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

function describeDetail(detail: EntryDetail): string {
  switch (detail.kind) {
    case "vanished": return `${detail.name}: vanished before it could be read`;
    case "unreadable": return `${detail.name}: unreadable (${detail.reason})`;
    case "file": return `${detail.name}: file, modified ${ago(detail.ageMs)} before the teardown`;
    case "other": return `${detail.name}: not a file or directory, modified ${ago(detail.ageMs)} before the teardown`;
    case "directory": {
      const what = detail.count === 0
        ? "empty directory"
        : `directory of ${detail.count} ${detail.count === 1 ? "entry" : "entries"} (${detail.first.join(", ")}${detail.count > detail.first.length ? ", ..." : ""})`;
      return `${detail.name}: ${what}, modified ${ago(detail.ageMs)} before the teardown`;
    }
  }
}

/**
 * The report's lines: one per leaking file naming the file and what it left, then a total. Empty when nothing leaked, so a clean run adds nothing to the output.
 * Each line KEEPS its earlier text as a prefix and appends what each named entry is, so a log grep for `<file> left N in its TMPDIR` still matches.
 */
export function leakReport(leaks: Leak[]): string[] {
  if (leaks.length === 0) return [];
  const lines = leaks.map(({ file, entries, details }) => {
    const shown = entries.slice(0, ENTRIES_NAMED_PER_FILE).join(", ");
    const more = entries.length > ENTRIES_NAMED_PER_FILE ? `, ... and ${entries.length - ENTRIES_NAMED_PER_FILE} more` : "";
    const what = details.length > 0 ? `; ${details.map(describeDetail).join("; ")}` : "";
    return `  ${file} left ${entries.length} in its TMPDIR: ${shown}${more}${what}`;
  });
  return [`private-tmp: ${leaks.length} test file(s) left something in their private TMPDIR (removed with the run):`, ...lines];
}

/**
 * Removes a run root one entry at a time. Refuses anything `requirePrivate` refuses.
 */
export async function removeRunRoot(runRoot: string, base: string = privateBase()): Promise<void> {
  await removeTree(requirePrivate(runRoot, base));
}

async function removeTree(dir: string): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await removeTree(path);
    else await unlink(path);
  }
  await rmdir(dir);
}

function failsOnLeak(env: NodeJS.ProcessEnv): boolean {
  return env[LEAK_POLICY_ENV] !== "report";
}

/**
 * The teardown: report, then remove. The removal is in a `finally` so a refused policy or a failed read still leaves no run root behind.
 */
export async function finishRun({ runRoot, base = privateBase(), env = process.env, write = (line) => console.error(line) }: {
  runRoot: string;
  base?: string;
  env?: NodeJS.ProcessEnv;
  write?: (line: string) => void;
}): Promise<void> {
  let leaks: Leak[] = [];
  try {
    leaks = await findLeaks(runRoot, base);
    for (const line of leakReport(leaks)) write(line);
  } finally {
    await removeRunRoot(runRoot, base);
  }
  if (leaks.length > 0 && failsOnLeak(env)) throw new Error(`private-tmp: ${leaks.length} test file(s) left something in their private TMPDIR`);
}

/**
 * rstest's globalSetup entry. Runs before the first test file and returns the teardown, which rstest also calls when a test failed.
 */
export default async function setup(): Promise<() => Promise<void>> {
  const base = privateBase();
  const runRoot = await createRunRoot({ base });
  process.env[RUN_ROOT_ENV] = runRoot;
  return async () => {
    delete process.env[RUN_ROOT_ENV];
    await finishRun({ runRoot, base });
  };
}
