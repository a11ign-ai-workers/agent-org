// no-token: none -- reads one file through an injected `read` and spawns nothing; no tracker, token or process is reached.
// agent-org#902 (Move 3 option of a11ign/a11ign#4505): HOW A WAKE CLASS IS SERVED, CHOSEN BY THE PROJECT IN ONE FILE.
//
// `.agent-org/seats.json` is `{ "<cause>": "seat" | "run" }`: `seat` is the standing seat that is prompted today, `run` is a one-shot decision run
// (`decision-run/run.ts`). A project that has no such file is served by its seats, exactly as before this module existed.
//
// EVERY DOUBT READS `seat`, and it is the only direction a doubt may read:
//   - no file, or a file that is `{}`                                  -> `seat`, quietly (the project has not chosen);
//   - a file that cannot be read, is not JSON or is not an object      -> EVERY class is `seat` and ONE line names the file;
//   - a cause the file does not name                                   -> `seat`;
//   - a value that is not exactly "seat" or "run"                      -> that cause is `seat` and ONE line names the file and the cause;
//   - a cause the registry (`decision-run/registry.ts`) does not hold  -> `seat`, even where the file says `run`: nothing exists to run it.
// A diagnostic never carries what the file held (the text is configuration somebody wrote, and `readSwitches` in `decision-provider.ts` keeps the same rule).
//
// THE ONE-LINE REVERT is deleting the file, or setting the cause to `seat`. NO WAKE PATH CALLS {@link seatModeOf} YET: this row is the option and the
// reading of it, and a caller is a later row.
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type SeatMode = "seat" | "run";

const SEATS_FILE = join(".agent-org", "seats.json");
/** The project's seats file, relative to the project root. */
export const seatsPath = (projectDir: string): string => join(projectDir, SEATS_FILE);

/** Something that says whether a cause has a registered class: the `Map` `loadClasses` returns, or a `Set` of names. */
export type KnownCauses = Readonly<{ has(cause: string): boolean }>;

export type SeatModeDeps = Readonly<{
  /** The seats file (see {@link seatsPath}). */
  path: string;
  /** The causes the registry holds: a cause outside it is `seat` whatever the file says. */
  known: KnownCauses;
  read?: typeof readFileSync;
  diagnostic?: (line: string) => void;
  /** What has been said already, so a line is said once per file and once per cause. Defaults to this process's. */
  warned?: Set<string>;
}>;

const processWarned = new Set<string>();
const printLine = (line: string): void => { process.stderr.write(`${line}\n`); };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function say(deps: SeatModeDeps, key: string, what: string): void {
  const warned = deps.warned ?? processWarned;
  if (warned.has(key)) return;
  warned.add(key);
  (deps.diagnostic ?? printLine)(`agent-org: seat-mode: ${what}`);
}

/** The file's object, or `null` when it is absent or cannot be used (and ONE line says so, unless it is simply absent). */
function readSeats(deps: SeatModeDeps): Record<string, unknown> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(String((deps.read ?? readFileSync)(deps.path, "utf8")));
  } catch (err) {
    if ((err as { code?: string })?.code === "ENOENT") return null;
    say(deps, deps.path, `${deps.path} could not be read as JSON, so every wake class is served by its standing seat`);
    return null;
  }
  if (!isRecord(parsed)) {
    say(deps, deps.path, `${deps.path} is not an object of "seat" and "run" values, so every wake class is served by its standing seat`);
    return null;
  }
  return parsed;
}

/** How `cause` is served: `run` only when the registry holds it AND the file says exactly `run`; every other state is `seat`. */
export function seatModeOf(cause: string, deps: SeatModeDeps): SeatMode {
  if (!deps.known.has(cause)) return "seat";
  const seats = readSeats(deps);
  // An own property only: `__proto__`, `constructor` and the rest of `Object.prototype` are not causes the file named.
  if (seats === null || !Object.hasOwn(seats, cause)) return "seat";
  const value = seats[cause];
  if (value === "run") return "run";
  if (value !== "seat") {
    say(deps, `${deps.path}\0${cause}`, `${deps.path} gives the cause ${JSON.stringify(cause)} a value that is not "seat" or "run", so it is served by its standing seat`);
  }
  return "seat";
}
