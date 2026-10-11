/**
 * a11ign/agent-org#828 (Phase 1b of a11ign/a11ign#4505, CAPABILITY ONLY): WHICH ROLE BRIEF A SPAWNED SEAT IS SENT TO READ.
 *
 * A spawned seat knows nothing, so its first message carries one sentence that sends it to a role brief. That sentence was
 * `wake.ts`'s `ENGINEER_BRIEF_SENTENCE` and named `engineer.md` for every spawn. It lives here now, beside the one list of
 * briefs a spawned seat may be sent to, so a caller can ask for another and the default stays the engineer's.
 *
 * NOTHING ROUTES THROUGH THIS YET. No order carries a role, no lane is routed and `SPAWN_CAUSES` is untouched: `addressed`
 * takes an optional `briefRole` and no caller passes it. The cutover rows add the order field that carries the role, the
 * `spawnableRole` addressee and the one-run-at-a-time guard while a fleet or lab command is in the Acceptance.
 *
 * AN UNKNOWN ROLE IS REFUSED BY NAME, never defaulted to the engineer's: a seat briefed for the wrong role is told the wrong
 * resource rules, and the list is a rule rather than a path test (`"../engineer"` is not a role).
 */
import { existsSync } from "node:fs";
import { roleBriefPath } from "./project-roles.ts";

/** The briefs a spawned seat can be sent to, by role name (the brief is `<role>.md` in the project's roles directory). */
export const SPAWN_BRIEF_ROLES: readonly string[] = Object.freeze(["engineer", "orchestrator"]);

/** What each role's brief holds, as the sentence says it; the engineer's text is `wake.ts`'s original, byte for byte. */
const BRIEF_CONTENTS: Readonly<Record<string, string>> = Object.freeze({
  engineer: "the resource ban, the acceptance standard and the habits every engineer is held to",
  orchestrator: "what the role owns, the judgements that cannot be delegated and the habits every orchestrator is held to",
});

const sentenceFor = (role: string, brief: string) =>
  `Before you start, read \`${brief}\`: ${BRIEF_CONTENTS[role]}. Nothing else tells you them.`;

/** The engineer's sentence, from the home checkout's declared roles directory; no file is read, as before (#3444). */
export const ENGINEER_BRIEF_SENTENCE = sentenceFor("engineer", roleBriefPath("engineer.md").relative);

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
  return sentenceFor(role, brief.relative);
}
