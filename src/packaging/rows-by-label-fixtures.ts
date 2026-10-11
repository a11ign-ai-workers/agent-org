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
      ...(Array.isArray(row.closedByPullRequestsReferences) ? { closedByPullRequestsReferences: { nodes: row.closedByPullRequestsReferences } } : {}) })),
  } } } });
}
