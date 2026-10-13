// @ts-check
// module: which repository a ticket is worked in, read from its title -- `<type>(<scope>): <what>`, where the scope is a repository or one of its packages
//
// THE TICKET SAYS WHERE ITS WORK LANDS, SO THE BOARD DOES NOT ASK. The convention is the one the create-ticket skill writes: the scope is the
// repository for a single-app repository (`fix(nbl-ui-netbox): ...`) and the package for a monorepo (`feat(ui-settings): ...`). A scope is read as
// a repository when it is one of the host file's `clones`, and as a package when it is a directory under that repository's `packages/` on its
// default branch. Anything else (`ci`, `dev`, no scope, no conventional title at all) resolves to nothing, and the board says so rather than
// guessing: a ticket without a scope is retitled, not routed.
import { parseDefaultBranch, defaultGit, type Git } from "./worktree.ts";

/** Each repository's package directory names, on its default branch. */
export type Packages = Readonly<Record<string, readonly string[]>>;

export type Resolved = Readonly<{ repo: string; package: string | null }>;

/** The scope of a conventional title, or `null` when the title has none. PURE. */
export function titleScope(title: string): string | null {
  const match = /^\s*[a-z]+\(([^)]+)\)!?:/i.exec(title);
  return match === null ? null : match[1].trim();
}

/** The repository (and package) a title's scope names, or `null`. A repository name wins over a package of the same name. PURE. */
export function resolveScope(title: string, packages: Packages): Resolved | null {
  const scope = titleScope(title);
  if (scope === null) return null;
  if (scope in packages) return { repo: scope, package: null };
  const repo = Object.keys(packages).find((name) => packages[name].includes(scope));
  return repo === undefined ? null : { repo, package: scope };
}

/** The packages each readable clone holds, and why each unreadable clone could not be read. */
export type Discovery = Readonly<{ packages: Packages; unreadable: Readonly<Record<string, string>> }>;

/**
 * Each clone's `packages/` directories on its remote default branch (`ls-remote` names the branch, `ls-tree` reads the clone's own
 * remote-tracking ref, so a package added since the clone last fetched is found after its next fetch). A clone that cannot be read is NOT given
 * an empty package list: it is reported under `unreadable` with the reason, because an empty list would make its tickets look unscoped.
 */
export async function discoverPackages(clones: Readonly<Record<string, string>>, git: Git = defaultGit): Promise<Discovery> {
  const packages: Record<string, string[]> = {};
  const unreadable: Record<string, string> = {};
  for (const [repo, clone] of Object.entries(clones)) {
    try {
      const base = parseDefaultBranch(await git(clone, ["ls-remote", "--symref", "origin", "HEAD"]));
      const listing = await git(clone, ["ls-tree", "-d", "--name-only", `origin/${base}`, "packages/"]);
      packages[repo] = listing.split("\n").map((line) => line.trim().replace(/^packages\//, "")).filter((name) => name !== "");
    } catch (err) {
      unreadable[repo] = String((err as Error)?.message ?? err);
    }
  }
  return { packages, unreadable };
}
