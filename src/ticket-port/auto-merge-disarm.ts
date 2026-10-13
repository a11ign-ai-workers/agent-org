// agent-org#1278: THE READ AND THE WRITE BEHIND DISARMING A RED LEG'S PULL REQUEST, as the arguments to `gh` built here and run through an injected `run` (`gh`, as the caller hands it in).
// This file names no `gh` and spawns nothing, and it is under `src/ticket-port/` because `gh-call-ratchet.test.ts` refuses a new call shape anywhere else.
// A refused `run` THROWS, and an answer that is not the shape THROWS: the caller reads the seat back after the write, and "unread" must not look like "disarmed".

type Run = (args: string[]) => string;

/** The pull request's node id, whether it has merged, whether auto-merge is requested, and whether it sits in the merge queue. */
export type DisarmSeat = { id: string; merged: boolean; armed: boolean; queued: boolean };

const DISARM_QUERY = "query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r)"
  + "{pullRequest(number:$n){id merged autoMergeRequest{enabledAt} mergeQueueEntry{state}}}}";

/** `repo` is `owner/name`, and `number` the pull request's number in it. */
export function readDisarmSeat({ number, repo, run }: { number: string; repo: string; run: Run }): DisarmSeat {
  const [owner, name] = repo.split("/");
  const pr = JSON.parse(run(["api", "graphql", "-f", `query=${DISARM_QUERY}`, "-f", `o=${owner}`, "-f", `r=${name}`,
    "-F", `n=${number}`, "--jq", ".data.repository.pullRequest"]));
  if (!pr || typeof pr.id !== "string" || typeof pr.merged !== "boolean") throw new Error("the read answered no pull request");
  return { id: pr.id, merged: pr.merged, armed: pr.autoMergeRequest != null, queued: pr.mergeQueueEntry != null };
}

/**
 * The write. Its exit is NOT the evidence: `gh pr merge --disable-auto` may exit 0 and leave the request on, so a caller reads the seat
 * back after it. A refused write THROWS, and the caller decides what the throw means.
 */
export function disableAutoMergeOf({ number, repo, run }: { number: string; repo: string; run: Run }): void {
  run(["pr", "merge", number, "--repo", repo, "--disable-auto"]);
}
