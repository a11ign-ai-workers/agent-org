// THE DAILY READING'S TWO FIGURES FOR #5153 item 5: "nobody can say whether the automation is working" (a11ign#928).
//
//   pinRows   hand-filed rows in the last PIN_BUMP_WINDOW_DAYS whose title or body is a pin or a bump. A bot did not file them, so a
//             bot author (`[bot]`, `app/`) does not count. A row this measure cannot date makes the count `null` (unknown), never 0.
//   renovate  per repository: open Renovate PRs older than STUCK_RENOVATE_PR_MINUTES (`aged`) and those whose last check is red (`red`).
//             "Red" is `isBrokenRed` from `red-pr.ts`, the one decider the org-health reading uses, so the two cannot disagree. A
//             repository whose PRs could not be read is `unknown`, never a clear.
//
// A LEAF: it reads nothing. The caller hands in the rows and the PRs it read, so the tests are fixtures and no `gh` runs here.
import { isBrokenRed } from "./red-pr.ts";

export const PIN_BUMP_WINDOW_DAYS = 7;
export const STUCK_RENOVATE_PR_MINUTES = 60;

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 24 * 60 * MS_PER_MINUTE;

// `bump`, `re-pin`, and `pin` with a `to` after it (`pin foo to 1.2.3`). The loose `to` is on purpose: the words a pin row is titled with vary.
const PIN_OR_BUMP = /\bbump(?:s|ed|ing)?\b|\bre-pin\b|\bpin\b[\s\S]{0,80}?\bto\b/i;
// A bot author: `renovate[bot]`, `app/renovate`, `dependabot[bot]` and the rest. A row a bot filed was not filed by hand.
const BOT_AUTHOR = /\[bot\]$|^app\//i;
// Renovate's login as `gh pr list --json author` spells it (`app/renovate`), as REST spells it (`renovate[bot]`), or plain.
const RENOVATE_AUTHOR = /^(?:app\/)?renovate(?:\[bot\])?$/i;

export type FiledRow = { title: string, body?: string | null, author: string | null, createdAt: string };
export type OpenPr = { number: number | string, author: string | null, createdAt: string, statusCheckRollup?: any[], labels?: any[] };
export type RepoPrs = { repo: string, prs: OpenPr[] | null };
export type RepoRenovate = { repo: string, aged: number, red: number } | { repo: string, unknown: true };
export type PinBumpMeasure = { pinRows: number | null, repos: RepoRenovate[] };

const timeOf = (text: string): number => Date.parse(text);

/**
 * Hand-filed rows in the window that are a pin or a bump. `null` when a row cannot be dated, since then the window cannot be answered.
 */
export function handFiledPinRowCount({ now, rows }: { now: number; rows: FiledRow[] | null; }): number | null {
  if (rows === null) return null;
  const since = now - PIN_BUMP_WINDOW_DAYS * MS_PER_DAY;
  let count = 0;
  for (const row of rows) {
    const filed = timeOf(row.createdAt);
    if (!Number.isFinite(filed)) return null;
    if (filed < since || BOT_AUTHOR.test(row.author ?? "")) continue;
    if (PIN_OR_BUMP.test(`${row.title}\n${row.body ?? ""}`)) count++;
  }
  return count;
}

/**
 * One repository's Renovate PRs: how many are older than the threshold, and how many have a red last check. `unknown` when its PRs were
 * not read, or when a Renovate PR has no readable age (its age cannot be counted, so neither can the repository).
 */
export function renovateCountOf({ now, repo, prs }: { now: number; repo: string; prs: OpenPr[] | null; }): RepoRenovate {
  if (prs === null) return { repo, unknown: true };
  let aged = 0;
  let red = 0;
  for (const pr of prs) {
    if (!RENOVATE_AUTHOR.test(pr.author ?? "")) continue;
    const opened = timeOf(pr.createdAt);
    if (!Number.isFinite(opened)) return { repo, unknown: true };
    if (now - opened > STUCK_RENOVATE_PR_MINUTES * MS_PER_MINUTE) aged++;
    if (isBrokenRed(pr)) red++;
  }
  return { repo, aged, red };
}

export function pinBumpMeasure({ now, rows, repos }: { now: number; rows: FiledRow[] | null; repos: RepoPrs[]; }): PinBumpMeasure {
  return {
    pinRows: handFiledPinRowCount({ now, rows }),
    repos: repos.map(({ repo, prs }) => renovateCountOf({ now, repo, prs })),
  };
}

/** The one line the daily reading posts on #928: both figures, the repository count, `unknown` where a read was refused, and the named thresholds. */
export function pinBumpLine(measure: PinBumpMeasure): string {
  const pins = measure.pinRows === null ? "unknown" : String(measure.pinRows);
  const repos = measure.repos.map((r) => ("unknown" in r ? `${r.repo} unknown` : `${r.repo} ${r.aged} aged / ${r.red} red`)).join("; ");
  return `Hand-filed pin or bump rows, last ${PIN_BUMP_WINDOW_DAYS} days: ${pins}. Renovate PRs across ${measure.repos.length} repositories `
    + `(aged = open over ${STUCK_RENOVATE_PR_MINUTES} min, red = last check red): ${repos}.`;
}
