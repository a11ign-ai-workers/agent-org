// no-token: none -- reads two package manifests and runs pairs of pure helpers, one of them over a throwaway local git repository; no network, no GitHub.
/**
 * agent-org#715: THE TICK KEEPS SIX OF THE TOOLCHAIN'S HELPERS AS COPIES, AND THIS IS THE CHECK THAT SAYS WHEN ONE DRIFTED.
 *
 * `work-gate.ts`, `work-tick.ts` and `wake.ts` run from the host's installed checkout BEFORE any install, so nothing they reach can be a bare
 * `@a11ign/toolchain` import: a tick that cannot load raises nothing and the org sleeps (#2174, #535). The ceo ruled on agent-org#522 that
 * the stems they reach stay declared copies. A copy with no check is the `cross-repo-copies` defect (chairman, #4425), so: after install,
 * compare each copy with the toolchain's `lib/<stem>` at the version `package.json` declares. The comparison reads NAMES and BEHAVIOUR,
 * never text, so a copy that differs in a comment is not drift. Siblings in a11ign: `bootstrap-copies-match-toolchain.test.ts` (#4707),
 * `bootstrap-copies-gate-match-toolchain.test.ts` (#4591) and `bootstrap-copies-changed-match-toolchain.test.ts` (#4719).
 *
 * THE STEMS ARE DERIVED, NEVER LISTED: the closure of the three tick entries (`localImports`, the copy of `local-import-closure`), intersected
 * with the files whose header says `COPIED FROM`. A seventh copy the tick starts to reach is compared on the next run, by its exported names
 * and by every function that has a probe; one with no probe table is REPORTED, never skipped. A copy the tick stops reaching drops out.
 *
 * POSITIVE CONTROLS (each run on every compared stem, so an empty or an always-different comparison cannot pass):
 *   - the derivation is fed a synthetic tree and must return exactly the reached, headed file;
 *   - `compare` is fed a copy of the real source with a comment appended (no difference) and with an extra export (reported);
 *   - `compare` is fed the real toolchain module with each export replaced in turn, and each replacement must be reported by that export's OWN
 *     probe, which is what proves the probe table calls the thing it names.
 * The observable test below it checks the comparisons are not two silent answers (a refusal that exits, a fixture that resolves).
 *
 * NOT PROBED, and why: `changed-files`' and `cli-flags`' command-line entry is behind an `import.meta.url` guard against `process.argv[1]`, so
 * importing either side runs nothing. `repoRoot`'s default (`process.cwd()`) is not probed: a worker thread may not `chdir`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { localImports } from "../lib/local-import-closure.ts";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const LIB = join(ROOT, "src", "lib");
/** The three modules the tick's unit runs (`work-tick.ts`, the gate it calls, and the wake it hands orders through). */
const TICK_ENTRIES = ["src/work-gate.ts", "src/work-tick.ts", "src/wake.ts"].map((path) => join(ROOT, path));
const COPY_HEADER = /^\/\/ COPIED FROM `[^`]+` at /m;
const TOOLCHAIN = "@a11ign/toolchain";

type Module = Record<string, unknown>;
type Outcome = { value: unknown } | { threw: string };
type Context = ReturnType<typeof makeContext>;
type Probes = Record<string, Array<(module: Module, ctx: Context) => unknown>>;

/** The closure of `entries` through `localImports`, entries included. */
function closureOf(entries: string[]): string[] {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...localImports(file));
  }
  return [...seen].sort();
}

/** The stems of the files in `closure` that sit directly in `lib` and carry a `COPIED FROM` header. */
function copiedStemsIn(closure: string[], lib: string): string[] {
  return closure
    .filter((file) => dirname(file) === lib && file.endsWith(".ts"))
    .filter((file) => COPY_HEADER.test(readFileSync(file, "utf8").split("\n").slice(0, 8).join("\n")))
    .map((file) => file.slice(lib.length + 1, -".ts".length))
    .sort();
}

const STEMS = copiedStemsIn(closureOf(TICK_ENTRIES), LIB);

/** The nearest installed toolchain package, found the way node's own resolution walks up from `ROOT`. */
function installedToolchain(): { version: string; dir: string } | null {
  for (let dir = ROOT; ; dir = dirname(dir)) {
    const manifest = join(dir, "node_modules", TOOLCHAIN, "package.json");
    if (existsSync(manifest)) return { version: JSON.parse(readFileSync(manifest, "utf8")).version, dir: dirname(manifest) };
    if (dirname(dir) === dir) return null;
  }
}

function declaredRange(): string {
  const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const range = manifest.dependencies?.[TOOLCHAIN] ?? manifest.devDependencies?.[TOOLCHAIN];
  assert.equal(typeof range, "string", `package.json declares no ${TOOLCHAIN}, so there is no version to compare the copies with`);
  return range;
}

/** `version` against an exact, `^` or `~` range, the three forms this manifest has used; any other form is refused rather than guessed. */
function satisfies(version: string, range: string): boolean {
  const parse = (text: string) => /^(\d+)\.(\d+)\.(\d+)$/.exec(text)?.slice(1).map(Number);
  const have = parse(version);
  const [, operator = "", bound] = /^([\^~]?)(\d+\.\d+\.\d+)$/.exec(range) ?? [];
  const want = bound === undefined ? undefined : parse(bound);
  if (want === undefined) throw new Error(`the declared range ${JSON.stringify(range)} is not an exact version, ^x.y.z or ~x.y.z: teach \`satisfies\` that form`);
  if (have === undefined) return false; // a pre-release never satisfies a plain range
  const atLeast = have[0] - want[0] || have[1] - want[1] || have[2] - want[2];
  if (operator === "") return atLeast === 0;
  if (atLeast < 0) return false;
  if (operator === "~") return have[0] === want[0] && have[1] === want[1];
  if (want[0] > 0) return have[0] === want[0];
  return want[1] > 0 ? have[0] === 0 && have[1] === want[1] : have[0] === 0 && have[1] === 0 && have[2] === want[2];
}

const INSTALLED = installedToolchain();
const VERSION = INSTALLED?.version ?? "NOT INSTALLED";

/**
 * The toolchain's own `GIT_*` scrub, for the one place this file spawns git (the throwaway repository `makeContext` builds): the reference side
 * rather than the copy under test, so the fixture does not rest on the file it checks, and `git-spawn-classification.test.ts` classifies the spawn.
 * Imported only once the install satisfies the declared range, because an older toolchain has no `lib/git-env` and a static import would end the
 * file at load instead of letting the version test say why.
 */
const GIT_ENV = INSTALLED !== null && (() => {
  try {
    return satisfies(INSTALLED.version, declaredRange());
  } catch {
    return false; // an undeclared or unreadable range is the version test's to report, with its own message
  }
})()
  ? await import("@a11ign/toolchain/lib/git-env")
  : null;

function outcomeOf(run: () => unknown): Outcome {
  try {
    return { value: run() };
  } catch (error) {
    return { threw: error instanceof Error ? error.message : String(error) };
  }
}

const call = (module: Module, name: string, ...args: unknown[]) => (module[name] as (...a: unknown[]) => unknown)(...args);

/** Runs `run` with `process.env` (and `process.argv` when given) replaced, and puts them back. */
function inProcess<T>(setup: { env: Record<string, string> }, run: () => T): T {
  const saved = process.env;
  process.env = { ...setup.env };
  try {
    return run();
  } finally {
    process.env = saved;
  }
}

/** `refuseUnknownFlags` exits the process on refusal: capture the exit code and stderr instead of dying. */
function refusal(module: Module, known: string[], argv: string[], entryMatches: boolean) {
  const realExit = process.exit;
  const realError = console.error;
  const lines: string[] = [];
  let exitCode: unknown = "no exit";
  const script = process.argv[1] ? realpathSync(process.argv[1]) : fileURLToPath(import.meta.url);
  const entry = entryMatches ? pathToFileURL(script).href : "file:///not-this-script";
  process.exit = ((code?: number) => { exitCode = code; throw new Error("exit"); }) as typeof process.exit;
  console.error = (...parts: unknown[]) => { lines.push(parts.join(" ")); };
  try {
    call(module, "refuseUnknownFlags", known, { entry, argv, command: "probe" });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "exit") throw error;
  } finally {
    process.exit = realExit;
    console.error = realError;
  }
  return { exitCode, lines };
}

const tidy: string[] = [];
test.after(() => { for (const dir of tidy) rmSync(dir, { recursive: true, force: true }); });
function scratch(label: string): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), `bootstrap-copies-${label}-`)));
  tidy.push(dir);
  return dir;
}

function put(path: string, text = ""): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** Everything the probes read, built once: the same files are handed to both sides, so a path in an answer is the same path. */
function makeContext() {
  const dir = scratch("fixture");
  const bin = join(dir, "bin");
  for (const name of ["npm", "npx", "pnpm", "corepack", "npm-cli.js", "npx-cli.js"]) put(join(bin, name));
  const cmd = join(dir, "cmd");
  put(join(cmd, "pnpm.cmd"));
  const cmdWithScript = join(dir, "cmd-script");
  put(join(cmdWithScript, "pnpm.cmd"));
  put(join(cmdWithScript, "node_modules", "pnpm", "bin", "pnpm.cjs"));
  put(join(dir, "pnpm.cjs"));
  mkdirSync(join(dir, "empty"));

  const imports = join(dir, "imports");
  put(join(imports, "a.ts"), [
    'import { b } from "./b.ts";', 'import c from "./c";', 'export * from "./d.mjs";', 'const e = await import("./e.js");', 'import "./sub";',
    'import { x as y, z } from "./b.ts";', 'import * as ns from "./c";', 'import d2, { q } from "./d.mjs";', 'import { gone } from "./missing.ts";',
    'import fs from "node:fs";', '// import { fake } from "./b.ts";', '/* import ghost from "./c"; */',
    // extensionless, so only the extension candidates can find them: `.ts`, then `.mjs`, then `.js`, in that order
    'import { fromMjs } from "./only-mjs";', 'import { fromJs } from "./only-js";', 'import { both } from "./ts-and-mjs";', 'import { jsAndMjs } from "./mjs-and-js";',
  ].join("\n"));
  for (const file of ["b.ts", "c.ts", "d.mjs", "e.js", "sub/index.ts", "only-mjs.mjs", "only-js.js", "ts-and-mjs.ts", "ts-and-mjs.mjs", "mjs-and-js.mjs", "mjs-and-js.js"]) {
    put(join(imports, file), "export const value = 1;\n");
  }

  const worktrees = join(dir, "worktrees");
  const link = (worktree: string, name: string, target: string) => {
    mkdirSync(join(worktree, "node_modules", "@a11ign"), { recursive: true });
    symlinkSync(target, join(worktree, "node_modules", "@a11ign", name));
  };
  const own = (name: string) => { mkdirSync(join(worktrees, name, "packages", "x"), { recursive: true }); return join(worktrees, name); };
  const kinds: Record<string, string> = {};
  kinds.allOwn = own("all-own");
  link(kinds.allOwn, "x", join(kinds.allOwn, "packages", "x"));
  kinds.stale = own("stale");
  link(kinds.stale, "x", join(kinds.stale, "packages", "x"));
  mkdirSync(join(kinds.stale, "node_modules", "@a11ign", "copy"));
  kinds.foreign = own("foreign");
  mkdirSync(join(worktrees, "other", "packages", "y"), { recursive: true });
  link(kinds.foreign, "x", join(kinds.foreign, "packages", "x"));
  link(kinds.foreign, "y", join(worktrees, "other", "packages", "y"));
  kinds.dangling = own("dangling");
  link(kinds.dangling, "gone", join(worktrees, "nowhere"));
  kinds.bare = own("bare");

  const repo = join(dir, "repo");
  assert.ok(GIT_ENV !== null, `the fixture repository needs ${TOOLCHAIN}/lib/git-env, and the installed ${TOOLCHAIN}@${VERSION} does not satisfy the declared range`);
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Bootstrap Copies Test", "-c", "user.email=bootstrap-copies@example.invalid", ...args], {
    cwd: repo,
    env: GIT_ENV.sandboxGitEnv({ GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }),
    encoding: "utf8",
  });
  mkdirSync(repo);
  for (const [path, text] of [["packages/judge/src/a.ts", "a\n"], ["packages/cli/src/b.ts", "b\n"], ["scripts/move-me.mjs", "move\n"], ["docs/guide.md", "guide\n"]]) put(join(repo, path), text);
  git("init", "-q", "-b", "main");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  git("update-ref", "refs/remotes/origin/main", "HEAD");
  git("checkout", "-q", "-b", "feature");
  put(join(repo, "packages/judge/src/a.ts"), "a changed\n");
  put(join(repo, "packages/evidence/src/new.ts"), "new\n");
  put(join(repo, "docs/guide.md"), "guide changed\n");
  mkdirSync(join(repo, "tools"));
  git("mv", "scripts/move-me.mjs", "tools/move-me.mjs");
  git("add", "-A");
  git("commit", "-q", "-m", "feature");

  return { dir, bin, cmd, cmdWithScript, imports, kinds, repo, worktrees };
}

let context: Context | undefined;
const fixtures = (): Context => (context ??= makeContext());

const KNOWN = ["--role=", "--list", "-v", "--verbose"];
const ARGVS = [[], ["--list"], ["--role=x", "-v"], ["--lst"], ["--rolee=x", "-q"], ["--", "--list"], ["a", "-e"]];

const COMMENT_TEXTS = [
  "", "no comment at all", "a // line\nb", "/* block\nspans */ x", "// has /* an opener\ncode();\n/* later */ tail",
  "/* has // inside */ code // tail", '"//in a string" // real', "x /* a */ y /* b */ z", "line // one\r\nline // two\r\n", "/**/ empty",
];

/** The fake file system `worktree-resolution` takes by injection: four links of the four kinds, one of which does not resolve. */
const FAKE_FS = {
  exists: (path: string) => path !== "/wt-without/node_modules/@a11ign",
  list: () => ["z-gone", "b-copy", "a-own", "c-foreign"],
  realpath: (path: string) => {
    const known: Record<string, string> = {
      "/wt": "/real/wt",
      "/wt/node_modules/@a11ign/a-own": "/real/wt/packages/a",
      "/wt/node_modules/@a11ign/b-copy": "/real/wt/node_modules/.store/b",
      "/wt/node_modules/@a11ign/c-foreign": "/elsewhere/packages/c",
    };
    if (path in known) return known[path];
    throw new Error(`ENOENT ${path}`);
  },
};
const OWN_ONLY_FS = { ...FAKE_FS, list: () => ["a-own"] };

/** What each stem is probed with. A function exported by a copy and named in no table is reported by `compare`, never passed over. */
const PROBE_TABLES: Record<string, () => Probes> = {
  "cli-flags": () => ({
    nameOf: ["--role=x", "--list", "-v", "plain", "--a=b=c", ""].map((arg) => (m: Module) => call(m, "nameOf", arg)),
    flagValue: [[["--role=x"], "role"], [["--role", "x"], "role"], [["--list"], "role"], [["--role="], "role"], [["--role=a", "--role=b"], "role"]]
      .map(([argv, name]) => (m: Module) => call(m, "flagValue", argv, name)),
    unknownFlags: ARGVS.map((argv) => (m: Module) => call(m, "unknownFlags", argv, KNOWN)),
    didYouMean: ["--lst", "--rolee", "--zzzzzzzzzz", "--verbos", "--listxxxx", "--listxxxxx"].map((flag) => (m: Module) => call(m, "didYouMean", flag, KNOWN)),
    refuseUnknownFlags: [
      ...ARGVS.map((argv) => (m: Module) => refusal(m, KNOWN, argv, true)),
      (m) => refusal(m, KNOWN, ["--bogus"], false),
      (m) => refusal(m, [], ["--bogus"], true),
      (m) => call(m, "refuseUnknownFlags", KNOWN, { entry: "", argv: [] }),
    ],
  }),
  "git-env": () => {
    const env = { PATH: "/usr/bin", HOME: "/h", GIT_DIR: "/x", GIT_WORK_TREE: "/y", GIT_FUTURE_VAR: "1", NOT_GIT: "2" };
    return {
      KNOWN_GIT_REDIRECT_VARS: [(m) => m.KNOWN_GIT_REDIRECT_VARS],
      sandboxGitEnv: [
        (m) => inProcess({ env }, () => call(m, "sandboxGitEnv")),
        (m) => inProcess({ env }, () => call(m, "sandboxGitEnv", { GIT_AUTHOR_NAME: "a", EXTRA: "b" })),
        (m) => inProcess({ env: {} }, () => call(m, "sandboxGitEnv", {})),
      ],
    };
  },
  "npm-cli-executable": () => {
    const withPath = (path: string, extra: Record<string, string> = {}) => ({ env: { PATH: path, ...extra } });
    const names = ["npm", "npx"] as const;
    const scenario = (path: (ctx: Context) => string, extra: (ctx: Context) => Record<string, string> = () => ({})) =>
      (run: (m: Module) => unknown) => (m: Module, ctx: Context) => inProcess(withPath(path(ctx), extra(ctx)), () => run(m));
    const onBin = scenario((ctx) => ctx.bin);
    const onNothing = scenario((ctx) => join(ctx.dir, "empty"));
    return {
      npmCliScriptCandidates: names.flatMap((name) => [onBin((m) => call(m, "npmCliScriptCandidates", name)), onNothing((m) => call(m, "npmCliScriptCandidates", name))]),
      resolveNpmCliScript: names.flatMap((name) => [onBin((m) => call(m, "resolveNpmCliScript", name)), onNothing((m) => call(m, "resolveNpmCliScript", name))]),
      npmCliInvocation: names.map((name) => onNothing((m) => call(m, "npmCliInvocation", name, ["install", "--x"]))),
      pnpmCliInvocation: [
        scenario((ctx) => join(ctx.dir, "empty"), (ctx) => ({ npm_execpath: join(ctx.dir, "pnpm.cjs") }))((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
        scenario((ctx) => join(ctx.dir, "empty"), (ctx) => ({ npm_execpath: join(ctx.dir, "not-pnpm.js") }))((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
        onBin((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
        onNothing((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
        scenario((ctx) => ctx.cmd)((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
        scenario((ctx) => ctx.cmdWithScript)((m) => call(m, "pnpmCliInvocation", ["run", "t"])),
      ],
    };
  },
  "changed-files": () => {
    const run = (range: string[], options: Record<string, unknown> = {}) => (m: Module, ctx: Context) => call(m, "changedFiles", range, { repoRoot: ctx.repo, ...options });
    return {
      changedFiles: [
        run(["origin/main...HEAD"]), run(["origin/main", "HEAD"]), run(["HEAD~1", "HEAD"]), run(["HEAD~1", "HEAD"], { pathspec: ["packages"] }),
        run(["HEAD~1", "HEAD"], { pathspec: ["scripts", "tools"] }), run(["HEAD", "HEAD"]), run(["HEAD~1", "HEAD"], { pathspec: [] }),
        // a repository that is not there throws before git writes anything, so the error path is compared without a `fatal:` line in the run's output
        (m, ctx) => call(m, "changedFiles", ["HEAD~1", "HEAD"], { repoRoot: join(ctx.dir, "no-such-repository") }),
      ],
    };
  },
  "local-import-closure": () => {
    const at = (ctx: Context, file: string) => join(ctx.imports, file);
    return {
      stripComments: COMMENT_TEXTS.map((text) => (m: Module) => call(m, "stripComments", text)),
      localImports: [
        (m, ctx) => call(m, "localImports", at(ctx, "a.ts")),
        (m, ctx) => call(m, "localImports", at(ctx, "b.ts")),
        (m, ctx) => call(m, "localImports", at(ctx, "no-such-file.ts")),
      ],
      importedNamesFor: [
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "b.ts")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "c.ts")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "d.mjs")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "e.js")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "sub/index.ts")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, "nowhere.ts")),
        (m, ctx) => call(m, "importedNamesFor", at(ctx, "b.ts"), at(ctx, "a.ts")),
        ...["only-mjs.mjs", "only-js.js", "ts-and-mjs.ts", "ts-and-mjs.mjs", "mjs-and-js.mjs", "mjs-and-js.js"]
          .map((file) => (m: Module, ctx: Context) => call(m, "importedNamesFor", at(ctx, "a.ts"), at(ctx, file))),
      ],
    };
  },
  "worktree-resolution": () => {
    const real = (name: string) => (m: Module, ctx: Context) => call(m, "worktreeResolution", ctx.kinds[name]);
    const verdicts = (env: Record<string, string>, deps: typeof FAKE_FS) => (m: Module) => call(m, "suiteStartVerdict", "/wt", { env, ...deps });
    const kindNames = ["allOwn", "stale", "foreign", "dangling", "bare"];
    return {
      RESOLUTION: [(m) => m.RESOLUTION],
      OVERRIDE_ENV: [(m) => m.OVERRIDE_ENV],
      classifyResolvedPath: [
        ["/wt", "/wt/node_modules/@a11ign/x"], ["/wt", "/wt/packages/x"], ["/wt", "/other/packages/x"], ["/wt", "/other/node_modules/.store/x"],
        ["/wt", "/wt"], ["/wt", "/wtx/packages/x"], ["/wt", "/other"],
      ].map(([worktree, resolved]) => (m: Module) => call(m, "classifyResolvedPath", worktree, resolved)),
      resolvedScopeEntries: [
        (m) => call(m, "resolvedScopeEntries", "/wt", FAKE_FS),
        (m) => call(m, "resolvedScopeEntries", "/wt-without", FAKE_FS),
        (m) => call(m, "resolvedScopeEntries", "/wt-unresolvable", { ...FAKE_FS, realpath: () => { throw new Error("ENOENT"); } }),
        ...kindNames.map((name) => (m: Module, ctx: Context) => call(m, "resolvedScopeEntries", ctx.kinds[name])),
      ],
      worktreeResolution: [
        (m) => call(m, "worktreeResolution", "/wt", FAKE_FS), (m) => call(m, "worktreeResolution", "/wt", OWN_ONLY_FS), (m) => call(m, "worktreeResolution", "/wt-without", FAKE_FS),
        ...kindNames.map(real),
      ],
      resolutionLine: [
        (m) => call(m, "resolutionLine", "/wt", call(m, "worktreeResolution", "/wt", FAKE_FS)),
        (m) => call(m, "resolutionLine", "/wt", call(m, "worktreeResolution", "/wt", OWN_ONLY_FS)),
        (m) => call(m, "resolutionLine", "/wt", call(m, "worktreeResolution", "/wt-without", FAKE_FS)),
        (m) => call(m, "resolutionLine", "/wt", { kind: "stale-copy", entries: [{ kind: "stale-copy" }, { kind: "own-packages" }], checkouts: [] }),
        (m) => call(m, "resolutionLine", "/wt", { kind: "other-checkout", entries: [{ kind: "other-checkout" }], checkouts: ["/a", "/b"] }),
      ],
      suiteStartVerdict: [
        verdicts({}, FAKE_FS), verdicts({ A11Y_ALLOW_FOREIGN_RESOLUTION: "1" }, FAKE_FS), verdicts({ A11Y_ALLOW_FOREIGN_RESOLUTION: "0" }, FAKE_FS),
        verdicts({}, OWN_ONLY_FS), (m: Module) => call(m, "suiteStartVerdict", "/wt-without", { env: {}, ...FAKE_FS }),
      ],
    };
  },
};

/** Every way `copy` differs from `reference`: the exported names, then each probe's outcome. Empty means no drift. */
function compare(reference: Module, copy: Module, probes: Probes, ctx: Context): string[] {
  const differences: string[] = [];
  const left = Object.keys(reference).sort();
  const right = Object.keys(copy).sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) differences.push(`exports differ: toolchain [${left}] vs copy [${right}]`);
  for (const name of new Set([...left, ...right])) {
    if (!(name in probes)) differences.push(`${name} is exported and has no probe`);
  }
  for (const [name, runs] of Object.entries(probes)) {
    runs.forEach((run, index) => {
      const want = outcomeOf(() => run(reference, ctx));
      const got = outcomeOf(() => run(copy, ctx));
      try {
        assert.deepEqual(got, want);
      } catch {
        differences.push(`${name} probe ${index}: toolchain ${JSON.stringify(want)} vs copy ${JSON.stringify(got)}`);
      }
    });
  }
  return differences;
}

const importFile = async (path: string): Promise<Module> => import(pathToFileURL(path).href);
const toolchainModule = async (stem: string): Promise<Module> => import(`${TOOLCHAIN}/lib/${stem}`);
const copyModule = async (stem: string): Promise<Module> => importFile(join(LIB, `${stem}.ts`));

/** A copy of the real `stem` source and the files it imports, laid out as in `src/lib`, with `edit` applied to the stem's own text. */
async function alteredCopy(stem: string, edit: (text: string) => string): Promise<Module> {
  const root = scratch("altered");
  put(join(root, "package.json"), '{ "type": "module" }\n');
  for (const file of closureOf([join(LIB, `${stem}.ts`)])) {
    assert.ok(!relative(LIB, file).startsWith(".."), `${stem} imports ${file}, outside src/lib: the altered copy cannot be laid out beside it`);
    const text = readFileSync(file, "utf8");
    put(join(root, "lib", relative(LIB, file)), file === join(LIB, `${stem}.ts`) ? edit(text) : text);
  }
  return importFile(join(root, "lib", `${stem}.ts`));
}

test(`the installed ${TOOLCHAIN} (${VERSION}) satisfies the version package.json declares (${declaredRange()})`, () => {
  assert.ok(INSTALLED, `${TOOLCHAIN} is not installed under any node_modules above ${ROOT}: run the install first, this comparison is for after it`);
  assert.ok(satisfies(INSTALLED.version, declaredRange()),
    `${TOOLCHAIN}@${INSTALLED.version} is installed at ${INSTALLED.dir} but package.json declares ${declaredRange()}: the copies would be compared with a version the tool does not claim`);
});

test("the version check reads ranges: an install the manifest does not declare is refused, one it does is accepted", () => {
  const cases: Array<[string, string, boolean]> = [
    ["0.7.1", "^0.7.0", true], ["0.7.0", "^0.7.0", true], ["0.8.0", "^0.7.0", false], ["0.6.9", "^0.7.0", false], ["0.1.2", "^0.7.0", false],
    ["1.2.3", "^1.2.0", true], ["2.0.0", "^1.2.0", false], ["1.1.9", "^1.2.0", false], ["0.0.3", "^0.0.3", true], ["0.0.4", "^0.0.3", false],
    ["1.2.9", "~1.2.0", true], ["1.3.0", "~1.2.0", false], ["1.2.3", "1.2.3", true], ["1.2.4", "1.2.3", false], ["0.7.1-beta.1", "^0.7.0", false],
  ];
  for (const [version, range, expected] of cases) assert.equal(satisfies(version, range), expected, `${version} against ${range}`);
  assert.throws(() => satisfies("1.0.0", ">=1.0.0"), /teach `satisfies` that form/);
});

test("the stems are derived from the tick's closure and every one is reached", () => {
  const closure = closureOf(TICK_ENTRIES);
  for (const entry of TICK_ENTRIES) assert.ok(closure.includes(entry), `${entry} is not in its own closure: the walk found nothing`);
  assert.ok(closure.length > TICK_ENTRIES.length, "the closure of the tick is only its three entries, so the walk followed no import");
  assert.ok(STEMS.length > 0, "no `// COPIED FROM` file is in the tick's closure: the comparison below has nothing to compare, and the control that proves the walk works is the next test");
  for (const stem of STEMS) assert.ok(closure.includes(join(LIB, `${stem}.ts`)), `${stem} was derived without being in the closure`);
});

test("positive control: the derivation returns the headed file the entry reaches, and neither an unheaded one it reaches nor a headed one it does not", () => {
  const root = scratch("derive");
  const lib = join(root, "lib");
  const header = (name: string) => `#!/usr/bin/env node\n// COPIED FROM \`pkg/${name}.ts\` at abc1234 (#1): a test copy.\n// ==== end of copy header ====\nexport {};\n`;
  put(join(root, "entry.ts"), 'import "./lib/reached-copy.ts";\nimport "./lib/reached-plain.ts";\n// import "./lib/in-a-comment.ts";\n');
  put(join(lib, "reached-copy.ts"), `${header("reached-copy")}import "./second-hop-copy.ts";\n`);
  put(join(lib, "second-hop-copy.ts"), header("second-hop-copy"));
  put(join(lib, "reached-plain.ts"), "export {};\n");
  put(join(lib, "unreached-copy.ts"), header("unreached-copy"));
  put(join(lib, "in-a-comment.ts"), header("in-a-comment"));
  assert.deepEqual(copiedStemsIn(closureOf([join(root, "entry.ts")]), lib), ["reached-copy", "second-hop-copy"]);
});

test("the stems and the toolchain version this run compares are named, and each has a probe table", () => {
  console.log(`bootstrap-copies: comparing ${STEMS.length} copies [${STEMS.join(", ")}] with ${TOOLCHAIN}@${VERSION} (declared ${declaredRange()})`);
  assert.ok(STEMS.every((stem) => stem in PROBE_TABLES), `no probe table for [${STEMS.filter((stem) => !(stem in PROBE_TABLES))}]: add one to PROBE_TABLES, the stem is compared by its exported names only until then`);
});

for (const stem of STEMS) {
  test(`src/lib/${stem}.ts behaves like ${TOOLCHAIN}/lib/${stem} at ${VERSION}`, async () => {
    const probes = PROBE_TABLES[stem]?.() ?? {};
    const reference = await toolchainModule(stem);
    const copy = await copyModule(stem);
    assert.ok(Object.keys(reference).length > 0, `${TOOLCHAIN}/lib/${stem} exports nothing: the comparison would pass anything`);
    for (const [name, value] of Object.entries(copy)) {
      if (typeof value === "function") assert.notEqual(value, reference[name], `${stem}.${name} is the toolchain's own function: both sides are one module and nothing was compared`);
    }
    assert.deepEqual(compare(reference, copy, probes, fixtures()), [], `${stem} has drifted from ${TOOLCHAIN}@${VERSION}`);
  });
}

for (const stem of STEMS.filter((name) => name in PROBE_TABLES)) {
  test(`positive control: the comparison for ${stem} passes a copy altered only in a comment and reports an extra export`, async () => {
    const probes = PROBE_TABLES[stem]();
    const reference = await toolchainModule(stem);
    const commented = await alteredCopy(stem, (text) => `${text}\n// a comment only, not drift\n`);
    // read against the unaltered copy's own answer, not against `[]`: a copy that has really drifted is the stem's test to report, and only that one
    assert.deepEqual(compare(reference, commented, probes, fixtures()), compare(reference, await copyModule(stem), probes, fixtures()),
      "a copy that differs only in a comment must read exactly as the unaltered copy does");
    const extended = await alteredCopy(stem, (text) => `${text}\nexport const driftedExport = 1;\n`);
    assert.match(compare(reference, extended, probes, fixtures()).join("\n"), /driftedExport/, "an export the toolchain does not have must be reported");
  });

  test(`positive control: each export of ${stem} replaced in turn is reported by its own probe`, async () => {
    const probes = PROBE_TABLES[stem]();
    const reference = await toolchainModule(stem);
    assert.deepEqual(compare(reference, { ...reference }, probes, fixtures()), [], "the unaltered pair must report nothing, or every replacement below is reported for the wrong reason");
    for (const name of Object.keys(reference)) {
      const drifted = { ...reference, [name]: typeof reference[name] === "function" ? () => "drifted" : { drifted: true } };
      const reported = compare(reference, drifted, probes, fixtures());
      assert.ok(reported.some((line) => line.startsWith(`${name} probe `)), `replacing ${stem}.${name} was not reported by a probe of ${name}: ${JSON.stringify(reported)}`);
    }
  });
}

test("the fixtures are observable: the comparisons do not pass on two silent or empty answers", async () => {
  const ctx = fixtures();
  const flags = await toolchainModule("cli-flags");
  const refused = refusal(flags, KNOWN, ["--lst"], true);
  assert.equal(refused.exitCode, 2, "the toolchain's refusal must exit 2 for the refusal probes to compare anything");
  assert.match(refused.lines.join("\n"), /did you mean --list/);
  assert.equal(refusal(flags, KNOWN, ["--lst"], false).exitCode, "no exit");

  const git = await toolchainModule("git-env");
  assert.ok(!Object.keys(inProcess({ env: { GIT_DIR: "/x", KEEP: "1" } }, () => call(git, "sandboxGitEnv") as Record<string, string>)).includes("GIT_DIR"));

  const npm = await toolchainModule("npm-cli-executable");
  const candidates = inProcess({ env: { PATH: ctx.bin } }, () => call(npm, "npmCliScriptCandidates", "npm") as string[]);
  assert.equal(candidates.at(-1), join(ctx.bin, "npm-cli.js"), "the PATH-derived candidate must be the fixture's, or the PATH probes compare the node install's alone");
  assert.equal((inProcess({ env: { PATH: ctx.cmdWithScript } }, () => call(npm, "pnpmCliInvocation", ["x"]) as { args: string[] })).args.length, 2);

  const changed = await toolchainModule("changed-files");
  assert.deepEqual((call(changed, "changedFiles", ["origin/main...HEAD"], { repoRoot: ctx.repo }) as string[]).sort(),
    ["docs/guide.md", "packages/evidence/src/new.ts", "packages/judge/src/a.ts", "scripts/move-me.mjs", "tools/move-me.mjs"]);

  const closure = await toolchainModule("local-import-closure");
  assert.deepEqual((call(closure, "localImports", join(ctx.imports, "a.ts")) as string[]).map((file) => relative(ctx.imports, file)),
    ["b.ts", "c.ts", "d.mjs", "e.js", "sub", "b.ts", "c.ts", "d.mjs", "only-mjs.mjs", "only-js.js", "ts-and-mjs.ts", "mjs-and-js.mjs"]); // `./sub` is the directory itself: the same on both sides, which is what is compared
  assert.deepEqual(call(closure, "importedNamesFor", join(ctx.imports, "a.ts"), join(ctx.imports, "only-mjs.mjs")), ["fromMjs"]);
  assert.deepEqual(call(closure, "importedNamesFor", join(ctx.imports, "a.ts"), join(ctx.imports, "b.ts")), ["b", "y", "z"]);

  const resolution = await toolchainModule("worktree-resolution");
  const kindOf = (name: string) => (call(resolution, "worktreeResolution", ctx.kinds[name]) as { kind: string }).kind;
  assert.deepEqual(["allOwn", "stale", "foreign", "dangling", "bare"].map(kindOf),
    ["own-packages", "stale-copy", "other-checkout", "nothing-linked", "nothing-linked"]);
  assert.equal((call(resolution, "suiteStartVerdict", "/wt", { env: {}, ...FAKE_FS }) as { action: string }).action, "refuse");
});
