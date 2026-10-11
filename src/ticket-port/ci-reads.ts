// agent-org#992: THE CODE HOST'S CI, read through an injected `run` (the caller's own runner). This file names no spawn and spawns nothing: `ticket-port.test.ts`
// (#484) holds the port to that. Each read THROWS when it could not be made or its answer is not the shape asked for, so a caller that turns a throw into
// "could not ask" can never read a refused call as an empty one (#1286).
//
// WHY HERE AND NOT IN `cross-repo-red.ts`: the committed call baseline (`gh-call-ratchet.test.ts`, #826) does not let a file outside this directory gain a
// call to the tracker's CLI, and a new file has no entry. The decision stays in `cross-repo-red.ts`; the calls are these.
type Run = (args: string[]) => string;

/** A check run or a job as the REST bodies carry it: only what is read. */
export type CiJob = { name: string; conclusion: string | null; details_url?: string };

const parse = (text: string, what: string): any => {
  const body = JSON.parse(text);
  if (body === null || typeof body !== "object") throw new Error(`the API returned no ${what}`);
  return body;
};

/** The head commit of one change. Throws on an empty answer. */
export function headOfChange(repo: string, number: string | number, run: Run): string {
  const head = run(["pr", "view", String(number), "--repo", repo, "--json", "headRefOid", "-q", ".headRefOid"]).trim();
  if (head === "") throw new Error("the change head was empty");
  return head;
}

/** The newest check run of each name on `head`, and how many exist (`total`, which is more than `checks.length` when a page was not read). */
export function checkRunsOfHead(repo: string, head: string, run: Run): { checks: CiJob[]; total: number } {
  const body = parse(run(["api", `repos/${repo}/commits/${head}/check-runs?per_page=100`]), "check-run list");
  if (!Array.isArray(body.check_runs)) throw new Error("the API returned no check-run list");
  return { checks: body.check_runs, total: typeof body.total_count === "number" ? body.total_count : body.check_runs.length };
}

/** The runs of `workflow` on `main` for one `event=<name>` filter, as the REST body carries them. */
export function workflowRunsOf(repo: string, workflow: string, eventFilter: string, run: Run): any[] {
  const body = parse(run(["api", "--method", "GET", `repos/${repo}/actions/workflows/${workflow}/runs`, "-f", "branch=main", "-f", eventFilter, "-f", "per_page=10"]), "run list");
  return Array.isArray(body.workflow_runs) ? body.workflow_runs : [];
}

/** The jobs of one workflow run. Throws when the answer carries no job list. */
export function jobsOfRun(repo: string, runId: string | number, run: Run): CiJob[] {
  const body = parse(run(["api", `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`]), "job list");
  if (!Array.isArray(body.jobs)) throw new Error("the API returned no job list");
  return body.jobs;
}

/** The failed steps' log of one workflow run: `job\tstep\tline` for every failed job. */
export function failedLogOfRun(repo: string, runId: string | number, run: Run): string {
  return run(["run", "view", String(runId), "--repo", repo, "--log-failed"]);
}

/** `OPEN` or `CLOSED` (upper-cased), or `""` for an answer that carries no state. Throws when the row could not be read, naming why in the runner's own message. */
export function stateOfRow(repo: string, number: string | number, run: Run): string {
  return String(parse(run(["issue", "view", String(number), "--repo", repo, "--json", "state"]), "row")?.state ?? "").toUpperCase();
}
