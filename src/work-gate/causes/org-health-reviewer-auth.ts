import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { reviewerInstance } from "../../review-attribution.ts";
import { herdrRun } from "../reads.ts";
import { MS_PER_MINUTE, REVIEWER_REGISTRY_FILE, REVIEWER_STATE_DIR } from "../vocabulary.ts";

/** Every change of the credential's `last_refresh`, one JSON line each -- the reading ruling 2 asked for. */
export const REVIEWER_REFRESH_LEDGER_FILE = "reviewer-refreshes";

/** The reviewers' codex credential. Only `last_refresh` is ever read from it: the tokens beside it are secrets. */
export const CODEX_AUTH_FILE = `${process.env.HOME}/.codex/auth.json`;

/**
 * CODEX'S OWN AUTH-FAILURE TEXT (signal a), READ FROM CODEX AND NOT INVENTED.
 *
 * Measured 2026-09-24 by scanning the printable strings of the installed `codex-cli 0.156.1` binary
 * (`~/.codex/packages/standalone/releases/0.156.1-x86_64-unknown-linux-musl/bin/codex`), no refresh forced.
 * These are the user-facing messages of its auth-recovery path, each verbatim:
 *   - "Your access token could not be refreshed. Please log out and sign in again."
 *   - "Your access token could not be refreshed because you have since logged out or signed in to another
 *      account. Please sign in again."
 *   - "Your authentication session could not be refreshed automatically. Please log out and sign in again."
 *   - "OAuth refresh token was rejected: " and "Failed to refresh token: " (the error prefixes)
 * WHAT THIS DOES NOT PROVE: that any of them RENDERS in a pane as written. No live failure was available -- forcing one
 * could log out live reviewers, which ruling 2 excluded -- so the match is a needle into a pane's recent
 * output, and the first real refresh either finds it or is caught by signal (b). A new codex may reword
 * these; `docs/known-gaps.md` says so.
 */
export const CODEX_AUTH_FAILURE_TEXT = Object.freeze([
  "Your access token could not be refreshed",
  "Your authentication session could not be refreshed automatically",
  "OAuth refresh token was rejected",
  "Failed to refresh token",
]);

/**
 * THE LOGGED-OUT STARTUP SCREEN (signal a, second form): what codex 0.157.0's TUI showed at startup on a REJECTED
 * credential (a deliberately expired, structurally valid fake in a private `CODEX_HOME`, 401), 2026-09-25, read in
 * tmux. It dropped to onboarding and rendered none of the four phrases above:
 *   Welcome to Codex, OpenAI's command-line coding agent / Sign in with ChatGPT / or connect an API key
 * WHAT THIS DOES NOT ESTABLISH: what a pane that loses its login MID-SESSION renders -- the case a running reviewer
 * meets. It is the startup path only, and `docs/known-gaps.md` §49's refresh race stays unmeasured.
 * `anchor` is the welcome line and `alsoShows` must be in the same text: "Sign in with ChatGPT" alone is a phrase a
 * reviewer QUOTES in a review, so neither half fires on its own. A separate list so the four above, whose provenance
 * test reads the installed binary, are unchanged.
 */
export const CODEX_LOGGED_OUT_SCREEN = Object.freeze({
  anchor: "Welcome to Codex, OpenAI's command-line coding agent",
  alsoShows: "Sign in with ChatGPT",
});

/**
 * How long a reviewer may go without a verdict after the credential refreshed before that is called a failure.
 * A review is minutes of reading, not an hour, and a healthy reviewer that refreshed mid-review still answers
 * inside this; a number, not a measurement, and the refresh ledger is where the first real one is read.
 */
export const REVIEWER_SILENCE_MS = 30 * MS_PER_MINUTE;

/** The two causes whose recipient is a reviewer that owes a verdict. */
const REVIEWER_VERDICT_CAUSES = Object.freeze(["draft-awaiting-verdict", "verdict-comment-unreviewed"]);

/**
 * `credential.last_refresh` as epoch milliseconds, or `null` when the file cannot be read or carries none.
 * `null` is "could not ask" and signal (b) says nothing for it; it is never a time.
 */
export function readLastRefresh(path: string = CODEX_AUTH_FILE, read: (path: string, enc: "utf8") => string = readFileSync): number | null {
  try {
    const at = Date.parse(String(JSON.parse(read(path, "utf8"))?.last_refresh ?? ""));
    return Number.isNaN(at) ? null : at;
  } catch {
    return null;
  }
}

/**
 * The instances `wake.ts` started, from the registry file. `{}` for a missing file (nothing was started) AND for
 * one that will not parse -- the second is a lost reading, so it is never confused with an instance that FAILED.
 */
export function readReviewerRegistry(path: string, read: (path: string, enc: "utf8") => string = readFileSync): Record<string, { spawnedAt: number; }> {
  try {
    const parsed = JSON.parse(read(path, "utf8"));
    return parsed !== null && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * The phrase of codex's own auth-failure text a pane shows, or `null`. The logged-out startup screen answers with
 * its welcome line.
 */
export function authFailureShownIn(text: string | null | undefined): string | null {
  const shown = String(text ?? "");
  const { anchor, alsoShows } = CODEX_LOGGED_OUT_SCREEN;
  const loggedOut = shown.includes(anchor) && shown.includes(alsoShows) ? anchor : null;
  return CODEX_AUTH_FAILURE_TEXT.find((phrase) => shown.includes(phrase)) ?? loggedOut;
}

/**
 * The reviewer sessions this tick's orders say still OWE a verdict: an order addressed to `reviewer-<n>` for one
 * of the two verdict causes. The gate derives those from GitHub each tick, so "still emitted" is "still owed".
 */
export function sessionsOwingVerdict(orders: { session: string; cause?: string; }[]): Set<string> {
  return new Set(orders
    .filter((o) => REVIEWER_VERDICT_CAUSES.includes(String(o.cause)) && reviewerInstance(o.session) !== null)
    .map((o) => o.session));
}

/**
 * WHICH LIVE REVIEWER INSTANCES HAVE FAILED TO AUTHENTICATE -- two signals, each named on the failure it yields.
 *
 *   pane            (a) the instance's pane shows codex's own auth-failure text. Asked of EVERY registered instance,
 *                   because the text is the failure itself and needs no bound.
 *   refresh-silence (b) `last_refresh` is later than the instance's start, it still owes a verdict, and the refresh is
 *                   older than `silenceMs`. A healthy reviewer that refreshed answers inside the bound; one that
 *                   lost its login sits at the prompt and never does.
 *
 * (b) NEEDS THE VERDICT STILL OWED, and that is what keeps an idle instance -- verdict posted, PR waiting to
 * merge -- from reading as failed the moment the credential moves. A `paneText` that cannot be read is `null`,
 * which says nothing for (a) and leaves (b) to stand alone.
 */
export function reviewerAuthFailures({ instances, owing, lastRefresh, paneText, now, silenceMs = REVIEWER_SILENCE_MS }: {
        instances: Record<string, { spawnedAt: number; }>; owing: Set<string>; lastRefresh: number | null;
        paneText: (session: string) => string | null; now: number; silenceMs?: number;
    }): { session: string; signals: string[]; }[] {
  return Object.entries(instances).flatMap(([session, { spawnedAt }]) => {
    const signals = [];
    if (authFailureShownIn(paneText(session)) !== null) signals.push("pane");
    const refreshedSinceStart = lastRefresh !== null && lastRefresh > spawnedAt;
    if (refreshedSinceStart && owing.has(session) && now - lastRefresh > silenceMs) signals.push("refresh-silence");
    return signals.length > 0 ? [{ session, signals }] : [];
  });
}

/**
 * The incident order to `ceo`, or none. `ceo` because the remedy is a re-login of the reviewer's codex account, an
 * interactive step only the chairman can take (ruling 2). JUDGMENT-keyed on the failed set and the refresh it
 * followed, so the same failure is not re-asked every twenty minutes and a NEW one is a new question.
 */
export function reviewerAuthOrders(failures: { session: string; signals: string[]; }[], lastRefresh: number | null): { session: string; cause: string; subject: string; discriminator: string; prompt: string; causeKey: string; }[] {
  if (failures.length === 0) return [];
  const key = `${failures.map((f) => f.session).sort().join(".")}/${lastRefresh === null ? "no-refresh" : new Date(lastRefresh).toISOString()}`;
  return [{
    session: "ceo",
    cause: "reviewer-auth-failed",
    subject: "reviewer-auth",
    discriminator: key,
    prompt: `${failures.length} reviewer instance(s) have FAILED TO AUTHENTICATE with codex:\n`
      + failures.map((f) => `  ${f.session}  (${f.signals.join(" + ")})`).join("\n") + "\n"
      + "`pane` is codex's own auth-failure text in the instance's pane; `refresh-silence` is the credential's "
      + "`last_refresh` moving after the instance started while it still owes a verdict for more than "
      + `${REVIEWER_SILENCE_MS / MS_PER_MINUTE} minutes.\n`
      + "THE REMEDY IS A RE-LOGIN OF THE REVIEWER'S CODEX ACCOUNT, and only the chairman can do it (`codex "
      + "login`, interactive). Afterwards close each failed workspace (`herdr --session org workspace close "
      + "<id>`): the gate starts a fresh instance for a pull request that still needs a verdict on its next tick. "
      + "The reading is `reviewer-refreshes`, beside the wake ledger (every refresh, with the live-instance count).",
    causeKey: `ceo/reviewer-auth-failed/${key}`,
  }];
}

/**
 * The ledger lines to append for this tick: a `refresh` line when `last_refresh` differs from the newest recorded
 * one, and a `failure` line for each instance found failed on a refresh not yet recorded as failing.
 *
 * EVERY REFRESH IS A READING (ruling 2): how many instances were live when it moved, and whether any then
 * failed, so "the first real refresh is the measurement" is a file someone can read. A failure is detected up to
 * `REVIEWER_SILENCE_MS` AFTER the refresh, so it is its own line naming the refresh it followed, never a
 * rewrite of the `refresh` line.
 */
export function refreshLedgerLines({ ledger, lastRefresh, live, failures, now }: {
        ledger: { type: string; lastRefresh: string | null; session?: string; }[]; lastRefresh: number | null;
        live: string[]; failures: { session: string; signals: string[]; }[]; now: number;
    }): object[] {
  if (lastRefresh === null) return [];
  const iso = new Date(lastRefresh).toISOString();
  const at = new Date(now).toISOString();
  const lines = [];
  const known = ledger.some((l) => l.type === "refresh" && l.lastRefresh === iso);
  const hadOtherRefresh = ledger.some((l) => l.type === "refresh");
  if (!known) lines.push({ type: "refresh", at, lastRefresh: iso, live: live.length, liveSessions: live,
    firstRecorded: !hadOtherRefresh });
  for (const f of failures) {
    if (ledger.some((l) => l.type === "failure" && l.lastRefresh === iso && l.session === f.session)) continue;
    lines.push({ type: "failure", at, lastRefresh: iso, session: f.session, signals: f.signals });
  }
  return lines;
}

function readRefreshLedger(path: string, read: (path: string, enc: "utf8") => string = readFileSync) {
  try {
    return String(read(path, "utf8")).split("\n").filter((l) => l.trim() !== "").map((l) => JSON.parse(l));
  } catch {
    return [];
  }
}

/**
 * The live reviewer instances' panes as text, through herdr: workspace list, the pane of the one labelled
 * `session`, and that pane's recent output. `null` for anything herdr will not say -- never `""`, which would
 * read as "a pane that shows no failure".
 *
 * A HERDR CALL FROM THE GATE, AND THE ONE EXCEPTION to its header (which keeps herdr to `wake.ts` so this file
 * stays testable): the seam is `run`, INJECTED, and it is reached only for an instance in the registry, so a tick
 * with no reviewer instance makes no call at all.
 */
export function herdrPaneReader(run: (args: string[]) => string): (session: string) => string | null {
  return (session) => {
    try {
      const workspaces = JSON.parse(run(["--session", "org", "workspace", "list"]))?.result?.workspaces ?? [];
      const workspace = workspaces.find((w: any) => w.label === session)?.workspace_id;
      if (typeof workspace !== "string") return null;
      const panes = JSON.parse(run(["--session", "org", "pane", "list", "--workspace", workspace]))?.result?.panes ?? [];
      const pane = panes[0]?.pane_id;
      return typeof pane === "string" ? run(["--session", "org", "pane", "read", pane, "--lines", "60"]) : null;
    } catch {
      return null;
    }
  };
}

/**
 * The detector's whole tick: read the registry, the credential and the panes; append the refresh ledger; return
 * the incident order. Reads the SAME state directory `wake.ts` writes its registry into.
 *
 * NEVER THROWS -- a detector that can crash the gate would stop every order behind it. A failure to append the
 * ledger is said on stderr and the order is still returned.
 */
export function reviewerAuthTick({ orders, dir = REVIEWER_STATE_DIR, authFile = CODEX_AUTH_FILE, now = Date.now(),
  run = herdrRun, log = (line) => process.stderr.write(line) }: {
        orders: { session: string; cause?: string; }[]; dir?: string; authFile?: string; now?: number;
        run?: (args: string[]) => string; log?: (line: string) => void;
    }) {
  const instances = readReviewerRegistry(`${dir}/${REVIEWER_REGISTRY_FILE}`);
  const lastRefresh = readLastRefresh(authFile);
  const failures = reviewerAuthFailures({ instances, owing: sessionsOwingVerdict(orders), lastRefresh,
    paneText: Object.keys(instances).length > 0 ? herdrPaneReader(run) : () => null, now });
  const ledgerPath = `${dir}/${REVIEWER_REFRESH_LEDGER_FILE}`;
  const lines = refreshLedgerLines({ ledger: readRefreshLedger(ledgerPath), lastRefresh,
    live: Object.keys(instances), failures, now });
  try {
    if (lines.length > 0) {
      mkdirSync(dirname(ledgerPath), { recursive: true });
      appendFileSync(ledgerPath, lines.map((l) => `${JSON.stringify(l)}\n`).join(""));
    }
  } catch (err) {
    log(`reviewer-auth: could not append ${ledgerPath} (${String((err as any)?.message ?? err).split("\n")[0]}) -- the order below is unaffected.\n`);
  }
  return reviewerAuthOrders(failures, lastRefresh);
}
