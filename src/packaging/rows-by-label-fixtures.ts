// no-token: none -- a fixture for test fakes of `gh`; it spawns nothing and reaches nothing
// #5039: THE FAKE'S HALF OF `ticket-port/rows-by-label.ts`. The claim path no longer lists rows with `gh issue list --label`, which `gh` sends as a
// SEARCH; it reads `repository.issues(labels:)` over `gh api graphql`. A test fake that answered `issue list` must now answer THIS, so the three
// helpers here are the one place the argv and the answer's shape are written down, and a fake adds two lines instead of learning the query.
//
// A fake keeps writing its rows in the shape `gh issue list --json number,labels,body,blockedBy` gave (`labels: [{ name }]`, `blockedBy: { nodes }`):
// `connectionOf` turns that into the connection's shape, and `readsRowsByLabel` says which label and state a request asked for.

/** One row as a fake writes it: the `gh issue list --json` shape. `labels` may be bare names. */
export type FakeRow = {
  number: number; body?: string | null; labels?: ({ name: string; } | string)[]; blockedBy?: { nodes: { number: number; }[]; };
  [more: string]: unknown;
};

/** What a `gh api graphql` argv asked of the by-label read, or `null` when it is some other call. */
export function readsRowsByLabel(args: readonly string[]): { label: string; state: "OPEN" | "CLOSED"; } | null {
  if (args[0] !== "api" || args[1] !== "graphql") return null;
  const query = args.find((arg) => arg.startsWith("query=")) ?? "";
  const state = /issues\(states:(OPEN|CLOSED),labels:\[\$label\]/.exec(query)?.[1];
  const label = args.find((arg) => arg.startsWith("label="))?.slice("label=".length);
  return state === undefined || label === undefined ? null : { label, state: state as "OPEN" | "CLOSED" };
}

/** The connection's answer for `rows`, one page unless `hasNextPage` says there is another. */
export function connectionOf(rows: readonly FakeRow[], { hasNextPage = false }: { hasNextPage?: boolean; } = {}): string {
  const named = (label: { name: string; } | string): { name: string; } => (typeof label === "string" ? { name: label } : label);
  return JSON.stringify({ data: { repository: { issues: {
    pageInfo: { hasNextPage, endCursor: hasNextPage ? "cursor" : null },
    nodes: rows.map((row) => ({ ...row, labels: { nodes: (row.labels ?? []).map(named) }, blockedBy: row.blockedBy ?? { nodes: [] },
      ...(Array.isArray(row.comments) ? { comments: { nodes: row.comments } } : {}),
      ...(Array.isArray(row.closedByPullRequestsReferences) ? { closedByPullRequestsReferences: { nodes: row.closedByPullRequestsReferences } } : {}) })),
  } } } });
}

// --- #5050: THE GATE'S OTHER TWO LIST READS, in the same two halves ----------------------------------------------------------------------------

/**
 * What a `gh api graphql` argv asked of the gate's CLOSED ANSWER READ (`closedRowsCarrying` in `work-gate.ts`): the connection it asked of (`issues`, or
 * `pullRequests` for the closed and merged pull requests) and the answer labels it asked for, one alias each. `null` when it is some other call.
 */
export function readsClosedAnswerRows(args: readonly string[]): { kind: "issues" | "pullRequests"; names: string[]; } | null {
  if (args[0] !== "api" || args[1] !== "graphql") return null;
  const query = args.find((arg) => arg.startsWith("query=")) ?? "";
  const aliases = [...query.matchAll(/a\d+: (issues|pullRequests)\(labels: \[("(?:[^"\\]|\\.)*")\]/g)];
  if (aliases.length === 0) return null;
  return { kind: aliases[0][1] as "issues" | "pullRequests", names: aliases.map((alias) => JSON.parse(alias[2]) as string) };
}

/** The closed answer read's answer for `rows` (written as `gh` gave them, `labels` possibly bare names), all under one alias: the reader keeps a row once whichever alias carries it. */
export function closedAnswerConnection(rows: readonly FakeRow[]): string {
  const named = (label: { name: string; } | string): { name: string; } => (typeof label === "string" ? { name: label } : label);
  return JSON.stringify({ data: { repository: { a0: { nodes: rows.map((row) => ({ ...row, labels: { nodes: (row.labels ?? []).map(named) } })) } } } });
}

/** Is this argv the gate's read of the newest-UPDATED closed rows (`readRecentlyClosed`)? */
export function readsRecentlyClosed(args: readonly string[]): boolean {
  return args[0] === "api" && args[1] === "graphql" && args.some((arg) => arg.startsWith("query=") && arg.includes("issues(states:CLOSED,first:$first,orderBy:{field:UPDATED_AT"));
}

/** That read's answer for `rows` -- `{ number, closedAt, updatedAt }`, newest update first -- as the connection gives it. */
export function recentlyClosedConnection(rows: readonly object[]): string {
  return JSON.stringify({ data: { repository: { issues: { nodes: rows } } } });
}

// --- #5050: THE ANSWER A SERVER GIVES IS ONLY THE FIELDS THE QUERY SELECTED --------------------------------------------------------------------

/** The names a by-label read selected of each row (`number labels(first:50){nodes{name}} body` is `number`, `labels`, `body`), or `null` when the argv is not that read. */
export function selectedFieldsOf(args: readonly string[]): string[] | null {
  const query = args.find((arg) => arg.startsWith("query=")) ?? "";
  const selection = /pageInfo\{hasNextPage endCursor\} nodes\{(.*)\}\}\}\}$/.exec(query)?.[1];
  if (selection === undefined) return null;
  const names: string[] = [];
  let depth = 0;
  let word = "";
  for (const char of `${selection} `) {
    if (depth === 0 && /\w/.test(char)) { word += char; continue; }
    if (word !== "") names.push(word);
    word = "";
    if (char === "(" || char === "{") depth += 1;
    else if (char === ")" || char === "}") depth -= 1;
  }
  return names;
}

/**
 * `connectionOf`, with each node cut to the fields the read SELECTED, as GitHub answers: a connection never returns a field the query did not ask for. A fake that
 * answers whole rows would make a row read for its labels differ from the same row made from the open list, which carries only the fields it was asked.
 */
export function connectionOfSelected(rows: readonly FakeRow[], args: readonly string[], options: { hasNextPage?: boolean; } = {}): string {
  const fields = selectedFieldsOf(args);
  const answer = JSON.parse(connectionOf(rows, options));
  if (fields !== null) answer.data.repository.issues.nodes = answer.data.repository.issues.nodes.map((node: Record<string, unknown>) => Object.fromEntries(fields.map((field) => [field, node[field]])));
  return JSON.stringify(answer);
}
