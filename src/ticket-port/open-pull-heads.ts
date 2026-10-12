// agent-org#1167: a repository's open pull requests with the fields the prune's open-PR hold reads (number, url, head branch, labels), read through
// an injected `run` (`gh`, as the caller hands it in). This file names no `gh` and spawns nothing: `ticket-port.test.ts` (#484) holds the port to
// that, and the spawn stays with whoever owns the runner (`defaultGh` in `worktree-removal.ts`).

/** An open pull request as the prune's hold reads it: its number, its URL, its head branch, and the names of its labels. */
export type OpenPullHead = { number: number, url: string, headRefName: string, labels: string[] };
/** `read: false` carries the reason: a failed read is never an empty list, because "could not read" is not "nothing is open". */
export type OpenPullHeads = { read: true, pulls: OpenPullHead[] } | { read: false, reason: string };

/**
 * THE OPEN PULL REQUESTS of `repo`, or why they could not be read: a refused `run`, an answer that is not a list, and a list that fills
 * `limit` (a full page may be cut short, so it is refused rather than trusted).
 */
export function readOpenPullHeads(repo: string, run: (args: string[]) => string, limit: number): OpenPullHeads {
  let parsed: unknown;
  try {
    parsed = JSON.parse(run(["pr", "list", "--repo", repo, "--state", "open", "--limit", String(limit), "--json", "number,url,headRefName,labels"]));
  } catch (error) {
    return { read: false, reason: `the open pull request listing failed: ${String((error as Error).message).split("\n")[0]}` };
  }
  if (!Array.isArray(parsed)) return { read: false, reason: "the open pull request listing did not return a list" };
  if (parsed.length >= limit) return { read: false, reason: `there are ${limit} or more open pull requests, the listing limit` };
  const rows = parsed as { number: number, url: string, headRefName: string, labels?: { name: string; }[] }[];
  return { read: true, pulls: rows.map((row) => ({ number: row.number, url: row.url, headRefName: row.headRefName, labels: (row.labels ?? []).map((label) => label.name) })) };
}
