// @ts-check
// module: Linear as a ticket source -- GraphQL over an injected `fetch`, with a personal API key
//
// A PERSONAL KEY, NOT AN APP. A Linear agent app is installed by a workspace admin, which a person on a work account cannot do, so ticket mode reads
// as the person: their key, their assigned tickets. It writes nothing to Linear. Linear's own GitHub integration links each pull request, because
// the worker's branch is the ticket's `branchName`.
//
// THE KEY NEVER LEAVES THIS MODULE. It is read once, from the macOS Keychain or a file the host file names, and sent only to api.linear.app.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { KeySource } from "./settings.ts";
import type { Ticket, TicketSource } from "./source.ts";

export const LINEAR_API = "https://api.linear.app/graphql";
/** Linear stores uploads here, and only a request carrying the key may read one. */
const UPLOADS = /https:\/\/uploads\.linear\.app\/[^\s)"'<>]+/g;
const PAGE = 100;

const ISSUE_FIELDS = "identifier title description url branchName priority state { name position } team { key } project { name }";

type Fetch = typeof fetch;

/** The key, from where the host file says it lives. `security` prints the secret on stdout, which this returns and never logs. */
export function readLinearKey(source: KeySource, security: (args: string[]) => string = (args) => execFileSync("security", args, { encoding: "utf8" }),
  read: (path: string) => string = (path) => readFileSync(path, "utf8")): string {
  const key = ("keychain" in source ? security(["find-generic-password", "-s", source.keychain, "-w"]) : read(source.path)).trim();
  if (key === "") throw new Error(`ticket mode: the Linear key at ${"keychain" in source ? `Keychain service ${source.keychain}` : source.path} is empty`);
  return key;
}

type IssueNode = {
  identifier: string; title: string; description: string | null; url: string; branchName: string; priority: number;
  state: { name: string; position: number }; team: { key: string }; project: { name: string } | null;
};

function toTicket(node: IssueNode): Ticket {
  return Object.freeze({
    key: node.identifier, title: node.title, description: node.description ?? "", url: node.url, branch: node.branchName,
    status: node.state.name, statusOrder: node.state.position, team: node.team.key, project: node.project?.name ?? null, priority: node.priority,
  });
}

/** Every Linear upload a description links to, once each, in the order they appear. PURE. */
export function uploadLinks(description: string): string[] {
  return [...new Set(description.match(UPLOADS) ?? [])];
}

export function linearSource({ key, fetch: request = fetch }: { key: string; fetch?: Fetch }): TicketSource {
  async function query<T>(text: string, variables: Record<string, unknown>): Promise<T> {
    const response = await request(LINEAR_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: key },
      body: JSON.stringify({ query: text, variables }),
    });
    const body = await response.json().catch(() => null) as { data?: T; errors?: { message: string }[] } | null;
    if (!response.ok || body === null || body.errors?.length) {
      throw new Error(`Linear answered ${response.status}: ${body?.errors?.map((e) => e.message).join("; ") ?? "no JSON"}`);
    }
    return body.data as T;
  }

  return {
    async assigned() {
      const tickets: Ticket[] = [];
      let after: string | null = null;
      do {
        const data: { viewer: { assignedIssues: { nodes: IssueNode[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } } } } = await query(
          `query($after: String) { viewer { assignedIssues(first: ${PAGE}, after: $after, filter: { state: { type: { nin: ["completed", "canceled"] } } }) {
            nodes { ${ISSUE_FIELDS} } pageInfo { hasNextPage endCursor } } } }`, { after });
        const page = data.viewer.assignedIssues;
        tickets.push(...page.nodes.map(toTicket));
        after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
      } while (after !== null);
      return tickets;
    },

    async read(identifier) {
      try {
        const data: { issue: IssueNode | null } = await query(`query($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} } }`, { id: identifier });
        return data.issue === null ? null : toTicket(data.issue);
      } catch (err) {
        if (String((err as Error).message).includes("Entity not found")) return null;
        throw err;
      }
    },

    async download(ticket, dir) {
      const paths: string[] = [];
      for (const [index, link] of uploadLinks(ticket.description).entries()) {
        const response = await request(link, { headers: { Authorization: key } });
        if (!response.ok) continue;
        const type = response.headers.get("content-type") ?? "";
        const extension = extname(new URL(link).pathname) || (type.startsWith("image/") ? `.${type.slice(6).split(";")[0]}` : "");
        const path = join(dir, `attachment-${index + 1}${extension}`);
        writeFileSync(path, Buffer.from(await response.arrayBuffer()));
        paths.push(path);
      }
      return paths;
    },
  };
}
