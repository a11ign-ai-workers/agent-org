// @ts-check
// module: ticket mode's settings -- the host file's `clones` (the repositories a ticket can be queued to) and its optional `tickets` block
//
// MACHINE FACTS ONLY, IN THE HOST FILE AGENT-ORG ALREADY READS. Which repositories this machine has checked out, where worktrees go, how many
// workers it can carry and where the tracker's key lives are facts no repository can know, which is the host file's rule (`host-config.ts`'s
// header). Nothing here is a fact about a project: the person queueing a ticket chooses its repositories on the board.
//
// READ RAW, AS `haiku-brief.ts` READS ITS KEY. `readHostConfig` ignores unknown keys, so `tickets` is inert to every existing reader, and this
// module does not teach the strict reader a block only ticket mode uses. It imports neither `host-config.ts` nor `project-config.ts`: both
// resolve a project declaration at import, and ticket mode runs on a machine that declares none.
//
// IT REFUSES BY NAME. An absent host file, a `clones` that is not a map of absolute paths, and a mistyped `tickets` field are each refused naming
// the field, never answered with a guess.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

/** The variable that names the host file, as `project-config.ts` (`HOST_ENV`) spells it; restated so this module resolves nothing at import. */
export const HOST_FILE_ENV = "AGENT_ORG_HOST";

/** Where the tracker's key is read from: the macOS Keychain by service name, or a mode-600 file. */
export type KeySource = Readonly<{ keychain: string } | { path: string }>;

export type TicketSettings = Readonly<{
  /** Repository name -> its local checkout, as many as the machine has. */
  clones: Readonly<Record<string, string>>;
  max: number;
  port: number;
  herdrSession: string;
  worktreeRoot: string;
  stateDir: string;
  linearKey: KeySource;
}>;

export class TicketSettingsRefusal extends Error {
  readonly field: string;
  constructor(field: string, reason: string) {
    super(`ticket mode: \`${field}\` in the host file ${reason}`);
    this.field = field;
  }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function absolutePath(value: unknown, field: string): string {
  if (typeof value !== "string" || !isAbsolute(value)) throw new TicketSettingsRefusal(field, `must be an absolute path, not ${JSON.stringify(value)}`);
  return value;
}

function positiveInteger(value: unknown, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 1) throw new TicketSettingsRefusal(field, `must be a whole number of 1 or more, not ${JSON.stringify(value)}`);
  return value as number;
}

function keySource(value: unknown): KeySource {
  if (value === undefined) return { keychain: "agent-org-linear" };
  if (isObject(value) && typeof value.keychain === "string" && value.keychain !== "" && value.path === undefined) return { keychain: value.keychain };
  if (isObject(value) && value.keychain === undefined) return { path: absolutePath(value.path, "tickets.linearKey.path") };
  throw new TicketSettingsRefusal("tickets.linearKey", "must be { \"keychain\": \"<service>\" } or { \"path\": \"/abs/file\" }");
}

/**
 * The settings, from the host file's parsed JSON. PURE: the caller reads the file.
 * @param home the user's home directory, for the default state directory
 */
export function parseTicketSettings(host: unknown, home: string = homedir()): TicketSettings {
  if (!isObject(host)) throw new TicketSettingsRefusal("(root)", "must be a JSON object");
  const clones = host.clones;
  if (!isObject(clones) || Object.keys(clones).length === 0) {
    throw new TicketSettingsRefusal("clones", "must map at least one repository name to its checkout, e.g. { \"nbl-ui-netbox\": \"/abs/nbl-ui-netbox\" }");
  }
  const repos = Object.fromEntries(Object.entries(clones).map(([name, path]) => [name, absolutePath(path, `clones.${name}`)]));
  const tickets = host.tickets ?? {};
  if (!isObject(tickets)) throw new TicketSettingsRefusal("tickets", "must be an object when present");
  const stateDir = host.stateDir === undefined ? join(home, ".local", "state", "agent-org") : absolutePath(host.stateDir, "stateDir");
  const session = tickets.herdrSession ?? "tickets";
  if (typeof session !== "string" || !/^[A-Za-z0-9_-]+$/.test(session)) throw new TicketSettingsRefusal("tickets.herdrSession", "must be a herdr session name");
  return Object.freeze({
    clones: Object.freeze(repos),
    max: positiveInteger(tickets.max, "tickets.max", 3),
    port: positiveInteger(tickets.port, "tickets.port", 4747),
    herdrSession: session,
    worktreeRoot: tickets.worktreeRoot === undefined ? join(stateDir, "tickets", "worktrees") : absolutePath(tickets.worktreeRoot, "tickets.worktreeRoot"),
    stateDir,
    linearKey: keySource(tickets.linearKey),
  });
}

/** The settings from the file `$AGENT_ORG_HOST` names. REFUSES naming the variable when it is unset, and the file when it cannot be read. */
export function readTicketSettings(env: Record<string, string | undefined> = process.env, read: (path: string) => string = (path) => readFileSync(path, "utf8")): TicketSettings {
  const path = env[HOST_FILE_ENV];
  if (path === undefined || path === "") throw new TicketSettingsRefusal(HOST_FILE_ENV, "is unset: point it at a host file holding at least `clones`");
  let text: string;
  try {
    text = read(path);
  } catch {
    throw new TicketSettingsRefusal(HOST_FILE_ENV, `names ${path}, which cannot be read`);
  }
  try {
    return parseTicketSettings(JSON.parse(text));
  } catch (err) {
    if (err instanceof TicketSettingsRefusal) throw err;
    throw new TicketSettingsRefusal(HOST_FILE_ENV, `names ${path}, which is not valid JSON`);
  }
}
