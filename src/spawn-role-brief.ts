/**
 * a11ign/agent-org#828 (Phase 1b of a11ign/a11ign#4505, CAPABILITY ONLY): WHICH ROLE BRIEF A SPAWNED SEAT IS SENT TO READ.
 *
 * A spawned seat knows nothing, so its first message carries one sentence that sends it to a role brief. That sentence was
 * `wake.ts`'s `ENGINEER_BRIEF_SENTENCE` and named `engineer.md` for every spawn. It lives here now, beside the one list of
 * briefs a spawned seat may be sent to, so a caller can ask for another and the default stays the engineer's.
 *
 * ONE LANE ROUTES THROUGH THIS, BEHIND A FLAG THAT IS OFF (#832): with `workers.orchestratorOneShot` on, a ready `lane:orchestrator`
 * row's order carries `briefRole: "orchestrator"` (`orchestrator-one-shot.ts`) and `promptTarget` hands it to `addressed`. With it
 * off no order carries a role and every caller gets the engineer's, as before. `SPAWN_CAUSES` is untouched: the one-shot cause is
 * its sibling, and the one-run-at-a-time guard while a fleet or lab command is in the Acceptance is that module's.
 *
 * AN UNKNOWN ROLE IS REFUSED BY NAME, never defaulted to the engineer's: a seat briefed for the wrong role is told the wrong
 * resource rules, and the list is a rule rather than a path test (`"../engineer"` is not a role).
 */
import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { HOME_CHECKOUT } from "./project-config.ts";
import { roleBriefPath } from "./project-roles.ts";

/** The briefs a spawned seat can be sent to, by role name (the brief is `<role>.md` in the project's roles directory). */
export const SPAWN_BRIEF_ROLES: readonly string[] = Object.freeze(["engineer", "orchestrator"]);

/** What each role's brief holds, as the sentence says it; the engineer's text is `wake.ts`'s original, byte for byte. */
const BRIEF_CONTENTS: Readonly<Record<string, string>> = Object.freeze({
  engineer: "the resource ban, the acceptance standard and the habits every engineer is held to",
  orchestrator: "what the role owns, the judgements that cannot be delegated and the habits every orchestrator is held to",
});

/**
 * THE BRIEF IS NAMED BY ITS ABSOLUTE PATH IN THE HOME PROJECT, NEVER RELATIVE TO THE WORKTREE (#850, chairman a11ign#4957 cause 1).
 * A spawned seat starts in a worktree of whichever repository its row is in, and an agent-org one holds no `.agent-org/roles`, so
 * a relative path sent the seat to a stray copy in a sibling worktree or to none, and it never learned that opening its pull
 * request was its job. A relative `brief` is resolved against the home checkout HERE, so no caller can send one.
 */
const absoluteBrief = (brief: string) => (isAbsolute(brief) ? brief : join(HOME_CHECKOUT, brief));

const sentenceFor = (role: string, brief: string) =>
  `Before you start, read \`${absoluteBrief(brief)}\`: ${BRIEF_CONTENTS[role]}. Nothing else tells you them.`;

/**
 * The engineer's sentence for the brief path `wake.ts` already holds (`ENGINEER_BRIEF`), made absolute; no file is read, as before (#3444).
 *
 * A FUNCTION, NOT A CONSTANT, ON PURPOSE: this module is imported by `wake.ts`, which sits in an import cycle with
 * `project-config.ts` (`HOME_CHECKOUT`). A top-level `roleBriefPath` call here ran BEFORE `HOME_CHECKOUT` was initialized
 * (`Cannot access 'HOME_CHECKOUT' before initialization`, review of #831), so nothing in this module's body reads the declaration.
 */
export const engineerBriefSentence = (brief: string): string => sentenceFor("engineer", brief);

/**
 * The sentence that sends a spawned seat to `role`'s brief.
 * @param role one of {@link SPAWN_BRIEF_ROLES}; anything else throws, naming it and the list
 * @param root the project root the brief is looked up under; a parameter so a test can hand it a fixture
 * @throws when `role` is not in the list, or its brief file does not exist (the path is named)
 */
export function briefRoleSentence(role: string = "engineer", root?: string): string {
  if (!SPAWN_BRIEF_ROLES.includes(role)) {
    throw new Error(`briefRole ${JSON.stringify(role)} is not a role a spawned seat can be briefed as (allowed: ${SPAWN_BRIEF_ROLES.join(", ")})`);
  }
  const brief = roleBriefPath(`${role}.md`, root);
  if (!existsSync(brief.absolute)) {
    throw new Error(`briefRole ${JSON.stringify(role)} has no brief file: ${brief.absolute} does not exist`);
  }
  return sentenceFor(role, brief.absolute);
}
