// no-token: gh -- `fetch` and `security` are injected; nothing reaches Linear or the Keychain
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { LINEAR_API, linearSource, readLinearKey, uploadLinks } from "./linear.ts";
import type { Ticket } from "./source.ts";

const node = (identifier: string, extra: Record<string, unknown> = {}) => ({
  identifier, title: `Title ${identifier}`, description: null, url: `https://linear.app/x/issue/${identifier}`, branchName: identifier.toLowerCase(),
  priority: 2, state: { name: "Backlog", position: 0 }, team: { key: identifier.split("-")[0] }, project: { name: "Visual Explorer - GA" }, ...extra,
});

/** A Linear that answers GraphQL from `pages` in order, and recording every request. */
function linear(pages: unknown[], uploads: Record<string, { status: number; body?: string; type?: string }> = {}) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string, init: RequestInit = {}) => {
    requests.push({ url, init });
    if (url === LINEAR_API) return new Response(JSON.stringify(pages.shift()), { status: 200 });
    const upload = uploads[url] ?? { status: 404 };
    return new Response(upload.body ?? "", { status: upload.status, headers: { "content-type": upload.type ?? "image/png" } });
  }) as typeof globalThis.fetch;
  return { fetch, requests };
}

test("assigned() reads every page of the viewer's unfinished tickets, sending the key and nothing else", async () => {
  const { fetch, requests } = linear([
    { data: { viewer: { assignedIssues: { nodes: [node("NBF-1"), node("VE-2", { project: null })], pageInfo: { hasNextPage: true, endCursor: "c1" } } } } },
    { data: { viewer: { assignedIssues: { nodes: [node("NBF-3")], pageInfo: { hasNextPage: false, endCursor: null } } } } },
  ]);
  const tickets = await linearSource({ key: "lin_api_secret", fetch }).assigned();
  assert.deepEqual(tickets.map((t) => t.key), ["NBF-1", "VE-2", "NBF-3"]);
  assert.equal(tickets[1].project, null);
  assert.equal(tickets[0].branch, "nbf-1", "the branch Linear links a pull request by");
  assert.equal(requests.length, 2);
  assert.equal((requests[0].init.headers as Record<string, string>).Authorization, "lin_api_secret");
  const second = JSON.parse(String(requests[1].init.body));
  assert.equal(second.variables.after, "c1", "the second page starts where the first ended");
  assert.match(second.query, /nin: \["completed", "canceled"\]/, "finished tickets are not offered");
});

test("read() returns the ticket, null for a key Linear has no ticket for, and throws when Linear cannot be asked", async () => {
  assert.equal((await linearSource({ key: "k", fetch: linear([{ data: { issue: node("NBF-1270") } }]).fetch }).read("NBF-1270"))?.title, "Title NBF-1270");
  assert.equal(await linearSource({ key: "k", fetch: linear([{ errors: [{ message: "Entity not found: Issue" }] }]).fetch }).read("NBF-0"), null);
  await assert.rejects(linearSource({ key: "k", fetch: linear([{ errors: [{ message: "Authentication required" }] }]).fetch }).read("NBF-1"), /Authentication required/);
});

test("download() fetches each Linear upload the description links to, with the key, and skips one that will not load", async () => {
  const a = "https://uploads.linear.app/org/a/one";
  const b = "https://uploads.linear.app/org/b/two.jpg";
  const ticket = { key: "NBF-1", description: `![one](${a}) text ![two](${b}) again ${a} and https://example.com/not-ours.png` } as Ticket;
  assert.deepEqual(uploadLinks(ticket.description), [a, b], "each upload once, in order, and only Linear's");
  const { fetch, requests } = linear([], { [a]: { status: 200, body: "PNG", type: "image/png" }, [b]: { status: 403 } });
  const dir = tmpDir("ticket-linear-download-");
  const paths = await linearSource({ key: "k", fetch }).download(ticket, dir);
  assert.equal(paths.length, 1);
  assert.match(paths[0], /attachment-1\.png$/);
  assert.equal(readFileSync(paths[0], "utf8"), "PNG");
  assert.ok(!existsSync(`${dir}/attachment-2.jpg`));
  assert.ok(requests.every(({ init }) => (init.headers as Record<string, string>).Authorization === "k"), "uploads are only readable with the key");
});

test("the key comes from the Keychain service or the file the host file names, and an empty one is refused", () => {
  const calls: string[][] = [];
  assert.equal(readLinearKey({ keychain: "agent-org-linear" }, (args) => { calls.push(args); return "lin_api_x\n"; }), "lin_api_x");
  assert.deepEqual(calls, [["find-generic-password", "-s", "agent-org-linear", "-w"]]);
  assert.equal(readLinearKey({ path: "/k" }, () => { throw new Error("not used"); }, () => " lin_api_y \n"), "lin_api_y");
  assert.throws(() => readLinearKey({ keychain: "s" }, () => "\n"), /is empty/);
});
