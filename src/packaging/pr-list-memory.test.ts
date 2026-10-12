// no-token: gh -- the remembered list and the tick's scopes are pure over one file in the run's private TMPDIR, and `view` is injected; `gh` is never reached
/**
 * #993: A REMEMBERED OPEN-PR LIST CAN BE PATCHED FROM ONE `pr view` AND SAYS WHEN IT CANNOT.
 *
 * `view` is a recorder, so what each test shows is the CALLS the patch made, not only the list it returned. The clock is an argument. Each test names
 * the mutation that turns it red. This file imports only `pr-list-memory.ts`, `tick-scopes.ts` and the `Scope` type.
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { narrowedPrList, readPrList, writePrList, type PrEntry, type PrListRead } from "../pr-list-memory.ts";
import { readTickScopes, writeTickScopes } from "../tick-scopes.ts";
import type { Scope } from "../event-queue.ts";

const REPO = "a11ign/agent-org";
const OTHER = "a11ign/a11y-witness";
const NOW = 2_000_000_000;
const MAX_AGE = 600_000;
const READ_AT = NOW - 60_000;

const made: string[] = [];
const file = () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-list-memory-"));
  made.push(dir);
  return join(dir, "memory.json");
};
after(() => { for (const dir of made) rmSync(dir, { recursive: true, force: true }); });

const pr = (number: number, extra: Record<string, unknown> = {}): PrEntry => ({ number, title: `pull request ${number}`, headRefOid: `sha${number}`, labels: [], ...extra });
const REMEMBERED = [pr(30), pr(20), pr(12), pr(5)];
const memory = (prs: PrEntry[] = REMEMBERED, readAtMs = READ_AT): PrListRead => ({ ok: true, readAtMs, prs });
const prScope = (number: number, repo = REPO): Scope => ({ repo, kind: "pr", number });

/** A `view` that records every number it is asked for and answers from `states` (default OPEN, with the title changed so a replace is visible). */
function recorder(states: Record<number, "OPEN" | "MERGED" | "CLOSED"> = {}) {
  const calls: number[] = [];
  const view = (number: number) => {
    calls.push(number);
    return { ...pr(number, { title: `viewed ${number}` }), state: states[number] ?? "OPEN" };
  };
  return { calls, view };
}
const numbers = (prs: PrEntry[]) => prs.map((entry) => entry.number);

test("a scope naming pull request 12 makes ONE view(12); the other remembered pull requests come back unchanged", () => {
  // POSITIVE CONTROL: the one case that must patch. Mutations: viewing every remembered entry -> `calls` has four numbers; not replacing the entry ->
  // the title is still "pull request 12"; replacing the whole list with the view's answer -> three entries are lost.
  const { calls, view } = recorder();
  const result = narrowedPrList({ repo: REPO, memory: memory(), scopes: [prScope(12)], view });
  assert.equal(result.mode, "narrowed");
  if (result.mode !== "narrowed") return;
  assert.deepEqual(calls, [12]);
  assert.deepEqual(result.viewed, [12]);
  assert.deepEqual(result.remembered, [30, 20, 5]);
  assert.equal(result.prs.find((entry) => entry.number === 12)?.title, "viewed 12");
  for (const number of [30, 20, 5]) assert.deepEqual(result.prs.find((entry) => entry.number === number), pr(number));
  assert.equal(result.readAtMs, READ_AT, "a patch keeps the instant of the whole read it came from");
});

test("a MERGED or CLOSED pull request is removed and an OPEN unseen one is added; the view's `state` is not kept; the list stays newest first", () => {
  // Mutations: dropping the MERGED branch leaves 20; dropping the CLOSED branch leaves 5; not adding an unseen number loses 41; keeping `state` fails the
  // last assertion (the patched entry would not have the shape `pr list` gives); skipping the sort puts 41 last.
  const { calls, view } = recorder({ 20: "MERGED", 5: "CLOSED" });
  const result = narrowedPrList({ repo: REPO, memory: memory(), scopes: [prScope(20), prScope(41), prScope(5)], view });
  assert.equal(result.mode, "narrowed");
  if (result.mode !== "narrowed") return;
  assert.deepEqual(calls, [20, 41, 5]);
  assert.deepEqual(numbers(result.prs), [41, 30, 12]);
  assert.equal("state" in result.prs[0], false);
  assert.deepEqual(result.prs[0], pr(41, { title: "viewed 41" }));
});

test("a repository with no pr scope makes ZERO view calls and returns the remembered list as it was", () => {
  // NEGATIVE CONTROL: the case where nothing may be asked. Mutation: viewing anyway (or treating another repository's scope, or an issue that is not a
  // remembered pull request, as ours) puts a number in `calls`.
  const { calls, view } = recorder();
  const scopes: Scope[] = [prScope(12, OTHER), { repo: REPO, kind: "issue", number: 900 }];
  const result = narrowedPrList({ repo: REPO, memory: memory(), scopes, view });
  assert.deepEqual(calls, []);
  assert.deepEqual(result, { mode: "narrowed", prs: REMEMBERED, readAtMs: READ_AT, viewed: [], remembered: [30, 20, 12, 5] });
  assert.deepEqual(narrowedPrList({ repo: REPO, memory: memory(), scopes: [], view }).mode, "narrowed");
  assert.deepEqual(calls, []);
});

test("a pull request named three ways is viewed once; an issue scope that IS a remembered pull request, and a sha that is its head, name it", () => {
  // A comment on a pull request arrives as `issue_comment` with the pull request's number (event-receiver.ts), and a check event with no pull
  // request number carries only the head sha. Mutations: dropping the `issue` branch or the `sha` branch leaves `calls` short; dropping the `named`
  // set (viewing per scope) makes 12 appear three times.
  const { calls, view } = recorder();
  const scopes: Scope[] = [prScope(12), { repo: REPO, kind: "issue", number: 12 }, { repo: REPO, kind: "sha", sha: "sha12" },
    { repo: REPO, kind: "issue", number: 20 }, { repo: REPO, kind: "sha", sha: "sha5" }];
  const result = narrowedPrList({ repo: REPO, memory: memory(), scopes, view });
  assert.equal(result.mode, "narrowed");
  assert.deepEqual(calls, [12, 20, 5]);
});

test("a sha that names no remembered pull request, and a merge-group, are whole with the reason `unnamed-scope`", () => {
  // Mutation: skipping the whole answer for either narrows past a commit nobody can place. The sha matches no remembered head.
  for (const scope of [{ repo: REPO, kind: "sha", sha: "main-commit" }, { repo: REPO, kind: "merge-group", sha: "sha12" }] as Scope[]) {
    const { calls, view } = recorder();
    const result = narrowedPrList({ repo: REPO, memory: memory(), scopes: [prScope(12), scope], view });
    assert.equal(result.mode, "whole");
    assert.equal(result.mode === "whole" && result.reason, "unnamed-scope");
    assert.deepEqual(calls, [], "it is decided before any view, so a whole read is not preceded by calls it will discard");
  }
  // The same sha scope of ANOTHER repository does not make this one whole.
  const { view } = recorder();
  assert.equal(narrowedPrList({ repo: REPO, memory: memory(), scopes: [{ repo: OTHER, kind: "sha", sha: "x" }], view }).mode, "narrowed");
});

test("every way the memory cannot be trusted is whole, each with a reason of its own", () => {
  // Mutation per case: returning the remembered list instead of whole turns that line red.
  const { view } = recorder();
  const path = file();
  const reasons = new Set<string>();
  const reason = (read: PrListRead) => {
    const result = narrowedPrList({ repo: REPO, memory: read, scopes: [prScope(12)], view });
    assert.equal(result.mode, "whole");
    if (result.mode !== "whole") return "narrowed";
    reasons.add(result.reason);
    return result.reason;
  };
  const readNow = () => readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE });
  assert.equal(reason(readNow()), "missing"); // no file
  writePrList({ path, repo: OTHER, prs: REMEMBERED, readAtMs: READ_AT });
  assert.equal(reason(readNow()), "missing"); // a file, but no entry for this repository

  writeFileSync(path, "{ this is not json");
  assert.equal(reason(readNow()), "unreadable");

  writePrList({ path, repo: REPO, prs: REMEMBERED, readAtMs: NOW - MAX_AGE - 1 });
  assert.equal(reason(readNow()), "too-old");

  const throwing = narrowedPrList({ repo: REPO, memory: memory(), scopes: [prScope(12)], view: () => { throw new Error("gh refused"); } });
  assert.equal(throwing.mode === "whole" && throwing.reason, "view-failed");
  if (throwing.mode === "whole") reasons.add(throwing.reason);

  const unnamed = narrowedPrList({ repo: REPO, memory: memory(), scopes: [{ repo: REPO, kind: "sha", sha: "?" }], view });
  assert.equal(unnamed.mode === "whole" && unnamed.reason, "unnamed-scope");
  if (unnamed.mode === "whole") reasons.add(unnamed.reason);
  assert.deepEqual([...reasons].sort(), ["missing", "too-old", "unnamed-scope", "unreadable", "view-failed"]);
});

test("a view that throws, answers another pull request, or answers an unknown state is whole, and nothing of the patch survives", () => {
  // Mutations: swallowing the throw and carrying on would return `narrowed` with two of three applied; trusting a mismatched number would replace the
  // wrong entry; treating an unknown state as OPEN would store an entry with a state `pr list` never gives.
  const scopes = [prScope(20), prScope(12)];
  const failing = (answer: (number: number) => unknown) => narrowedPrList({ repo: REPO, memory: memory(), scopes, view: answer });
  const second = (number: number) => { if (number === 12) throw new Error("rate limited"); return { ...pr(number), state: "MERGED" }; };
  for (const result of [failing(second), failing((number) => ({ ...pr(number + 1), state: "OPEN" })), failing((number) => ({ ...pr(number), state: "DRAFT?" })),
    failing(() => null), failing(() => undefined)]) {
    assert.equal(result.mode, "whole");
    assert.equal(result.mode === "whole" && result.reason, "view-failed");
  }
});

test("round trip: what writePrList stores readPrList returns, other repositories are kept, and an empty list is a list", () => {
  // Mutations: writing over the whole file loses OTHER's list; reading an empty `prs` as missing makes the third assertion red.
  const path = file();
  writePrList({ path, repo: REPO, prs: REMEMBERED, readAtMs: READ_AT });
  writePrList({ path, repo: OTHER, prs: [], readAtMs: READ_AT + 1 });
  assert.deepEqual(readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE }), { ok: true, readAtMs: READ_AT, prs: REMEMBERED });
  assert.deepEqual(readPrList({ path, repo: OTHER, nowMs: NOW, maxAgeMs: MAX_AGE }), { ok: true, readAtMs: READ_AT + 1, prs: [] });
  writePrList({ path, repo: REPO, prs: [pr(1)], readAtMs: READ_AT + 2 });
  assert.deepEqual(readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE }), { ok: true, readAtMs: READ_AT + 2, prs: [pr(1)] });
  assert.deepEqual(readPrList({ path, repo: OTHER, nowMs: NOW, maxAgeMs: MAX_AGE }).ok, true, "replacing one repository keeps the other");
});

test("a half-written file reads as unreadable, never as an empty list, for the repository it was written for", () => {
  // The hazard: an empty list makes the next tick believe there are no open pull requests. Mutation: catching the parse error and returning `prs: []`
  // turns every cut below red. Every prefix of a real file is tried, so no length happens to be lucky.
  const path = file();
  writePrList({ path, repo: REPO, prs: REMEMBERED, readAtMs: READ_AT });
  const whole = readFileSync(path);
  for (let length = 0; length < whole.length - 1; length += 7) {
    writeFileSync(path, whole.subarray(0, length));
    const read = readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE });
    assert.equal(read.ok, false, `prefix of ${length} bytes`);
  }
  const wellFormedButWrong = [`{"version":1,"repos":{"${REPO}":{"readAtMs":${READ_AT},"prs":"none"}}}`, `{"version":1,"repos":{"${REPO}":{"prs":[]}}}`,
    `{"version":2,"repos":{}}`, `[]`, `null`, `{"version":1,"repos":{"${REPO}":{"readAtMs":${READ_AT},"prs":[{"title":"no number"}]}}}`];
  for (const text of wellFormedButWrong) {
    writeFileSync(path, text);
    const read = readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE });
    assert.equal(read.ok === false && read.reason, "unreadable", text);
  }
});

test("the age limit: exactly the limit is young, one more millisecond is too old, and an instant after now is unreadable", () => {
  // NEGATIVE CONTROL for `too-old`: the boundary must not fire early. Mutations: `>` to `>=` reddens the first; `>` to `<` reddens both; dropping the
  // negative-age check makes the third `ok`.
  const path = file();
  const read = (readAtMs: number) => {
    writePrList({ path, repo: REPO, prs: REMEMBERED, readAtMs });
    return readPrList({ path, repo: REPO, nowMs: NOW, maxAgeMs: MAX_AGE });
  };
  assert.equal(read(NOW - MAX_AGE).ok, true);
  const old = read(NOW - MAX_AGE - 1);
  assert.equal(old.ok === false && old.reason, "too-old");
  const future = read(NOW + 1);
  assert.equal(future.ok === false && future.reason, "unreadable");
});

test("a patched list written back with the whole read's instant ages out; one stamped with this tick would never", () => {
  // Mutation: stamping the patched list with `nowMs` makes the second read `ok` for ever. The ticks below are 400 s apart: three patches, one whole read.
  const path = file();
  writePrList({ path, repo: REPO, prs: REMEMBERED, readAtMs: NOW });
  let tick = NOW;
  for (let n = 0; n < 3; n++) {
    tick += 400_000;
    const read = readPrList({ path, repo: REPO, nowMs: tick, maxAgeMs: MAX_AGE });
    if (n === 1) { assert.equal(read.ok === false && read.reason, "too-old"); return; }
    const result = narrowedPrList({ repo: REPO, memory: read, scopes: [prScope(12)], view: recorder().view });
    assert.equal(result.mode, "narrowed");
    if (result.mode === "narrowed") writePrList({ path, repo: REPO, prs: result.prs, readAtMs: result.readAtMs });
  }
  assert.fail("the list never aged out");
});

test("tick scopes: a file written by writeTickScopes reads back the same scopes in the same order, and an empty tick is [] not null", () => {
  // Mutation: reading `[]` as null (or null as []) reddens the last two assertions; reordering reddens the first; dropping `sha` reddens it too.
  const path = file();
  const scopes: Scope[] = [prScope(12), { repo: OTHER, kind: "issue", number: 7 }, { repo: REPO, kind: "sha", sha: "abc123" },
    { repo: REPO, kind: "merge-group", sha: "def456" }, prScope(3, OTHER)];
  writeTickScopes({ path, scopes });
  assert.deepEqual(readTickScopes(path), scopes);
  writeTickScopes({ path, scopes: [] });
  assert.deepEqual(readTickScopes(path), []);
  assert.equal(readTickScopes(join(dirname(path), "absent.json")), null);
});

test("tick scopes: a corrupt, half-written or wrong-shaped file is null and never throws; a bad scope is refused before the file is touched", () => {
  // Mutation: returning `[]` for a parse error is the hazard (the gate would serve the remembered list as current). The refusal test shows the previous
  // file is untouched, which is why a failed write may throw rather than leave a half file.
  const path = file();
  writeTickScopes({ path, scopes: [prScope(12), prScope(13)] });
  const good = readFileSync(path);
  for (let length = 0; length < good.length - 1; length += 5) {
    writeFileSync(path, good.subarray(0, length));
    assert.equal(readTickScopes(path), null, `prefix of ${length} bytes`);
  }
  for (const text of ["", "null", "[]", `{"version":1}`, `{"version":1,"scopes":[{"repo":"a/b","kind":"pr"}]}`, `{"version":1,"scopes":[{"repo":"a/b","kind":"nope","number":1}]}`,
    `{"version":2,"scopes":[]}`]) {
    writeFileSync(path, text);
    assert.equal(readTickScopes(path), null, text);
  }
  writeFileSync(path, good);
  assert.throws(() => writeTickScopes({ path, scopes: [{ repo: REPO, kind: "pr" } as unknown as Scope] }), TypeError);
  assert.deepEqual(readTickScopes(path), [prScope(12), prScope(13)]);
});
