import { createHash } from "node:crypto";
import { CLAIM_LABEL } from "../claim-labels.ts";
import { declaredClosedRows } from "../row-claim/file-overlap-rule.ts";
import { stateEntryPath } from "../host-config.ts";
import { holdersOf } from "../pr-hold-state.ts";
import { BLOCKED_LABEL, LANE_PREFIX, SESSION_PREFIX } from "../project-vocabulary.ts";
import type { CodeHostPort, TicketPort } from "../ticket-port/port.ts";
import { readRowsByLabel, type LabelledRead } from "../ticket-port/rows-by-label.ts";

/**
 * Labels that already mean NOT PICKABLE, so a row carrying one is not promotable however it is counted.
 *
 * `fleet-gated` is the load-bearing one for parallelism: that work serialises behind physical hardware,
 * so counting it as available capacity would report a queue five engineers could share when one of them
 * would be waiting on a worker box. The rest come from `ready:audit`'s own list of labels that mean a row
 * cannot be started.
 *
 * `meta` joined 2026-09-20 (#1804): a `backlog`+`meta` row ("Not work: a container or process row") has
 * no Region/Acceptance/done-when shape to promote and, unlike `fleet-gated`, is not routed to anyone
 * either -- so it belongs in the POOL's list, not just the owner's subtraction. #20 (the daily board
 * report thread) carried `backlog`+`meta` with no other `NOT_STARTABLE` label and kept re-triggering
 * `ready-queue-empty` on a judgment already settled five times that day.
 */
export const NOT_PICKABLE = Object.freeze([BLOCKED_LABEL, "fleet-gated", "epic", "disputed", "decision",
  "awaiting-merge", "review-only", "meta", CLAIM_LABEL]);

/**
 * LABELS THAT ROUTE WORK RATHER THAN STOPPING IT -- the distinction this file did not draw.
 *
 * `fleet-gated`'s own definition on GitHub is "Acceptance needs the fleet or the lab; ORCHESTRATOR RUNS
 * IT". It is a routing label. `NOT_PICKABLE` above is right that it is not available capacity FOR THE
 * ENGINEER POOL -- that work serialises behind physical hardware -- but the list was read as a property
 * of the ROW, so the label also hid the row from the one session it routes the row TO.
 *
 * MEASURED 2026-09-19, with the fleet 10/10 ready, consistent, zero recoveries: `orchestrator` idle,
 * seven `lane:orchestrator` rows open, and ZERO of them visible to `lane-backlog-unpromoted` because
 * every one carried a label in `NOT_PICKABLE`. Twelve `fleet-gated` rows in total, waiting on a fleet
 * that was fully available, and no cause in this file could say so.
 *
 * THE DEADLOCK THAT MAKES IT SELF-SUSTAINING: #914 -- "a nightly fleet capture batch for every
 * fleet-gated row on the milestone" -- is ITSELF `fleet-gated`. The row that would automate draining the
 * pile is hidden by the same rule that hides the pile.
 *
 * A VALUE IS NOW A POOL, NOT A NAME -- #1828, ceo's ruling on #1817 (2026-09-21): "`fleet-gated` routes
 * to a pool of two for now: `orchestrator` and `worker-capture`. Not wider." Every reader of this map
 * (`ownerOf`, `laneBacklogOrders`, `decide`'s pool-count math) must treat the value as a list of names,
 * never assume it is exactly one -- that assumption is what would have silently dropped the second name
 * or thrown reading past index 0.
 *
 * THE POOL IS ONE NAME AGAIN -- #2506, the pool half of the standing-engineer retirement (`ceo`'s ruling on
 * #2470, "The pool, decided"). `worker-capture` is retired, so no generic engineer may claim a `fleet-gated`
 * `lane:orchestrator` row (`laneReason` refuses it) and fleet-gated throughput is `orchestrator`'s own turn
 * rate until `orchestrator` shows a generic engineer's `lab:job` dispatch cannot collide with another capture;
 * the exception then attaches to a ROW, not to a name. The value stays a LIST on purpose: every reader above
 * still treats it as one.
 */
export const ROUTED_TO = Object.freeze({ "fleet-gated": Object.freeze(["orchestrator"]) });

/**
 * Labels meaning the row is not startable work FOR ANYONE -- `NOT_PICKABLE` minus what is merely routed.
 *
 * DERIVED, never retyped, so the pool's view and this one cannot drift: `NOT_PICKABLE` stays exactly
 * what it was (every existing pool behaviour is byte-identical) and this is the strictly smaller set an
 * OWNER is asked about. `blocked`, `epic` and a claim still hide a row from everybody, including the
 * session it is routed to -- routing says whose work it is, not that the work can start.
 */
export const NOT_STARTABLE = Object.freeze(
  NOT_PICKABLE.filter((n) => !(n in ROUTED_TO) && n !== "decision"));

/**
 * LANE OWNERS. A lane says who may act on a row, and these two are people rather than a pool.
 *
 * `lane:any` and no lane are the engineer pool, which is why they are absent here: the pool already has a
 * router (`wake.ts` picks whoever is idle) and these do not -- a `lane:ceo` row belongs to `ceo` whether
 * or not `ceo` is free, because nobody else may take it.
 */
export const LANE_OWNER = Object.freeze({ [`${LANE_PREFIX}ceo`]: "ceo", [`${LANE_PREFIX}orchestrator`]: "orchestrator" });

/**
 * The session a row's lane assigns it to, or `null` for the engineer pool.
 */
export function laneOwnerOf(row: any) {
  const lane = labelsOf(row).find((n: string) => n in LANE_OWNER);
  return lane ? (LANE_OWNER as Record<string,string>)[lane] : null;
}

/**
 * The session (or, for a routed row, the POOL of sessions) a row belongs to -- BY LANE FIRST, THEN BY
 * ROUTING -- or `null` for the engineer pool.
 *
 * LANE WINS, and the precedence is not arbitrary: a `lane:` label REFUSES every other session
 * unconditionally at claim time (`row-claim/runner-rule.ts`), so it is access control. A routing label
 * only says whose hands the acceptance needs. A `fleet-gated` row carrying `lane:ceo` is `ceo`'s, and
 * telling `orchestrator` about it would be telling them about a row they cannot take.
 *
 * A ROUTED ROW CAN NOW RETURN AN ARRAY -- #1828. `ROUTED_TO`'s value is a pool, not a name, and this
 * function hands that value straight back rather than picking one: every caller (`laneBacklogOrders`,
 * `decide`'s pool-count math) must read a two-name owner as "reaches both", not "reaches the first".
 */
export function ownerOf(row: any): string | readonly string[] | null {
  const byLane = laneOwnerOf(row);
  if (byLane) return byLane;
  // A `decision` ROW WITH NO LANE IS AN UNOWNED DECISION, AND THAT IS A FILING GAP.
  //
  // `decision` is in `NOT_PICKABLE` and rightly -- an engineer cannot decide a thing the org has not
  // assigned. But it was read as "not work" again, so a `decision` row reached NOBODY: measured
  // 2026-09-21, FOUR were open and not one was visible to any cause. #1734 -- "the gate can only see
  // GitHub objects" -- had sat unreachable for days while being cited repeatedly as awaiting a ruling,
  // and #1817 was filed BY THIS SESSION for `ceo` with a label that guaranteed `ceo` would never see it.
  //
  // A laned decision reaches its lane owner by the line above. An UNLANED one reaches
  // `product-manager`, whose brief names "lane labels" and filing: assigning an owner to an unowned
  // decision is that job, not a decision in itself.
  if (labelsOf(row).includes("decision")) return "product-manager";
  const routed = labelsOf(row).find((n: string) => n in ROUTED_TO);
  return routed ? (ROUTED_TO as Record<string, string | readonly string[]>)[routed] : null;
}

/**
 * The label for a row parked ON PURPOSE until its prerequisite phase is done (chairman, 2026-09-26): `ceo` schedules
 * it, and it is never `needs:chairman`. Like that label it is a wait `waitingOn` does not read, and this is the THIRD
 * reader of the gap (after #2583 and #2604): #2568 was ordered for promotion 30 minutes after `product-manager` had
 * parked it, because its blockers had closed. Skipped in each population that offers a row for PROMOTION, not taught
 * to `waitingOn`, which every reader of that function would then inherit.
 */
export const PARKED_LABEL = "parked";

/**
 * Where a `ready-row-unclaimed` order says which directory to launch the claim from -- FILLED IN BY `wake.ts` (#2405),
 * because the answer is a fact about the RECIPIENT (does `role-<you>` exist?) and the gate routes a pool order before
 * anyone has taken it. Exported from here so the two files cannot spell it differently; `wake.ts` already imports this one.
 */
export const LAUNCH_PLACEHOLDER = "<launch-directory>";

/**
 * #5050: THE GATE'S LABEL LISTS ARE NOT SEARCHES. `gh issue list --label X` is sent by `gh` as a GitHub SEARCH (`label:X repo:... type:issue`), whose allowance is separate
 * from and far smaller than the GraphQL points: the scheduler App's installation spent it on 2026-10-11 and a tick read 1,781 list calls in 45 minutes, 593 of them
 * refused. `repository.issues(labels:)` is a connection, charged to the points the gate already budgets, and it is the one reader the claim path uses (#5039).
 *
 * THE ROWS COME BACK IN THE SHAPE `gh issue list --json` GAVE (`labels` and `comments` as arrays), so no reader below and no comparison after it changed. A read that fails THROWS,
 * and each reader's own `catch` turns that into `null`, never `[]`. A read refused for a limit is remembered for the tick by the reader and not asked again, whichever label it
 * was for, and the line it leaves names the resource (`readRowsByLabel`). The fold (`foldIntoOpenRows`) still answers the open labels from the one open list.
 *
 * @param ask the label, the connection's `select`, and at most `newest` rows
 */
export function labelledRows(ask: Pick<LabelledRead, "label" | "state" | "select" | "run"> & { newest: number; }): any[] {
  const flat = (field: any) => (Array.isArray(field?.nodes) ? field.nodes : field);
  return readRowsByLabel(ask).map((node) => ({ ...node, ...(node.labels === undefined ? {} : { labels: flat(node.labels) }),
    ...(node.comments === undefined ? {} : { comments: flat(node.comments) }) }));
}

/** The selection every row-reading list asks for its labels and dependency edges: `blockedBy` nodes carry `number` and `state`, which the waiting rules read. */
export const ROW_LABELS = "labels(first:50){nodes{name}}";

export const ROW_BLOCKED_BY = "blockedBy(first:50){nodes{number state}}";

/**
 * #3390: THE CHAIRMAN'S OWN GITHUB LOGIN. A comment from it after the label went on is an answer. The org's accounts are deliberately
 * absent: `ceo` recording an answer is the half-finished state this check catches, and it is recognised by the provenance line instead.
 * A renamed account reads as "never answered" until this moves, which is the quiet direction, so a rename is a row to file.
 */
export const CHAIRMAN_LOGINS = Object.freeze(["DanBeckDev"]);

/**
 * How many row orders one tick may emit.
 *
 * A CAP, NOT A TARGET, and it is here because the alternative is noise rather than danger. `wake` already
 * refuses an order when nobody is free, so an uncapped gate with 52 Ready rows would print 50-odd
 * UNDELIVERED lines every two minutes and bury the ones that matter. Eight is comfortably more than the
 * org has engineers, so it never throttles real parallelism -- it bounds the REPORT.
 *
 * Raise it when there are more engineers than this, not before.
 */
export const MAX_ROW_ORDERS_PER_TICK = 8;

/** The label `ceo` created for "offer this row before others"; `offerOrder` reads it (#2296). */
export const PRIORITY_LABEL = "priority";

export const labelsOf = (x: any): string[] => (x?.labels ?? []).map((l: any) => String(l?.name ?? l));

/**
 * Every open PR the gate is ALLOWED TO COMPARE AGAINST, in `fileOverlapReason`'s shape.
 *
 * #1419's cap is why this FILTERS rather than passing everything through. `gh pr list --json files`
 * returns each PR's first 100 files and never says so, and `fileOverlapReason` answers a list shorter
 * than its own count with a REFUSAL rather than "no overlap". That refusal is right at claim time, where
 * the cost of guessing is two sessions editing one file. It is wrong HERE: the gate's B4 read is a
 * pre-filter, so one truncated list would shelve the entire queue over a pagination artefact.
 *
 * So a PR whose list does not match its count is dropped from the comparison. The gate then cannot see an
 * overlap against it, offers the row, and `row-claim.ts` refuses at claim time exactly as it does today.
 * **THE GATE FAILS OPEN AND THE AUTHORITY DOES NOT MOVE** -- every shelving decision here can only ever
 * remove a wake that would have ended in a refusal.
 *
 * #2101: `closes` rides along -- the rows each PR's body DECLARES it closes, so `blockedOnOpenPr` can tell
 * a row's own pull request from a competitor for its files. `body` is one more field on `readPrs`'s
 * existing call and costs no extra one.
 *
 * #3095: THE LIST MAY HOLD THE PULL REQUESTS OF MORE THAN ONE DECLARED REPOSITORY, and a pull request `tagged` with its `repo` and
 * `repoKey` keeps both, so `fileOverlapReason` compares a Region entry only with the files of the repository it is prefixed for and names
 * the PR as `#7 in owner/repo`. Its `Closes #7` is read against ITS OWN repository (`prRepo`), as `lookupOpenPrFiles` does: a bare number
 * in agent-org's PR body is agent-org's #7, never the tracker's row 7. An untagged PR (the primary's own) is exactly what it was.
 *
 *
 * #2493: `held` rides along too -- whether the PR carries a `hold:` label -- from `labels`, already on that call.
 *
 * @param [where] the tracker whose rows a `Closes` is read against; the project's first when omitted
 */
export function comparablePrFiles(prs: any[], { trackerRepo }: { trackerRepo?: string; } = {}): { number: number; files: string[]; changedFiles: number; closes: number[]; held: boolean; repo?: string; repoKey?: string; }[] {
  return prs
    .map((p) => ({
      number: Number(p?.number),
      changedFiles: Number(p?.changedFiles),
      files: (p?.files ?? []).map((f: any) => String(f?.path ?? f)),
      closes: declaredClosedRows(p?.body, { ...(p?.repo === undefined ? {} : { prRepo: p.repo }), ...(trackerRepo === undefined ? {} : { trackerRepo }) }),
      // #2493: the other half of the exclusion `fileOverlapReason` reads -- a `hold:` label on the PR.
      held: holdersOf(labelsOf(p)).length > 0,
      ...(p?.repo === undefined ? {} : { repo: String(p.repo), repoKey: String(p.repoKey ?? "") }),
    }))
    .filter((p) => Number.isInteger(p.changedFiles) && p.files.length === p.changedFiles);
}

/** #4524: a holder a chairman row was offered OVER: a claimed row, or a pull request. */
export type Yielding = { row: number; holders: { kind: "row" | "pr"; number: number; }[]; };

/**
 * The session a pull request belongs to, from its own `session:` label, or `null`.
 *
 * THE PR CARRIES THE LABEL, which is what makes a red build routable at all. The author field cannot do
 * it -- every PR here is opened by the shared `a11ign-ai-workers` account -- but `arm-pr` puts the
 * claiming session's label on the PR, so the one thing a broken build needs to know is already there.
 */
export function sessionOf(pr: any) {
  const label = labelsOf(pr).find((n: string) => n.startsWith(SESSION_PREFIX));
  return label ? label.slice(SESSION_PREFIX.length) : null;
}

/** The cut `reasonOf` makes of a refusal's cause, the length of `class-repeat.ts`'s `MAX_REASON_CHARS` (that file's own, not exported). */
export const REFUSAL_REASON_CHARS = 160;

export const HOUR_MS = 60 * 60 * 1000;

/** How long each ask stays open -- `wake.ts`'s `JUDGMENT_TTL_MS`, pinned equal by the test. */
export const PROMOTION_ASK_WINDOW_MS = 2 * HOUR_MS;

/**
 * The blockers this row DECLARED, oldest first -- or `null` when it declared none.
 *
 * IT DOES NOT ASK WHETHER THEY ARE CLOSED, AND THAT IS DELIBERATE RATHER THAN AN OMISSION. `waitingOn`
 * already answers it: an open `blockedBy` node is the FIRST thing it reports, so by the time the caller
 * reaches this line every node here is closed. A second openness test was written here first and a
 * mutation proved it: deleting it left the whole suite green, because no input could reach it -- an
 * unreachable branch is not a guard, it is a second spelling of a rule that lives in
 * `waiting-condition.ts`, and the two would drift the way this repository's most expensive shape always
 * does. The caller states the dependency in one line rather than restating the rule.
 *
 * SORTED, so the causeKey is stable: GitHub returns `blockedBy.nodes` in its own order, and an unsorted
 * key would mint a different question for the same clearing depending on what that order happened to be
 * -- `fleetBatchOrders` pays for this exact property one function up.
 */
export function declaredBlockers(row: any): number[] | null {
  const nodes = row?.blockedBy?.nodes ?? [];
  if (nodes.length === 0) return null;
  return nodes.map((n: any) => Number(n.number))
    .sort((a: number, b: number) => a - b);
}

/**
 * A short, stable name for a marker GitHub gives no id to -- a body line. Content-derived, so it moves
 * when the line does, which is what makes a REPLACED constraint a new question.
 */
export function digestOf(text: string) {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

/** The label the chairman puts on a row he wants picked up NEXT. Nothing but a label by `CHAIRMAN_LOGINS` makes a row one (#4524). */
export const CHAIRMAN_PRIORITY_LABEL = "priority:chairman";

/** @param {any} row @param {ReadonlySet<number> | undefined} chairmanRows */
export const isChairmanRow = (row: any, chairmanRows: ReadonlySet<number> | undefined) => chairmanRows?.has(Number(row?.number)) === true;

export const standingText = (ms: number): string => (ms >= 2 * 3_600_000 ? `${Math.floor(ms / 3_600_000)}h` : `${Math.max(1, Math.round(ms / 60_000))} min`);

// --- #2401: A REVIEWER WHOSE CODEX FAILED TO AUTHENTICATE ---------------------------------------------------

/** Where the org's runtime state lives -- beside `wake.ts`'s ledger, which defaults to the same directory. */
export const REVIEWER_STATE_DIR = stateEntryPath("");

/** The instances `wake.ts` STARTED and has not ended: `{ "reviewer-<n>": { spawnedAt } }`. `wake` writes, this reads. */
export const REVIEWER_REGISTRY_FILE = "reviewer-instances.json";

export const MS_PER_MINUTE = 60_000;

// --- #2618 (child 3c of #69): EVERY REPOSITORY THE PROJECT DECLARES, NOT ONE ---------------------------------------------

export type ScopeRepository = { repo: string };

export type Scope = { key: string, code: ScopeRepository | null, tracker: ScopeRepository | null };

/**
 * THE SCOPES OF A TICK: one per KEY across every declaration handed in, the primary project's (the empty key) FIRST.
 *
 * A scope pairs the code repository and the tracker that share a key, either of which may be absent (a layer repository
 * has code and no tracker of its own). Inside one scope a pull request or row number is unambiguous, which is why `decide`
 * is run PER SCOPE rather than over one merged list: every map in it is keyed by number, and PR 7 in two repositories
 * would be one entry. Names are made distinct at the OUTPUT (`subjectRef`, `reviewerSeat`), not by renumbering the input.
 *
 * A key declared twice REFUSES, naming it: `project-config.ts` refuses a duplicate within one declaration, and this is the
 * same rule across the host (ADR 0040, decision 2: the key is "unique across the host"), which no single declaration can see.
 */
export function scopesOf(declarations: readonly { tracker: readonly { key: string; repo: string; }[]; code: readonly { key: string; repo: string; }[]; }[]): Scope[] {
  const byKey: Map<string, Scope> = new Map();
  const declare = (key: string, part: "code" | "tracker", repo: string) => {
    const scope = byKey.get(key) ?? { key, code: null, tracker: null };
    if (scope[part] !== null) throw new Error(`key ${key === "" ? "(empty)" : `\`${key}\``} declares a ${part} repository twice (${scope[part].repo} and ${repo}); a key is unique across the host`);
    scope[part] = { repo };
    byKey.set(key, scope);
  };
  for (const declaration of declarations) {
    for (const entry of declaration.tracker) declare(entry.key, "tracker", entry.repo);
    for (const entry of declaration.code) declare(entry.key, "code", entry.repo);
  }
  return [...byKey.values()].sort((a, b) => Number(b.key === "") - Number(a.key === "") || a.key.localeCompare(b.key));
}

/**
 * The repository a scope's read is AIMED at, or `undefined` for the primary project's own: its reads are made exactly as
 * they were before a second repository existed, with nothing added to the call.
 */
export const aimOf = (scope: Scope, part: ScopeRepository | null): string | undefined => (scope.key === "" || part === null ? undefined : part.repo);

/**
 * A list a reader returned, its members marked with the repository they came from -- and `null` (a refusal) left as `null`.
 * The primary project's members are returned UNTOUCHED, so its records stay byte-identical to what they were.
 */
export function tagged(list: any[] | null, key: string, repo: string | undefined): any[] | null {
  return list === null || key === "" ? list : list.map((item) => ({ ...item, repoKey: key, repo }));
}

/** What `settleUnarmedPrs` is given for one repository: the code host's arm (ADR 0046 decision 3) and the ticket port's one write, the record on the pull request. */
export type ArmingPort = Pick<CodeHostPort, "armMerge"> & Pick<TicketPort, "postDecision">;
