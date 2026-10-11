// #977 (a11ign/a11ign#5043): THE HOST DECLARES HOW THE GATE LEARNS OF CHANGES. `events.source` is `poll` (the default, and today's behaviour) or `webhook`,
// which names a receiver; `reconcileMinutes` is the interval. This pins the READER only: nothing consumes the declaration yet, so no test here starts a
// receiver, opens a secret or calls GitHub. Three things are pinned, each by running `parseHostConfig` and not by reading it:
//   1. THE DEFAULT: an absent block, and a block with no `source`, read as `{ source: "poll" }` exactly;
//   2. THE DECLARATION: a `webhook` block reads back whole, and an omitted `reconcileMinutes` is the stated 20;
//   3. THE REFUSALS: each rule is refused BY FIELD NAME, and each refusal is the one field that was wrong (the NEGATIVE CONTROL: the same block with
//      that one field put right is read).
import assert from "node:assert/strict";
import { test } from "node:test";
import { SUPPORTED_SCHEMA } from "./project-config.ts";
import { DEFAULT_RECONCILE_MINUTES, HostConfigRefusal, parseHostConfig } from "./host-config.ts";

const HOST = {
  schema: SUPPORTED_SCHEMA, home: "/home/h", binDir: "/home/h/bin", primary: "p", projects: [{ id: "p", checkout: "/home/h/p" }],
  gh: { workers: "/home/h/workers", leads: "/home/h/leads", leadsHeader: [], leadsWorkspaces: [] },
};
const RECEIVER = { port: 8787, secretPath: "/abs/path/to/webhook-secret", tunnel: "cloudflare" };
const parse = (events?: unknown) => parseHostConfig(JSON.stringify(events === undefined ? HOST : { ...HOST, events }), "host.json");
// `undefined` drops a key from the JSON, which is how a test says the field is missing.
const webhook = (receiver: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({ source: "webhook", receiver: { ...RECEIVER, ...receiver }, ...extra });
const refusalField = (events: unknown) => {
  try { parse(events); } catch (error) { return error instanceof HostConfigRefusal ? error.field : `not a refusal: ${error}`; }
  return "not refused";
};

test("#977: an absent block, and a block that names no `source`, read as `poll`, and nothing else is set", () => {
  assert.deepEqual(parse().events, { source: "poll" }, "an absent block is `poll`: today's behaviour, byte for byte");
  assert.deepEqual(parse({}).events, { source: "poll" }, "a block with no `source` defaults to `poll`");
  assert.deepEqual(parse({ source: "poll" }).events, { source: "poll" });
  assert.deepEqual(parse({ source: "poll", reconcileMinutes: 5 }).events, { source: "poll", reconcileMinutes: 5 }, "a poll host may name its interval; it is not invented when it is left out");
});

test("#977: a `webhook` block reads back whole, and an omitted `reconcileMinutes` is the stated default of 20", () => {
  assert.equal(DEFAULT_RECONCILE_MINUTES, 20);
  const row = { source: "webhook", receiver: RECEIVER, reconcileMinutes: 20 };
  assert.deepEqual(parse({ source: "webhook", receiver: RECEIVER, reconcileMinutes: 20 }).events, row, "POSITIVE CONTROL: the declaration in the row reads back as written");
  assert.deepEqual(parse(webhook({ tunnel: "tailscale" }, { reconcileMinutes: 5 })).events, { source: "webhook", receiver: { ...RECEIVER, tunnel: "tailscale" }, reconcileMinutes: 5 });
  assert.deepEqual(parse(webhook()).events, { source: "webhook", receiver: RECEIVER, reconcileMinutes: 20 }, "left out, the interval is 20 and is set on the result");
});

test("#977: a `source` that is neither `poll` nor `webhook` is refused by `events.source`", () => {
  for (const source of ["push", "Webhook", "", null, 1, ["webhook"]]) {
    assert.equal(refusalField({ source }), "events.source", `${JSON.stringify(source)} is refused by name`);
  }
  assert.equal(refusalField(webhook()), "not refused", "NEGATIVE CONTROL: the same webhook block with a valid source is read");
});

test("#977: an `events` that is not an object is refused by `events`", () => {
  assert.equal(refusalField(null), "events");
  assert.equal(refusalField(["webhook"]), "events");
  assert.equal(refusalField("webhook"), "events");
});

test("#977: `webhook` without a `receiver` is refused by `events.receiver`, and a `poll` with one is refused too, since it would be ignored", () => {
  assert.throws(() => parse({ source: "webhook", reconcileMinutes: 20 }), (error) => error instanceof HostConfigRefusal && error.field === "events.receiver" && error.message.includes("it is missing"), "a missing receiver says it is missing, not that it is the wrong type");
  assert.equal(refusalField({ source: "poll", receiver: RECEIVER }), "events.receiver", "a receiver under `poll` would be read and never used");
  assert.equal(refusalField({ source: "webhook", receiver: null }), "events.receiver");
  assert.equal(refusalField({ source: "webhook", receiver: "8787" }), "events.receiver");
  assert.equal(refusalField(webhook()), "not refused", "NEGATIVE CONTROL: the receiver put back is read");
});

test("#977: a `port` that is not an integer from 1024 to 65535 is refused by `events.receiver.port`", () => {
  for (const port of [80, 1023, 65536, 0, 8787.5, "8787", undefined]) {
    assert.equal(refusalField(webhook({ port })), "events.receiver.port", `${JSON.stringify(port)} is refused by name`);
  }
  for (const port of [1024, 65535]) assert.equal(refusalField(webhook({ port })), "not refused", `${port} is the inclusive edge and is read`);
});

test("#977: a `secretPath` that is not an absolute path is refused by `events.receiver.secretPath`, the path and never the secret", () => {
  for (const secretPath of ["relative/webhook-secret", "./webhook-secret", "", "/abs/dir/", 7, undefined]) {
    assert.equal(refusalField(webhook({ secretPath })), "events.receiver.secretPath", `${JSON.stringify(secretPath)} is refused by name`);
  }
  assert.equal(refusalField(webhook({ secretPath: "/abs/path/to/webhook-secret" })), "not refused", "NEGATIVE CONTROL: the absolute path is read");
});

test("#977: a `tunnel` that is neither `cloudflare` nor `tailscale` is refused by `events.receiver.tunnel`, and nothing defaults it", () => {
  for (const tunnel of ["ngrok", "Cloudflare", "", null, undefined]) {
    assert.equal(refusalField(webhook({ tunnel })), "events.receiver.tunnel", `${JSON.stringify(tunnel)} is refused by name`);
  }
  assert.equal(refusalField(webhook({ tunnel: "tailscale" })), "not refused", "NEGATIVE CONTROL: `tailscale` is read");
});

test("#977: a `reconcileMinutes` that is not a positive integer is refused by `events.reconcileMinutes`, on either source", () => {
  for (const reconcileMinutes of [0, -5, 2.5, "20", null]) {
    assert.equal(refusalField(webhook({}, { reconcileMinutes })), "events.reconcileMinutes", `webhook: ${JSON.stringify(reconcileMinutes)} is refused by name`);
    assert.equal(refusalField({ source: "poll", reconcileMinutes }), "events.reconcileMinutes", `poll: ${JSON.stringify(reconcileMinutes)} is refused by name`);
  }
  assert.equal(refusalField(webhook({}, { reconcileMinutes: 1 })), "not refused", "NEGATIVE CONTROL: 1 minute is the smallest interval and is read");
});
