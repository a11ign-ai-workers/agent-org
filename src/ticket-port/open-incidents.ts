// agent-org#943: a repository's open incident issues, read through an injected `run` (`gh`, as the caller hands it in). This file spawns nothing:
// the spawn stays with whoever owns the runner, as `open-pulls.ts` leaves it.

/** An open incident issue as the consumer reads it: its number, title, creation time as ISO, and its body, which names the incident's kind. */
export type OpenIncidentRead = { number: number; title: string; createdAt: string; body: string; };

/**
 * THE OPEN INCIDENT ISSUES OF `repo`, pull requests dropped, or `null` for "could not ask": a refused `run`, and an answer that does not parse.
 * `null` is never "no incident": a caller that reads a failed read as an empty list would call a stopped fleet clear.
 */
export function openIncidentsOf(repo: string, run: (args: string[]) => string): OpenIncidentRead[] | null {
  try {
    const issues: OpenIncidentRead[] = JSON.parse(run(["api", "--method", "GET", `repos/${repo}/issues`, "-f", "state=open", "-f", "labels=incident", "-f", "per_page=100",
      "--jq", "[.[] | select(.pull_request | not) | {number, title, createdAt: .created_at, body}]"]));
    return Array.isArray(issues) ? issues : null;
  } catch (error) {
    void error; // no list is "cannot say", which the reading calls unknown
    return null;
  }
}
