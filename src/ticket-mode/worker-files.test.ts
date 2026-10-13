// no-token: gh -- pure builders
import { test } from "node:test";
import assert from "node:assert/strict";
import { briefText, firstPrompt, workerFlags, workerSettings } from "./worker-files.ts";
import type { Ticket } from "./source.ts";

const ticket = { key: "NBF-1270", title: "Refresh Data gives no feedback", description: "Clicking does nothing visible.", url: "https://linear.app/x/issue/NBF-1270",
  branch: "nbf-1270-refresh", status: "Backlog", statusOrder: 0, team: "NBF", project: null, priority: 3 } as Ticket;
const worktrees = [
  { repo: "nbl-ui-netbox", path: "/wt/NBF-1270/nbl-ui-netbox", base: "develop" },
  { repo: "nbl-ui-platform-libs", path: "/wt/NBF-1270/nbl-ui-platform-libs", base: "develop" },
];

test("the brief carries the ticket, every repository's worktree, the draft rule and the outcome file's path", () => {
  const brief = briefText({ ticket, worktrees, ticketDir: "/state/tickets/NBF-1270", attachments: ["/state/tickets/NBF-1270/attachment-1.png"] });
  for (const part of [ticket.url, ticket.description, "/wt/NBF-1270/nbl-ui-netbox", "/wt/NBF-1270/nbl-ui-platform-libs", "branch `nbf-1270-refresh` from `develop`",
    "gh pr create --draft", "/state/tickets/NBF-1270/outcome.json", "attachment-1.png", "wrong-repo", "needs-human", "CLAUDE.md"]) {
    assert.ok(brief.includes(part), `the brief names ${part}`);
  }
});

test("the settings file holds the permission mode, the model, every other worktree and both hooks, by absolute path", () => {
  const settings = workerSettings({ model: "sonnet", ticketDir: "/state/tickets/NBF-1270", otherWorktrees: ["/wt/NBF-1270/nbl-ui-platform-libs"], hook: { node: "/usr/bin/node", bin: "/tool/src/bin.ts" } }) as any;
  assert.equal(settings.autoMemoryEnabled, false);
  assert.equal(settings.model, "sonnet", "a resumed session, which loses its flags, keeps its model");
  assert.equal(settings.permissions.defaultMode, "bypassPermissions");
  assert.deepEqual(settings.permissions.additionalDirectories, ["/state/tickets/NBF-1270", "/wt/NBF-1270/nbl-ui-platform-libs"]);
  assert.deepEqual(settings.hooks.Stop[0].hooks[0], { type: "command", command: "/usr/bin/node", args: ["/tool/src/bin.ts", "ticket:hook", "stop", "/state/tickets/NBF-1270"], timeout: 30 });
  assert.equal(settings.hooks.PreToolUse[0].matcher, "*");
  assert.deepEqual(settings.hooks.PreToolUse[0].hooks[0].args.slice(1, 3), ["ticket:hook", "pre-tool-use"]);
});

test("the flags end with --disallowedTools, so its list swallows no flag after it", () => {
  const flags = workerFlags({ name: "NBF-1270", model: "opus", effort: "high", addDirs: ["/a", "/b"] });
  assert.deepEqual(flags.slice(-2), ["--disallowedTools", "AskUserQuestion"]);
  assert.deepEqual(flags.slice(0, 6), ["--model", "opus", "--effort", "high", "--name", "NBF-1270"]);
  assert.equal(flags.filter((f) => f === "--add-dir").length, 2);
  assert.equal(firstPrompt("/state/tickets/NBF-1270"), "Read /state/tickets/NBF-1270/brief.md and follow it.");
});
