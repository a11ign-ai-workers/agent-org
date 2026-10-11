// no-token: gh -- `sendToGitHub` is given a `run` that throws what `host/gh` exits with, and one case puts a stub `gh` first on PATH; no real `gh` starts.
//
// (#4898) A RATE-LIMITED `pr create` IS HELD, NOT FAILED. `host/gh` exits 75 for a write it queued; pr-open must then (1) not call that a failure,
// (2) attach the arm and the session label to the held entry so they are made after the create does, and (3) tell the author in words that stop a
// second copy and a question to a human. The ordinary failure beside it is the positive control: a `gh` that fails for another reason is still
// exit 1, "nothing sent", with the cause.

import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpDir } from "./lib/tmp-fixture.ts";
import { armAfterCreate, EXIT_NOTHING_SENT, EXIT_QUEUED, readQueuedEntry, sendToGitHub } from "./pr-open.ts";
import { QUEUED_EXIT } from "./gh-ledger.ts";

const HELD = { dir: "/q", id: "1790000000-42", resetAt: Date.parse("2026-10-10T23:15:07Z") / 1000 };
const refusedWith = (status: number | undefined) => () => { throw Object.assign(new Error("gh refused"), { status }); };

const send = (mode: string, rest: string[], over: Partial<Parameters<typeof sendToGitHub>[2]> & { status?: number } = {}) => {
  const said: string[] = [];
  const ran: string[][] = [];
  const attached: { entry: { dir: string; id: string; }; steps: string[][]; }[] = [];
  const code = sendToGitHub(mode, rest, {
    run: (a) => { ran.push(a); refusedWith("status" in over ? over.status : QUEUED_EXIT)(); },
    git: (a) => (a.includes("--abbrev-ref") ? "agent/x" : "abc1234"), err: (l) => { said.push(l); },
    owner: () => "ceo", labelExists: () => true, queued: () => HELD,
    attach: (entry, steps) => { attached.push({ entry, steps }); }, ...over,
  });
  return { code, said: said.join(""), ran, attached };
};

test("#4898: a create the wrapper HELD returns the queued code, says QUEUED NOT FAILED, and does not tell the author to retry or ask", () => {
  const r = send("create", ["--head", "agent/x", "--title", "t", "--body", "b"]);
  assert.equal(r.code, EXIT_QUEUED);
  assert.equal(EXIT_QUEUED, QUEUED_EXIT, "the code the wrapper exits and the code this CLI exits are one number");
  assert.notEqual(r.code, EXIT_NOTHING_SENT, "a held call is not 'nothing sent': a caller reading 1 would send it again");
  assert.match(r.said, /QUEUED, NOT FAILED/);
  assert.match(r.said, /1790000000-42 after 23:15:07Z/, "the entry and the time it is made");
  assert.match(r.said, /Do NOT rerun pr-open/);
  assert.match(r.said, /do not ask a human/);
  assert.doesNotMatch(r.said, /retry the same command|nothing was sent, so/i);
  assert.deepEqual(r.ran.map((a) => a[1]), ["create"], "only the create was attempted: the arm of a PR that does not exist yet is never run now");
});

test("#4898: the arm and the owner label are ATTACHED to the held entry, in order, and only for a create", () => {
  const r = send("create", ["--head", "agent/x", "--title", "t", "--body", "b"]);
  assert.equal(r.attached.length, 1);
  assert.deepEqual(r.attached[0].entry, HELD);
  const heads = r.attached[0].steps.map((s) => s.slice(0, 2).join(" "));
  assert.deepEqual(heads, ["pr merge", "pr edit"], "arm first, then the session label");
  assert.ok(r.attached[0].steps[1].includes("session:ceo"));
  assert.ok(r.attached[0].steps[0].includes("--auto"), "armed to merge when green");
  assert.doesNotMatch(r.said, /NOT ATTACHED/);

  const draft = send("create", ["--draft", "--head", "agent/x"]);
  assert.deepEqual(draft.attached[0].steps.map((s) => s.slice(0, 2).join(" ")), ["pr edit"], "a draft is not armed, but is still labelled");

  const missing = send("create", ["--draft", "--head", "agent/x"], { labelExists: () => false });
  assert.deepEqual(missing.attached[0].steps.map((s) => s.slice(0, 2).join(" ")), ["label create", "pr edit"], "a label the repository lacks is created first");

  const edit = send("edit", ["12", "--body", "b"]);
  assert.equal(edit.code, EXIT_QUEUED);
  assert.deepEqual(edit.attached, [], "an edit has nothing to follow it");
});

test("#4898: follow-ups that cannot travel with the entry are SAID, with the one thing left to do by hand", () => {
  const lost = send("create", ["--head", "agent/x"], { queued: () => null });
  assert.equal(lost.code, EXIT_QUEUED);
  assert.match(lost.said, /NOT ATTACHED: the entry the wrapper held could not be found/);
  assert.match(lost.said, /arm and label it by hand/);
  assert.deepEqual(lost.attached, []);

  const broken = send("create", ["--head", "agent/x"], { attach: () => { throw new Error("ENOSPC"); } });
  assert.equal(broken.code, EXIT_QUEUED, "the call is still held; only its follow-ups are lost");
  assert.match(broken.said, /NOT ATTACHED: .*ENOSPC/);
});

test("#4898: POSITIVE CONTROL -- any other failure of the create is still exit 1, nothing sent, with the cause, and attaches nothing", () => {
  for (const status of [1, 4, undefined]) {
    const r = send("create", ["--head", "agent/x"], { status });
    assert.equal(r.code, EXIT_NOTHING_SENT, `status ${status}`);
    assert.doesNotMatch(r.said, /QUEUED/);
    assert.match(r.said, /gh refused/);
    assert.deepEqual(r.attached, []);
  }
});

test("#4898: the queued entry the wrapper leaves is read back; no file, or a torn one, is 'not held' and never a guess", () => {
  const dir = tmpDir("pr-open-queued-");
  const good = join(dir, "good");
  writeFileSync(good, "/home/agent/workers/gh/refused-queue\t1790000000-42\t1790003600\n");
  assert.deepEqual(readQueuedEntry(good), { dir: "/home/agent/workers/gh/refused-queue", id: "1790000000-42", resetAt: 1790003600 });
  assert.equal(existsSync(good), false, "reading consumes it, so the next call cannot read this one's entry");
  assert.equal(readQueuedEntry(good), null);
  assert.equal(readQueuedEntry(join(dir, "absent")), null);
  const torn = join(dir, "torn");
  writeFileSync(torn, "/home/agent/workers/gh/refused-queue\t1790000000-42\tsoon\n");
  assert.equal(readQueuedEntry(torn), null);
});

test("#4898 THROUGH THE REAL `run`: a `gh` that exits 75 and leaves its entry file is reported held, with the entry read from it", () => {
  const bin = tmpDir("pr-open-bin-");
  const seen = join(bin, "seen");
  mkdirSync(join(bin, "b"));
  writeFileSync(join(bin, "b", "gh"), `#!/bin/sh\necho "$*" >> "${seen}"\nprintf '/q\\t9-9\\t1790003600\\n' > "$A11Y_GH_QUEUED_TO"\nexit 75\n`);
  chmodSync(join(bin, "b", "gh"), 0o755);
  const saved = process.env.PATH;
  process.env.PATH = `${join(bin, "b")}:${saved}`;
  const said: string[] = [];
  const attached: string[][][] = [];
  try {
    const code = sendToGitHub("create", ["--draft", "--head", "agent/x"], { git: () => "x", err: (l) => { said.push(l); }, owner: () => null,
      attach: (_entry, steps) => { attached.push(steps); } });
    assert.equal(code, EXIT_QUEUED);
  } finally {
    process.env.PATH = saved;
  }
  assert.match(said.join(""), /QUEUED, NOT FAILED.*as 9-9 after/s);
  assert.equal(readFileSync(seen, "utf8").trim().split("\n").length, 1, "the create was made once and not repeated");
  assert.match(readFileSync(seen, "utf8"), /^pr create --draft --head agent\/x/);
});

// #4968: a PR opens READY and ARMED unless the author says --draft. These run the wrapper's own success path, with a `run` that records argv.
const sendOk = (mode: string, rest: string[]) => {
  const ran: string[][] = [];
  const code = sendToGitHub(mode, rest, { run: (a) => { ran.push(a); }, git: () => "abc1234", err: () => {}, owner: () => null, labelExists: () => true });
  return { code, ran };
};

test("#4968: a create without --draft sends no --draft and is armed straight after", () => {
  const r = sendOk("create", ["--head", "agent/x", "--title", "t", "--body", "b"]);
  assert.equal(r.code, 0);
  assert.ok(!r.ran[0].includes("--draft"), "the wrapper never adds --draft");
  assert.deepEqual(r.ran[1], ["pr", "merge", "--auto", "--merge", "agent/x"], "armed at creation, as a docs-and-tests PR always was");
});

test("#4968: an explicit --draft creates a draft that is NOT armed", () => {
  const r = sendOk("create", ["--draft", "--head", "agent/x", "--title", "t", "--body", "b"]);
  assert.ok(r.ran[0].includes("--draft"), "the explicit not-now is passed through");
  assert.deepEqual(r.ran.map((a) => a[1]), ["create"], "no merge step follows a draft");
  assert.deepEqual(armAfterCreate("create", ["--draft"]), []);
});

test("#4968: edit never arms, draft or not", () => {
  const r = sendOk("edit", ["--body", "b"]);
  assert.deepEqual(r.ran.map((a) => a[1]), ["edit"]);
  assert.deepEqual(armAfterCreate("edit", ["--head", "agent/x"]), []);
  assert.equal(armAfterCreate("create", ["--head", "agent/x"]).length, 1, "positive control: a plain create does arm");
});
