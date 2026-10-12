import { newestPerName } from "../newest-check-run.ts";
import { armabilityOf } from "../pr-hold-state.ts";
import { labelsOf } from "./vocabulary.ts";

/**
 * Is this PR's CI green enough to be worth a reviewer's turn?
 *
 * A DRAFT WITH A RED CHECK IS THE AUTHOR'S WORK, NOT THE REVIEWER'S -- `reviewer.md`'s lane is a SETTLED
 * draft, and waking a reviewer for a PR whose own tests are failing spends the org's most expensive turn
 * (worktree, acceptance command, re-derived numbers, mutation) on something the author is still moving.
 *
 * PENDING IS NOT GREEN AND NOT RED. A check still running means the answer is not knowable yet; this
 * returns `null` and the caller emits no order, so the next tick asks again. Reading pending as green
 * would wake the reviewer onto a moving head.
 * CALLERS MUST NARROW FIRST with newestPerName: GitHub unions superseded runs into statusCheckRollup, so a
 * raw read answers about every attempt ever made and one cancelled first try reads as a failure --
 * merge-queue.ts carried that defect until #634, and local/bounded-window-reads refuses it at the read.
 * @param rollup the checks, ALREADY narrowed to the newest run per name
 */
export function checksSettledGreen(rollup: any[] | null | undefined): boolean | null {
  if (!Array.isArray(rollup) || rollup.length === 0) return null;
  if (rollup.some(stillRunning)) return null;
  const bad = ["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE", "ERROR"];
  return !rollup.some((c) => bad.includes(conclusionOf(c)));
}

export const conclusionOf = (c: any) => String(c?.conclusion ?? c?.state ?? "").toUpperCase();

export function stillRunning(c: any) {
  const status = String(c?.status ?? "").toUpperCase();
  return status === "IN_PROGRESS" || status === "QUEUED" || status === "PENDING";
}

/**
 * PURE. Does any open pull request have a settled-red check at all?
 *
 * The cheap question that decides whether the expensive one is worth asking. It deliberately looks at
 * EVERY check rather than the required ones -- it cannot know which those are yet, and asking is the
 * thing it is gating.
 */
export function anyChecksRed(prs: any[]) {
  return prs.some((pr) => checksSettledGreen(newestPerName(pr?.statusCheckRollup ?? [])) === false);
}

/**
 * PURE. The rollup entries that can hold this pull request, given what is required.
 *
 * `null` required means "unreadable", and that is not the same as "nothing is required" -- the first must
 * consider every check (fail open), the second would consider none and go permanently silent. Keeping
 * them distinct is the whole reason `requiredCheckNames` returns `null` rather than `[]`.
 */
export function blockingChecks(rollup: any[], required: string[] | null) {
  if (required === null) return rollup;
  return (rollup ?? []).filter((c) => required.includes(c?.name ?? c?.context));
}

/**
 * PURE. The pull requests `shouldBeMerging` judges, as OBJECTS rather than numbers.
 *
 * EXTRACTED RATHER THAN COPIED (#2084), because two readers now ask the same question of the same
 * population and the second one needs a field the first throws away. `shouldBeMerging` wants numbers to
 * hand to `readUnarmed`; `reviewBlocked` below wants each PR's `reviewDecision`. A second copy of these
 * three filters is how `pr-hold-state.ts`'s own header records #645 going wrong -- the predicate written
 * twice, one copy correct -- and here it would be worse than a wrong answer: the two causes would report
 * OVERLAPPING but different populations, so a pull request could be called stranded by one and healthy by
 * the other on the same tick.
 */
export function mergeCandidates(prs: any[], required: string[] | null = null): any[] {
  return greenUnheldPrs(prs, required)
    .filter((pr) => conflictStateOf(pr) !== CONFLICT_STATE.CONFLICTING);
}

/**
 * PURE. #958: the DRAFTS that are green, not held and not conflicting -- `mergeCandidates`' population with the draft exclusion lifted and
 * nothing else changed. It exists for the one reader that must see a draft: `reviewBlocked`, for a refusal the author owes rework on. Every
 * other cause keeps `mergeCandidates`, whose drafts belong to `draft-awaiting-verdict`.
 */
export function draftCandidates(prs: any[], required: string[] | null = null): any[] {
  return greenUnheldPrs(prs, required, { drafts: true })
    .filter((pr) => pr.isDraft === true)
    .filter((pr) => conflictStateOf(pr) !== CONFLICT_STATE.CONFLICTING);
}

/**
 * PURE. The pull requests that are not a draft (unless `drafts`), not held and settled green on every required check --
 * BEFORE asking whether they can merge. Both halves of that question are read from this one population:
 * `mergeCandidates` keeps the ones that can, `conflictedPrs` the ones that cannot, so the two partition it
 * and no pull request is called stranded by one cause and healthy by another on the same tick (#2084's
 * argument for extracting `mergeCandidates`, applied once more).
 */
function greenUnheldPrs(prs: any[], required: string[] | null = null, { drafts = false }: { drafts?: boolean } = {}): any[] {
  return (prs ?? [])
    .filter((pr) => pr && (drafts || pr.isDraft !== true) && Number.isFinite(Number(pr.number)))
    // A DRAFT IS EXCLUDED AT THE SOURCE, NOT BY THE HOLD RULE: `gh pr merge --auto` refuses a draft
    // outright, so an unarmed draft is correct rather than stranded. (`draftCandidates` lifts the draft exclusion for `reviewBlocked`; the hold rule stays.)
    .filter((pr) => armabilityOf({ labels: labelsOf(pr) }).arm)
    .filter((pr) => checksSettledGreen(
      blockingChecks(newestPerName(pr.statusCheckRollup ?? []), required)) === true);
}

/** The three answers `conflictStateOf` can give. `UNREAD` is deliberately not a spelling of "clear". */
export const CONFLICT_STATE = Object.freeze({
  /** GitHub says the branch cannot merge into `main` as it stands. */
  CONFLICTING: "CONFLICTING",
  /** GitHub named a merge state and it is not a conflict. */
  NOT_CONFLICTING: "NOT_CONFLICTING",
  /** The payload carried no usable state -- absent, or `UNKNOWN` while GitHub is still computing it. */
  UNREAD: "UNREAD",
});

/**
 * PURE. #2209: DOES THIS PULL REQUEST CONFLICT WITH `main`? -- three answers, and the third is not "no".
 *
 * EITHER FIELD SAYING CONFLICT IS ENOUGH. `mergeStateStatus: DIRTY` and `mergeable: CONFLICTING` are the
 * same fact in two vocabularies (#2203 carried both), and a conflict is the one state where believing the
 * louder of two fields is safe: the error it can make is a pull request reported to its author, who looks
 * and finds it clean, rather than one nobody was told about.
 *
 * ABSENT OR `UNKNOWN` IS `UNREAD`, AND IT FALLS THE WAY `readPrs`'s OWN `null`-MEANS-REFUSED RULE FALLS
 * (#1286), ONE FIELD DOWN: a question that was not answered is not answered "fine". Concretely, an unread
 * pull request is never certified as one that can merge and is never sent a conflict order it may not
 * deserve, and it STAYS in `mergeCandidates` -- exactly where it sat before this row. Dropping it there
 * would turn a field the gate lost, or GitHub had not yet computed, into a silently emptier
 * `pr-green-unarmed`, which is the reassuring direction a blind spot fails in.
 *
 *
 * @returns a `CONFLICT_STATE` value
 */
export function conflictStateOf(pr: any): string {
  if (pr?.mergeStateStatus === "DIRTY" || pr?.mergeable === "CONFLICTING") return CONFLICT_STATE.CONFLICTING;
  const status = pr?.mergeStateStatus;
  if ((typeof status === "string" && status !== "UNKNOWN") || pr?.mergeable === "MERGEABLE") {
    return CONFLICT_STATE.NOT_CONFLICTING;
  }
  return CONFLICT_STATE.UNREAD;
}

/**
 * PURE. #2209: the green, unheld, non-draft pull requests that CANNOT MERGE because they conflict with
 * `main` -- the complement of `mergeCandidates` inside `greenUnheldPrs`.
 *
 *
 * @returns ascending by PR number
 */
export function conflictedPrs(prs: any[], required: string[] | null = null): any[] {
  return greenUnheldPrs(prs, required)
    .filter((pr) => conflictStateOf(pr) === CONFLICT_STATE.CONFLICTING)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

/**
 * #2084: WHAT GITHUB'S OWN REVIEW DECISION SAYS ABOUT ONE PULL REQUEST -- five states, none of them a guess.
 *
 * THE FIELD IS NOT A STATEMENT ABOUT THE HEAD, AND THAT IS THE FINDING RATHER THAN A CAVEAT. A review
 * attaches to a COMMIT; `reviewDecision` is computed from the latest review REGARDLESS of which head it was
 * posted on. With `dismiss_stale_reviews: false` a refusal outlives the fix and an approval outlives the
 * diff it approved. So this reader deliberately reports GITHUB'S BLOCKING STATE and never claims the
 * decision was made at the current head -- claiming that is the error #2084 exists to name.
 *
 * ABSENT IS ITS OWN STATE AND IT IS NOT "FINE" (`UNREADABLE`), BUT IT IS NOT THIS CAUSE'S SUBJECT EITHER.
 * A payload that never carried the field says nothing about the pull request, so an order naming one would
 * be reporting the gate's own read rather than a state anybody can act on. It IS still the reassuring
 * direction -- a `readPrs` that stopped asking would empty this cause silently -- and the control for that
 * is named and lives one layer up, where the regression would actually be: `work-gate.test.ts`'s
 * "`reviewDecision` rides on readPrs's existing field list" asserts the `--json` argument itself. A guard
 * on the ARGUMENT catches the regression on every run; a guard in this verdict would instead fire on every
 * synthetic fixture in the suite, which is noise rather than a control.
 *
 * EMPTY IS DIFFERENT FROM ABSENT AND IS ALSO NOT A PASS (`NO_DECISION`). GitHub leaves `reviewDecision`
 * EMPTY when the base branch requires no approval -- `branch-protection.test.ts` calls it the #1968 state,
 * measured on a pull request carrying three reviews including an `APPROVED`. Nothing is blocked, and
 * nothing has been reviewed either; folding it into `APPROVED` would report an unprotected base as a
 * satisfied requirement.
 *
 * ANYTHING ELSE IS `UNRECOGNISED` AND STILL BLOCKS, which is `bindsMeVerdict`'s `!== "never"` shape one
 * file over and for its reason: an allowlist of the blocking values would be written from today's
 * vocabulary, and the one value nobody here has seen is exactly the one that would slip through. A state
 * this code cannot name must never be the state that lets a pull request read as healthy.
 */
export function reviewStateOf(pr: any): { code: string; why: string; } {
  if (!Object.hasOwn(pr ?? {}, "reviewDecision")) {
    return { code: REVIEW_STATE.UNREADABLE,
      why: "the payload carries no `reviewDecision` field at all -- this read never asked GitHub, so it is "
        + "not a statement about the pull request" };
  }
  const decision = pr.reviewDecision;
  if (decision === null || decision === "") {
    return { code: REVIEW_STATE.NO_DECISION,
      why: "`reviewDecision` is empty: the base branch computes no decision, so no approval is required and "
        + "none has been recorded -- the #1968 state, which is not an approval" };
  }
  if (decision === "APPROVED") return { code: REVIEW_STATE.APPROVED, why: "`reviewDecision` is APPROVED" };
  if (decision === "REVIEW_REQUIRED") {
    return { code: REVIEW_STATE.AWAITING_REVIEW,
      why: "`reviewDecision` is REVIEW_REQUIRED: GitHub is holding it for an approval nobody has posted" };
  }
  if (decision === "CHANGES_REQUESTED") {
    return { code: REVIEW_STATE.REFUSED,
      why: "`reviewDecision` is CHANGES_REQUESTED: a reviewer refused it, and GitHub will hold it until a "
        + "NEWER review says otherwise -- pushing past a refusal does not clear one" };
  }
  return { code: REVIEW_STATE.UNRECOGNISED,
    why: `\`reviewDecision\` is ${JSON.stringify(decision)}, which this gate has never seen: an unrecognised `
      + "state, and an unrecognised state must not read as a mergeable one" };
}

/** The five states `reviewStateOf` distinguishes. Two of them block, and two of the rest are not passes. */
export const REVIEW_STATE = Object.freeze({
  /** GitHub is waiting for an approval nobody has posted. */
  AWAITING_REVIEW: "AWAITING_REVIEW",
  /** A reviewer refused, and only a newer review clears it. */
  REFUSED: "REFUSED",
  /** The requirement is met. */
  APPROVED: "APPROVED",
  /** The base requires no decision, so there is none -- NOT an approval. */
  NO_DECISION: "NO_DECISION",
  /** The payload never carried the field. NOT a statement about the pull request. */
  UNREADABLE: "UNREADABLE",
  /** A value this gate cannot name. Blocks, deliberately. */
  UNRECOGNISED: "UNRECOGNISED",
});

/** The states that stop a pull request merging, however green and armed it looks. */
export const BLOCKING_REVIEW_STATES: readonly string[] = Object.freeze([
  REVIEW_STATE.AWAITING_REVIEW, REVIEW_STATE.REFUSED, REVIEW_STATE.UNRECOGNISED]);
