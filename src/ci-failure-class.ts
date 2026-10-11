// #4632: A RED PULL REQUEST'S FAILURE IS CLASSIFIED, AND ROUTED BY CLASS. A `pr-checks-failing` order says a check is red and leaves every judgment to its reader: whose defect, whether to
// rerun, whether another repository moved. This module answers those four from the failing test's error lines plus facts the CODE computed, and returns the class and its route as DATA.
//
// THE PROVIDER IS OPTIONAL (chairman, #4627). It goes through `decide` (`decision-provider.ts`) as the use `ci-failure-class`, so there is no client, key read or switch here. With no
// provider, no key, the use switched off, a refusal, a timeout or a confidence under the floor the answer is {@link fallbackClass}, and nothing breaks or nags.
//
// THE PROVIDER ONLY CLASSIFIES. It never reruns, labels or comments: the gate does that from {@link CiFailureDecision.route}, in its own code. The FACTS (does the same test fail on `main`,
// on other open PRs, does it read outside its repository, is the text a rate limit) are computed by the caller and passed in as state; they are never asked of the provider.
//
// THE CALLER IS `wake.ts` (#4888), NOT THE GATE: `work-gate.ts` is synchronous end to end and a provider call is not, so the gate's order is classified at the one async seam the tick has,
// beside `routesForStarts`, just before delivery. {@link readCiFailure} reads the facts there; they are CODE's reading of GitHub (REST, the core pool) and never the provider's.
import { readRowsByLabel } from "./ticket-port/rows-by-label.ts"; // #5039
import { decide, MAX_STATE_BYTES, type DecisionDeps, type Question } from "./decision-provider.ts";

export const CI_FAILURE_CLASSES = Object.freeze(["own-defect", "flaky", "another-repository-changed", "infrastructure"] as const);
export type CiFailureClass = (typeof CI_FAILURE_CLASSES)[number];
export const CI_FAILURE_ROUTES = Object.freeze(["owner", "rerun-once", "cross-repo-incident", "rerun-after-reset"] as const);
export type CiFailureRoute = (typeof CI_FAILURE_ROUTES)[number];

/** At most this many error lines are sent, so the state stays a few fields and never a log. */
export const MAX_ERROR_LINES = 40;
const MAX_LINE_CHARS = 160;
/** Room left under the decision seam's own state limit for the fields that are not error lines. */
const FACTS_HEADROOM_BYTES = 512;
const QUESTION = "class";
const INSTRUCTIONS = "A pull request's CI check is red. From the failing test's error lines and the facts, which class is the failure?";
// eslint-disable-next-line no-control-regex -- the escape character is what an ANSI control sequence starts with; this is ECMA-48's whole CSI form (colour `ESC[31;1m`, and `ESC[?25l` too)
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;

/** What is known about one red check. The four booleans are computed in code; `rerunAlready` is whether this run was already rerun once. */
export type CiFailureFacts = {
  /** The same test is red on `main` at the same time. */
  redOnMain: boolean;
  /** The same test is red on other open pull requests at the same time. */
  redOnOtherPrs: boolean;
  /** The test reads outside its repository (another repository's checkout, the network, the host). */
  readsOutsideRepository: boolean;
  /** The error text is a rate limit or a runner that was lost. */
  rateLimitOrRunnerLost: boolean;
  rerunAlready: boolean;
};
export type CiFailure = CiFailureFacts & { errorLines: readonly string[] };
export type CiFailureDecision = {
  klass: CiFailureClass;
  route: CiFailureRoute;
  /** `jev` when the provider chose the class, else `none`. */
  via: "jev" | "none";
  /** The provider's answer was replaced by the rule (or never asked); `reason` says why. */
  fellBack: boolean;
  reason?: string;
  confidence?: number;
};

const CRITERIA: Readonly<Record<CiFailureClass, string>> = Object.freeze({
  "own-defect": "the failure comes from this pull request's own change: the error names code or a test it touched and nothing else explains it.",
  flaky: "the test passes and fails without a change: a timing, ordering or race error, red on this pull request alone and not on main.",
  "another-repository-changed": "the test reads another repository or a pinned dependency, and that repository changed: the same test is red on main or on other pull requests.",
  infrastructure: "the runner, the network or a rate limit failed, whatever the code did.",
});

const ROUTES: Readonly<Record<CiFailureClass, CiFailureRoute>> = Object.freeze({
  "own-defect": "owner",
  flaky: "rerun-once",
  "another-repository-changed": "cross-repo-incident",
  infrastructure: "rerun-after-reset",
});

/**
 * THE RULE WITH NO PROVIDER. A rate-limit or runner-lost text is infrastructure FIRST, because a runner lost on `main` too is still not a repository that changed; the same test red on
 * `main` is another repository's change; everything else is the pull request's own defect, which is today's order unchanged.
 */
export function fallbackClass(facts: Pick<CiFailureFacts, "redOnMain" | "rateLimitOrRunnerLost">): CiFailureClass {
  if (facts.rateLimitOrRunnerLost) return "infrastructure";
  return facts.redOnMain ? "another-repository-changed" : "own-defect";
}

/** The class's route. A flaky failure is rerun ONCE: one already rerun goes to its owner, never a second rerun. */
export function routeFor(klass: CiFailureClass, rerunAlready: boolean): CiFailureRoute {
  return klass === "flaky" && rerunAlready ? ROUTES["own-defect"] : ROUTES[klass];
}

/** The first non-blank lines with colour codes removed and each line cut, kept under {@link MAX_ERROR_LINES} and the bytes the seam allows beside the facts. */
export function trimErrorLines(lines: readonly string[]): string[] {
  const kept: string[] = [];
  let bytes = FACTS_HEADROOM_BYTES;
  for (const raw of lines) {
    const line = raw.replace(ANSI, "").trim().slice(0, MAX_LINE_CHARS);
    if (line === "") continue;
    bytes += Buffer.byteLength(JSON.stringify(line)) + 1;
    if (kept.length >= MAX_ERROR_LINES || bytes > MAX_STATE_BYTES) break;
    kept.push(line);
  }
  return kept;
}

const stateOf = (failure: CiFailure, errorLines: readonly string[]) => ({
  errorLines,
  redOnMain: failure.redOnMain,
  redOnOtherPrs: failure.redOnOtherPrs,
  readsOutsideRepository: failure.readsOutsideRepository,
  rateLimitOrRunnerLost: failure.rateLimitOrRunnerLost,
});

const isClass = (value: unknown): value is CiFailureClass => typeof value === "string" && (CI_FAILURE_CLASSES as readonly string[]).includes(value);

/**
 * CLASSIFY ONE RED CHECK AND NAME WHERE IT GOES. Never throws and always returns a class: the provider's when it answered at or over the floor, {@link fallbackClass} otherwise.
 * `deps` is `decide`'s (the host, the switches, the log); pass `id` (the causeKey) so `recordOutcome` can later say whether the class was right.
 */
export async function classifyCiFailure(failure: CiFailure, deps: DecisionDeps): Promise<CiFailureDecision> {
  const fallback = fallbackClass(failure);
  const question: Question = { type: "choice", instructions: INSTRUCTIONS, criteria: CRITERIA, fallback };
  const state = stateOf(failure, trimErrorLines(failure.errorLines));
  const decision = await decide("ci-failure-class", state, { [QUESTION]: question }, deps);
  const answer = decision.answers[QUESTION];
  // The seam checks a choice against the criteria, so this is the belt to its braces: a value that is no class is the rule's.
  const klass = isClass(answer.value) ? answer.value : fallback;
  return {
    klass,
    route: routeFor(klass, failure.rerunAlready),
    via: decision.via,
    fellBack: decision.fellBack,
    ...(answer.reason === undefined && decision.reason === undefined ? {} : { reason: answer.reason ?? decision.reason }),
    ...(answer.confidence === undefined ? {} : { confidence: answer.confidence }),
  };
}

/** The line the order and the decision log carry: the class, the route and who chose. */
export const classLine = (d: CiFailureDecision): string => `CI failure class: ${d.klass} -> ${d.route} (${d.via === "jev" ? "provider" : "rule"}${d.reason === undefined ? "" : `: ${d.reason}`})`;

// ---------------------------------------------------------------------------------------------------
// THE FACTS (#4888). Read from GitHub by CODE and handed to {@link classifyCiFailure} as state. Every read is REST (`gh api`, the core pool the gate does not lean on), a failed read is
// `null` -- "could not determine", never "not red" -- and the caller then sends today's order unchanged.

/** `gh`, as an injected seam: the arguments after `gh`, the stdout back. */
export type Gh = (args: string[]) => string;
/** The pull request a red order is about: `repo` is `owner/name`, and `head8` is the head the order's cause key carries. */
export type RedPullRequest = { repo: string; number: number; head8: string };

/** A run this recent counts as "at the same time". A red `main` from last week is a different failure. */
export const SAME_TIME_MS = 6 * 60 * 60 * 1000;
const RUNS_LISTED = 50;
const MAIN_RUNS_LISTED = 10;
const LOG_LINES_KEPT = 200;
/** A line of a job log worth quoting: an error, a failed assertion or test. The log's own noise (the checkout, the cache, `##[group]`) is not. */
// No word boundaries: `AssertionError` and `TypeError` are the lines that matter, and a boundary after `error` would skip both.
const ERROR_LINE = /error|errno|fail|assert|not ok|exception|timed? ?out|rate limit|cancell?ed|\u2716|\u2717/i;
const RATE_LIMIT_OR_RUNNER_LOST = /rate limit|runner has received a shutdown signal|lost communication with the server|hosted runner .* lost|runner .* (?:was|has been) (?:lost|terminated)/i;
const READS_OUTSIDE = /\b(ENOTFOUND|EAI_AGAIN|ECONNRESET|ETIMEDOUT|ECONNREFUSED)\b|getaddrinfo|could not resolve host|unable to access '?https?:/i;
const RED_CONCLUSIONS = new Set(["failure", "timed_out"]);
const RUN_AND_JOB = /\/actions\/runs\/(\d+)\/job\/(\d+)/;

type CheckRun = { name?: string; conclusion?: string | null; details_url?: string | null };
type WorkflowRun = { name?: string; conclusion?: string | null; head_branch?: string; head_sha?: string; updated_at?: string; run_attempt?: number };

const json = (gh: Gh, path: string): any => JSON.parse(gh(["api", path]));
const recent = (run: WorkflowRun, now: number): boolean => now - Date.parse(String(run.updated_at)) <= SAME_TIME_MS;

/** Is the newest run of `workflow` on `main` red, and recent? The newest only: a green run since then is a repair. */
function redOnMainNow(runs: readonly WorkflowRun[], workflow: string, now: number): boolean {
  const newest = runs.find((run) => run.name === workflow);
  return newest !== undefined && newest.conclusion === "failure" && recent(newest, now);
}

/** Does another branch's recent run of `workflow` fail too? Compared by BRANCH, because a fork's run carries no pull request number. */
function redOnOtherPrsNow(runs: readonly WorkflowRun[], { workflow, branch, now }: { workflow: string; branch: string; now: number }): boolean {
  return runs.some((run) => run.name === workflow && run.conclusion === "failure" && run.head_branch !== branch && run.head_branch !== "main" && recent(run, now));
}

/**
 * THE FACTS OF ONE RED PULL REQUEST, or `null` when they could not be read or there is nothing red at the head the order names (the head moved, or the red check is not an Actions job).
 * The first failing check is the one classified: a pull request with several red checks is told about the first, and the order's own text still lists them all.
 * @param now an injected clock, so "at the same time" is testable
 */
export function readCiFailure({ repo, number, head8 }: RedPullRequest, gh: Gh, now: number = Date.now()): CiFailure | null {
  const pull = json(gh, `repos/${repo}/pulls/${number}`);
  const sha = String(pull?.head?.sha ?? "");
  if (!sha.startsWith(head8)) return null;
  const checks: CheckRun[] = json(gh, `repos/${repo}/commits/${sha}/check-runs?per_page=100`)?.check_runs ?? [];
  const red = checks.find((check) => RED_CONCLUSIONS.has(String(check.conclusion)));
  const ids = RUN_AND_JOB.exec(String(red?.details_url ?? ""));
  if (red === undefined || ids === null) return null;
  const run: WorkflowRun = json(gh, `repos/${repo}/actions/runs/${ids[1]}`);
  const workflow = String(run.name ?? "");
  // An Actions log carries colour codes, and `gh api` exits 1 on any terminal escape sequence unless told to allow it: without the flag this read never returned and no class was ever asked
  // (#767). The escapes are stripped HERE, once, so a coloured `##[error]` is matched by `ERROR_LINE` and `RATE_LIMIT_OR_RUNNER_LOST` as the plain line it is.
  const log = gh(["api", `repos/${repo}/actions/jobs/${ids[2]}/logs`, "--allow-escape-sequences"]).replace(ANSI, "");
  const errorLines = log.split("\n").filter((line) => ERROR_LINE.test(line)).slice(-LOG_LINES_KEPT);
  const onMain: WorkflowRun[] = json(gh, `repos/${repo}/actions/runs?branch=main&per_page=${MAIN_RUNS_LISTED}`)?.workflow_runs ?? [];
  const failing: WorkflowRun[] = json(gh, `repos/${repo}/actions/runs?status=failure&event=pull_request&per_page=${RUNS_LISTED}`)?.workflow_runs ?? [];
  return {
    errorLines,
    redOnMain: redOnMainNow(onMain, workflow, now),
    redOnOtherPrs: redOnOtherPrsNow(failing, { workflow, branch: String(pull?.head?.ref ?? ""), now }),
    readsOutsideRepository: errorLines.some((line) => READS_OUTSIDE.test(line)),
    rateLimitOrRunnerLost: RATE_LIMIT_OR_RUNNER_LOST.test(log),
    rerunAlready: Number(run.run_attempt ?? 1) > 1,
  };
}

const ROUTE_WORDS: Readonly<Record<CiFailureRoute, string>> = Object.freeze({
  owner: "The failure is this pull request's own: fixing it is yours.",
  "rerun-once": "A flaky failure: rerun the failed job ONCE (`gh run rerun <run id> --failed`); red again, it is your defect.",
  "cross-repo-incident": "Another repository or a pinned dependency changed: this is not this pull request's defect, so do not fix it here; file or join the cross-repository incident for the cause.",
  "rerun-after-reset": "The runner or a rate limit failed, not the code: change nothing; rerun the failed job after the limit resets.",
});

/** What the order's text gains when the PROVIDER chose the class: the line, and what the route asks of its reader. A rule's class changes nothing, which is today's order. */
export function classNote(decision: CiFailureDecision): string {
  return `${classLine(decision)}. ${ROUTE_WORDS[decision.route]}`;
}

// ---------------------------------------------------------------------------------------------------
// A FAILURE SHARED BY MANY PULL REQUESTS IS ONE INCIDENT (a11ign#5008). The four classes above are PER pull request, so the same broken setup step (#4988: the agent-org tool install) woke
// every red PR's worker and two of them diagnosed it separately; and when its fix merged nothing re-ran the red PRs, because a re-run tests the OLD merge commit.
//
//   1. {@link holdSharedFailures}: red orders whose failing check, failing step and first error line MATCH across two or more open PRs (or whose failing step is the runner's own setup,
//      which is never the PR's diff) are HELD -- nothing is written, as `holdForGithubIncident` does it -- and ONE incident row is filed or joined ({@link recordIncident}), its body
//      listing the PRs. A PR with any red check that is NOT shared still goes out as today, and so does one whose log could not be read (ABSENCE IS NOT PROOF).
//   2. {@link refreshFixed}: when the pull request closing an incident row has MERGED, every PR it notes is updated from main (`PUT /pulls/{n}/update-branch`), so CI runs against the fix
//      with no worker turn. A refusal (a conflict) is written on the row as `Refresh-failed:`, which stops that PR being held: its worker gets the order again.
//   3. The detector: an open PR whose red check failed BEFORE the fix merged, named like the incident's check, and still behind 10 minutes after the merge, is read, and refreshed
//      and noted on the row when its failure matches the incident's.
// THE ROW IS THE STATE: nothing is kept in a file. Every read that is refused leaves today's behaviour.

export const SHARED_FAILURE_LABEL = "ci-shared-failure";
/** A fix this young is still the notified PRs' to refresh; the detector waits this long before it takes a PR nobody noted. */
export const REFRESH_GRACE_MS = 10 * 60 * 1000;
const MAX_SIGNATURE_READS = 12;
const MAX_INCIDENT_ROWS = 20;
const SETUP_STEP = /^(set up job|initialize containers|complete job|checkout|run actions\/checkout)/i;
const SIGNATURE_NOISE: readonly [RegExp, string][] = [
  [/\d{4}-\d\d-\d\dT[\d:.]+Z\s*/g, ""], [/##\[error\]/g, ""], [/\b[0-9a-f]{7,40}\b/g, "<sha>"], [/\/home\/runner\/work\/\S*/g, "<path>"], [/\d+/g, "#"],
];

export type Run = (args: string[]) => string;
/** One red Actions check of an open pull request, as the rollup carries it. */
export type RedCheck = { name: string; detailsUrl: string; completedAt?: string };
/** An open pull request with red checks: `ref` is the order's own subject (`pr-7`, `pr-agent-org#7`), `repo` is `owner/name`. */
export type RedPr = { ref: string; repo: string; number: number; checks: RedCheck[]; headBehind?: boolean };
export type FailureSignature = { check: string; step: string; line: string };

const normalise = (line: string): string => SIGNATURE_NOISE.reduce((text, [pattern, to]) => text.replace(pattern, to), line.replace(ANSI, "")).trim().slice(0, MAX_LINE_CHARS);
/** The key two failures share when they are the same failure. */
export const signatureKey = ({ check, step, line }: FailureSignature): string => `${check} | ${step} | ${line}`;
const isSetup = (signature: FailureSignature): boolean => SETUP_STEP.test(signature.step);

/** The failing step and the first error line of one job, or `null` when either read was refused or the job has no failed step. Normalised, so two runs compare equal. */
export function readSignature(check: RedCheck, run: Run): FailureSignature | null {
  const ids = RUN_AND_JOB.exec(check.detailsUrl);
  const repo = /^https:\/\/github\.com\/([^/]+\/[^/]+)\//.exec(check.detailsUrl)?.[1];
  if (ids === null || repo === undefined) return null;
  try {
    const job = JSON.parse(run(["api", `repos/${repo}/actions/jobs/${ids[2]}`]));
    const step = (job?.steps ?? []).find((s: { conclusion?: string }) => s.conclusion === "failure");
    if (step === undefined) return null;
    const log = run(["api", `repos/${repo}/actions/jobs/${ids[2]}/logs`, "--allow-escape-sequences"]).replace(ANSI, "");
    const first = log.split("\n").find((line) => ERROR_LINE.test(line));
    return first === undefined ? null : { check: check.name, step: String(step.name), line: normalise(first) };
  } catch {
    return null; // a refused read: UNCLASSIFIED, never "shared"
  }
}

/** `prs` are the orders' subjects; `noted` the same pull requests as `owner/name#n`, which is how an incident row names them. */
export type SharedGroup = { key: string; signature: FailureSignature; prs: string[]; noted: string[] };
export const notedAs = (pr: Pick<RedPr, "repo" | "number">): string => `${pr.repo}#${pr.number}`;

/**
 * THE GROUPS OF THE TICK. A check name red on two or more of `prs` is read (one job each, at most {@link MAX_SIGNATURE_READS}); a group is the PRs whose signature key is equal and which
 * number two or more, or one PR whose failing step is the runner's own setup. A PR is in a group only when EVERY one of its red checks is (a second, own failure sends its order).
 */
export function sharedFailureGroups(prs: readonly RedPr[], read: (check: RedCheck) => FailureSignature | null): SharedGroup[] {
  let reads = 0;
  const keyed = new Map<string, { signature: FailureSignature; prs: Set<string> }>();
  const unshared = new Set<string>();
  for (const pr of prs) {
    for (const check of pr.checks) {
      const signature = reads < MAX_SIGNATURE_READS ? (reads++, read(check)) : null;
      if (signature === null) { unshared.add(pr.ref); continue; }
      const group = keyed.get(signatureKey(signature)) ?? { signature, prs: new Set<string>() };
      group.prs.add(pr.ref);
      keyed.set(signatureKey(signature), group);
    }
  }
  const shared = [...keyed.entries()].filter(([, g]) => g.prs.size >= 2 || isSetup(g.signature));
  const sharedRefs = new Map<string, number>();
  for (const [, g] of shared) for (const ref of g.prs) sharedRefs.set(ref, (sharedRefs.get(ref) ?? 0) + 1);
  const redCount = new Map(prs.map((pr) => [pr.ref, pr.checks.length]));
  const whole = (ref: string) => !unshared.has(ref) && (sharedRefs.get(ref) ?? 0) === redCount.get(ref);
  const noted = new Map(prs.map((pr) => [pr.ref, notedAs(pr)]));
  return shared.map(([key, g]) => ({ key, signature: g.signature, prs: [...g.prs].filter(whole) }))
    .filter((g) => g.prs.length > 0).map((g) => ({ ...g, noted: g.prs.map((ref) => noted.get(ref)!) }));
}

/** Filter-cheap: only a PR with a red check name that is red on two PRs is worth a log read (whether ALL its red checks are shared is decided after). A lone red PR costs no read, so a lone setup failure is today's order. */
export const candidates = (prs: readonly RedPr[]): RedPr[] => {
  const seen = new Map<string, number>();
  for (const pr of prs) for (const name of new Set(pr.checks.map((c) => c.name))) seen.set(name, (seen.get(name) ?? 0) + 1);
  return prs.filter((pr) => pr.checks.some((c) => (seen.get(c.name) ?? 0) >= 2));
};

export type HeldOrder = { subject: string; session: string; key: string };
/**
 * HOLD, DO NOT WAKE: the settled-red `pr-checks-failing` orders of a shared failure are withheld and everything else goes out unchanged. `refused` are the PRs whose refresh was refused,
 * which are never held again. Pure given `run`.
 */
export function holdSharedFailures<O extends { cause?: string; subject?: string; session?: string; discriminator?: string }>(
  orders: readonly O[], { prs, run, refused = [] }: { prs: readonly RedPr[]; run: Run; refused?: readonly string[] },
): { orders: O[]; held: HeldOrder[]; groups: SharedGroup[] } {
  const ordered = new Set(orders.filter((o) => o.cause === "pr-checks-failing" && o.discriminator !== "hung-check" && o.discriminator !== "ejected").map((o) => o.subject));
  const open = candidates(prs.filter((pr) => ordered.has(pr.ref)));
  const released = new Set(prs.filter((pr) => refused.includes(notedAs(pr))).map((pr) => pr.ref));
  const groups = sharedFailureGroups(open, (check) => readSignature(check, run));
  const keyOf = new Map(groups.flatMap((g) => g.prs.filter((ref) => !released.has(ref)).map((ref) => [ref, g.key] as const)));
  const held: HeldOrder[] = [];
  const kept = orders.filter((o) => {
    const key = o.cause === "pr-checks-failing" ? keyOf.get(String(o.subject)) : undefined;
    if (key !== undefined) held.push({ subject: String(o.subject), session: String(o.session), key });
    return key === undefined;
  });
  return { orders: kept, held, groups };
}

// ---- the incident row
const hashOf = (key: string): string => {
  let h = 0;
  for (const ch of key) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
  return h.toString(16).padStart(8, "0");
};
const markerOf = (key: string): string => `<!-- ${SHARED_FAILURE_LABEL}:${hashOf(key)} -->`;
const PRS_LINE = /^Shared-failure-prs: (.*)$/m;
const FAILED_LINE = /^Refresh-failed: (.*)$/m;
const REFRESHED_LINE = /^Refreshed-at: /m;
const CHECK_LINE = /^Check: (.*)$/m;
const listOf = (body: string, line: RegExp): string[] => (line.exec(body)?.[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");

type IncidentRow = { number: number; body: string; state?: string; closedByPullRequestsReferences?: { number: number; repository?: { nameWithOwner?: string } }[] };
/**
 * #5039: THE INCIDENT ROWS, READ WITHOUT SEARCH (see rows-by-label.ts), and a FAILED READ THROWS: it used to answer `[]`, which read as "no
 * incident row", so a tick that could not list them filed a second row for the same failure. The two callers that file or join catch it.
 */
const readRows = (run: Run, state: "open" | "closed"): IncidentRow[] =>
  readRowsByLabel({ label: SHARED_FAILURE_LABEL, state: state === "open" ? "OPEN" : "CLOSED", newest: MAX_INCIDENT_ROWS, run,
    select: "number body closedByPullRequestsReferences(first:10){nodes{number repository{nameWithOwner}}}" })
    .map((row) => ({ number: Number(row.number), body: String(row.body ?? ""),
      closedByPullRequestsReferences: row.closedByPullRequestsReferences?.nodes ?? [] }));

const bodyOf = (group: SharedGroup, prs: readonly string[]): string => [
  `A failure shared by ${prs.length} open pull request(s), found by the gate: one incident, and the workers of these PRs are not woken for it.`, "",
  `Check: ${group.signature.check}`, `Step: ${group.signature.step}`, `First error line: ${group.signature.line}`, "",
  `Shared-failure-prs: ${prs.join(", ")}`, "",
  "When the pull request that closes this row MERGES, the gate updates each PR above from main so CI runs against the fix. Close this row with the fix's `Closes`.", markerOf(group.key),
].join("\n");

/** File the incident row for `group`, or add its PRs to the open one. Returns the row number, or `null` when `gh` refused (the next tick retries). */
export function recordIncident(group: SharedGroup, { run, log }: { run: Run; log: (line: string) => void }): number | null {
  try {
    const found = readRows(run, "open").find((row) => String(row.body).includes(markerOf(group.key)));
    if (found === undefined) {
      run(["label", "create", SHARED_FAILURE_LABEL, "--force", "--description", "One CI failure shared by several open pull requests"]);
      const title = `CI failure shared by ${group.prs.length} PRs: ${group.signature.check}: ${group.signature.line}`.slice(0, 120);
      const out = run(["issue", "create", "--title", title, "--label", SHARED_FAILURE_LABEL, "--body", bodyOf(group, group.noted)]);
      return Number(/\/issues\/(\d+)/.exec(out)?.[1] ?? NaN) || null;
    }
    const noted = listOf(found.body, PRS_LINE);
    const merged = [...new Set([...noted, ...group.noted])];
    if (merged.length !== noted.length) run(["issue", "edit", String(found.number), "--body", bodyOf(group, merged)]);
    return found.number;
  } catch (error) {
    log(`ci-shared-failure: could not file or join the incident for ${group.key} (${String((error as Error).message).split("\n")[0]}); the next tick retries\n`);
    return null;
  }
}

// ---- the refresh
/** `PUT update-branch` for one pull request, `true` when GitHub accepted it, `false` when it refused (a conflict) -- never throws. */
function updateBranch(repo: string, number: number, run: Run): boolean {
  try {
    run(["api", "-X", "PUT", `repos/${repo}/pulls/${number}/update-branch`]);
    return true;
  } catch {
    return false;
  }
}
const parseRef = (ref: string): { repo: string; number: number } | null => {
  const m = /^([^/\s]+\/[^#\s]+)#(\d+)$/.exec(ref);
  return m === null ? null : { repo: m[1], number: Number(m[2]) };
};

/**
 * THE FIX REFRESHES ITS VICTIMS. Each closed incident row not yet `Refreshed-at` whose closing pull request
 * merged is handled once: its noted PRs, still open and behind, are updated; a refusal is written as `Refresh-failed:`; then the row is stamped. Returns what was refreshed and what refused.
 */
export function refreshFixed({ run, log, nowMs = Date.now(), open = [] }: {
  run: Run; log: (line: string) => void; nowMs?: number; open?: readonly RedPr[];
}): { refreshed: string[]; refused: string[] } {
  const refreshed: string[] = [];
  const refused: string[] = [];
  for (const row of readRows(run, "closed").filter((r) => !REFRESHED_LINE.test(String(r.body)))) {
    const mergedAt = mergedFixAt(row, run);
    if (mergedAt === null) continue;
    const noted = listOf(row.body, PRS_LINE);
    const late = nowMs - mergedAt >= REFRESH_GRACE_MS ? lateVictims(row, { open, mergedAt, run }).filter((ref) => !noted.includes(ref)) : [];
    const failed: string[] = [];
    for (const ref of [...noted, ...late]) {
      const parsed = parseRef(ref);
      if (parsed === null) continue;
      if (!stillOpenAndBehind(parsed.repo, parsed.number, run)) continue;
      (updateBranch(parsed.repo, parsed.number, run) ? refreshed : failed).push(ref);
    }
    refused.push(...failed);
    stamp(row, { late, failed, run, log, nowMs });
  }
  return { refreshed, refused };
}

const mergedFixAt = (row: IncidentRow, run: Run): number | null => {
  for (const pr of row.closedByPullRequestsReferences ?? []) {
    try {
      const repo = pr.repository?.nameWithOwner;
      const read = JSON.parse(run(["api", `repos/${repo}/pulls/${pr.number}`]));
      if (read?.merged_at) return Date.parse(read.merged_at);
    } catch {
      continue;
    }
  }
  return null;
};

function stillOpenAndBehind(repo: string, number: number, run: Run): boolean {
  try {
    const pull = JSON.parse(run(["api", `repos/${repo}/pulls/${number}`]));
    if (pull?.state !== "open") return false;
    const cmp = JSON.parse(run(["api", `repos/${repo}/compare/${pull.base?.ref ?? "main"}...${pull.head?.sha}`]));
    return Number(cmp?.behind_by ?? 0) > 0;
  } catch {
    return false; // could not tell: not touched
  }
}

/** Open PRs red on the incident's check since BEFORE the fix merged, whose failure matches the incident's: the ones nobody noted. */
function lateVictims(row: IncidentRow, { open, mergedAt, run }: { open: readonly RedPr[]; mergedAt: number; run: Run }): string[] {
  const check = CHECK_LINE.exec(row.body)?.[1]?.trim();
  const wanted = /^First error line: (.*)$/m.exec(row.body)?.[1]?.trim();
  if (check === undefined || wanted === undefined) return [];
  return open.filter((pr) => pr.checks.some((c) => c.name === check && Date.parse(String(c.completedAt)) < mergedAt && readSignature(c, run)?.line === wanted)).map(notedAs);
}

function stamp(row: IncidentRow, { late, failed, run, log, nowMs }: { late: string[]; failed: string[]; run: Run; log: (line: string) => void; nowMs: number }): void {
  const prior = listOf(row.body, FAILED_LINE);
  const lines = [
    ...(late.length > 0 ? [`Late-victims: ${late.join(", ")}`] : []),
    ...(failed.length + prior.length > 0 ? [`Refresh-failed: ${[...new Set([...prior, ...failed])].join(", ")}`] : []),
    `Refreshed-at: ${new Date(nowMs).toISOString()}`,
  ];
  try {
    run(["issue", "edit", String(row.number), "--body", `${row.body}\n\n${lines.join("\n")}`]);
  } catch (error) {
    log(`ci-shared-failure: refreshed but could not stamp #${row.number} (${String((error as Error).message).split("\n")[0]}); the next tick tries again\n`);
  }
}

/** PRs whose refresh a refusal stopped: they are never held again, so the worker's order goes out as today. */
export function refusedRefreshes(run: Run): string[] {
  return [...readRows(run, "open"), ...readRows(run, "closed")].flatMap((row) => listOf(String(row.body), FAILED_LINE));
}

/**
 * THE TICK'S ONE CALL. Refresh what a merged fix owes, hold what a shared failure owes nobody, file or join the incident, and return what remains. Never throws: a tick that cannot
 * do this sends the orders as it always did.
 */
export function sharedFailureTick<O extends { cause?: string; subject?: string; session?: string; discriminator?: string }>(
  orders: readonly O[], deps: { prs: readonly RedPr[]; run: Run; log?: (line: string) => void; nowMs?: number },
): { orders: O[]; held: HeldOrder[]; refreshed: string[] } {
  const log = deps.log ?? ((line: string) => void process.stderr.write(line));
  try {
    const { refreshed, refused } = refreshFixed({ run: deps.run, log, nowMs: deps.nowMs, open: deps.prs });
    for (const ref of refreshed) log(`ci-shared-failure: updated ${ref} from main (its incident's fix merged) -- no worker woken\n`);
    const held = holdSharedFailures(orders, { prs: deps.prs, run: deps.run, refused: [...refused, ...refusedRefreshes(deps.run)] });
    for (const group of held.groups.filter((g) => held.held.some((h) => h.key === g.key))) recordIncident(group, { run: deps.run, log });
    if (held.held.length > 0) log(`ci-shared-failure: holding ${held.held.length} red order(s) of a shared failure:${held.held.map((h) => ` ${h.subject}`).join("")}\n`);
    return { orders: held.orders, held: held.held, refreshed };
  } catch (error) {
    log(`ci-shared-failure: could not run (${String((error as Error).message).split("\n")[0]}); the orders go out as they were\n`);
    return { orders: [...orders], held: [], refreshed: [] };
  }
}
