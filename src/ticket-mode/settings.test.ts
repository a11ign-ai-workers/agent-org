// no-token: gh -- nothing here spawns anything; the host file is handed in as text
import { test } from "node:test";
import assert from "node:assert/strict";
import { HOST_FILE_ENV, parseTicketSettings, readTicketSettings, TicketSettingsRefusal } from "./settings.ts";

const clones = { "nbl-ui-netbox": "/repos/nbl-ui-netbox", "nbl-ui-platform": "/repos/nbl-ui-platform", "platform-monorepo": "/repos/platform-monorepo" };

test("only `clones` is required, every repository in it is offered, and every other setting has a default", () => {
  const settings = parseTicketSettings({ clones }, "/home/me");
  assert.deepEqual(Object.keys(settings.clones), ["nbl-ui-netbox", "nbl-ui-platform", "platform-monorepo"]);
  assert.equal(settings.max, 3);
  assert.equal(settings.port, 4747);
  assert.equal(settings.herdrSession, "tickets", "never the org's own session");
  assert.equal(settings.stateDir, "/home/me/.local/state/agent-org");
  assert.equal(settings.worktreeRoot, "/home/me/.local/state/agent-org/tickets/worktrees");
  assert.deepEqual(settings.linearKey, { keychain: "agent-org-linear" });
});

test("the `tickets` block and `stateDir` override the defaults", () => {
  const settings = parseTicketSettings({ clones, stateDir: "/state", tickets: { max: 5, port: 5000, herdrSession: "nbl", worktreeRoot: "/wt", linearKey: { path: "/keys/linear" } } });
  assert.deepEqual({ ...settings, clones: undefined }, { clones: undefined, max: 5, port: 5000, herdrSession: "nbl", worktreeRoot: "/wt", stateDir: "/state", linearKey: { path: "/keys/linear" }, brief: null, deny: [], plugins: [] });
});

test("a machine can add notes to every brief and refuse commands of its own", () => {
  const deny = [{ pattern: "\\bnpm\\s+run\\s+dev\\b(?!:atomic)", reason: "a fixed port collides with other workers" }];
  const settings = parseTicketSettings({ clones, tickets: { brief: "/work/.agent-org/worker-notes.md", deny } }, "/home/me");
  assert.equal(settings.brief, "/work/.agent-org/worker-notes.md");
  assert.deepEqual(settings.deny, deny);
});

test("a machine names the plugins its workers run with, each as name@marketplace", () => {
  assert.deepEqual(parseTicketSettings({ clones, tickets: { plugins: ["nbl-ui@applied-ai"] } }, "/home/me").plugins, ["nbl-ui@applied-ai"]);
  assert.deepEqual(parseTicketSettings({ clones }, "/home/me").plugins, [], "none by default");
});

test("a bad field is refused by its name", () => {
  const field = (host: unknown) => {
    try {
      parseTicketSettings(host, "/home/me");
    } catch (err) {
      assert.ok(err instanceof TicketSettingsRefusal);
      return err.field;
    }
    return "accepted";
  };
  assert.equal(field({}), "clones", "no repositories to offer");
  assert.equal(field({ clones: {} }), "clones");
  assert.equal(field({ clones: { netbox: "relative/path" } }), "clones.netbox");
  assert.equal(field({ clones, tickets: { max: 0 } }), "tickets.max");
  assert.equal(field({ clones, tickets: { max: 2.5 } }), "tickets.max");
  assert.equal(field({ clones, tickets: { herdrSession: "has space" } }), "tickets.herdrSession");
  assert.equal(field({ clones, tickets: { linearKey: { keychain: "x", path: "/y" } } }), "tickets.linearKey");
  assert.equal(field({ clones, tickets: { brief: "notes.md" } }), "tickets.brief", "a relative path");
  assert.equal(field({ clones, tickets: { plugins: ["nbl-ui"] } }), "tickets.plugins", "a plugin with no marketplace");
  assert.equal(field({ clones, tickets: { plugins: "nbl-ui@applied-ai" } }), "tickets.plugins", "one plugin, not a list");
  assert.equal(field({ clones, tickets: { deny: { pattern: "x", reason: "y" } } }), "tickets.deny", "one rule, not a list");
  assert.equal(field({ clones, tickets: { deny: [{ pattern: "x" }] } }), "tickets.deny[0]", "a rule with no reason");
  assert.equal(field({ clones, tickets: { deny: [{ pattern: "x", reason: "y" }, { pattern: "(", reason: "y" }] } }), "tickets.deny[1].pattern", "not a regular expression");
  assert.equal(field({ clones, tickets: { linearKey: { path: "rel" } } }), "tickets.linearKey.path");
  assert.equal(field({ clones, tickets: [] }), "tickets");
  assert.equal(field({ clones }), "accepted", "POSITIVE CONTROL: a valid file is not refused");
});

test("the host file is the one $AGENT_ORG_HOST names, and an unset variable or an unreadable file is refused by name", () => {
  assert.throws(() => readTicketSettings({}), (err: TicketSettingsRefusal) => err.field === HOST_FILE_ENV);
  assert.throws(() => readTicketSettings({ [HOST_FILE_ENV]: "/nope" }, () => { throw new Error("ENOENT"); }), /cannot be read/);
  assert.throws(() => readTicketSettings({ [HOST_FILE_ENV]: "/h" }, () => "{not json"), /not valid JSON/);
  const read = readTicketSettings({ [HOST_FILE_ENV]: "/h" }, () => JSON.stringify({ clones, projects: [], primary: "x", gh: {} }));
  assert.equal(Object.keys(read.clones).length, 3, "the org's own host keys sit beside `clones` and are ignored");
});
