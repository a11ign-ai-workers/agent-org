// #852: THE CLONE OF THE REPOSITORY A ROW IS BUILT IN, read for `row-file`, which passes it to `acceptancePathsReason` as `builtInCheckout`.
//
// It is not in `acceptance-commands.ts` because the tracker is `rowTracker`'s answer, and `rowTracker` reads `work-gate.ts`, which imports
// `acceptance-commands.ts`. Importing it there closes that cycle (a temporal-dead-zone error in `project-roles.ts`) and puts
// `productRegionsOf`, which requires a token, into the closure of every test of `acceptance-commands.ts`. `row-file` already reads the
// tracker, so it is the one caller that needs this.
import { declaredRegionFiles } from "./region-paths.ts";
import { HostConfigRefusal, homeHostConfig } from "./host-config.ts";
import { ProjectDeclarationRefusal, homeProjectDeclaration } from "./project-config.ts";
import { rowTracker } from "./row-tracker.ts";

/**
 * The clone of the repository this row is built in, when that is a declared second tracker's. The tracker is `rowTracker`'s answer off the
 * Region, the one `row-file` files by, and the clone is the host's `clones.<key>`, the read `row-claim --tracker` makes for a keyed worktree.
 * `null` for the home tracker (its clone is the primary checkout, which #4322 already names) and for `cannot tell`: no declaration is
 * readable, as on a CI runner, so the check is skipped rather than passed.
 */
export function builtInCheckoutOf(body: string): string | null {
  let declaration: ReturnType<typeof homeProjectDeclaration>;
  let host: ReturnType<typeof homeHostConfig>;
  try {
    declaration = homeProjectDeclaration();
    host = homeHostConfig();
  } catch (error) {
    // Only "no declaration readable" is cannot tell. Any other failure (a git that cannot list the Region) is an error, not a pass.
    if (error instanceof HostConfigRefusal || error instanceof ProjectDeclarationRefusal) return null;
    throw error;
  }
  const { tracker } = rowTracker(declaredRegionFiles(body), declaration, declaration.tracker);
  if (tracker.key === "") return null;
  return host.clones?.[tracker.key] ?? null;
}
