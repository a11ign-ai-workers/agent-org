/**
 * #4904: THE OPTIONAL `routing` BLOCK of a project's declaration. Three claims, each with its control:
 *   1. ABSENT reads as today -- three routes, the four questions composed by hand thresholds -- so a project that never names the block routes exactly as before;
 *   2. a VALID block reads back as written, and the unmutated base is shown to pass (so every refusal below is for the field it names, not an unrelated one);
 *   3. each way a block can be wrong is REFUSED at load, naming the field: a route that is not one the router can start, a fallback it could not take, a duplicate, an unknown key,
 *      a question that is neither `choice` nor `traits`, a threshold that is not a probability, guidance for a route the project did not configure.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ABSENT_ROUTING, FALLBACK_ROUTES, ProjectDeclarationRefusal, ROUTES, parseProjectDeclaration } from "./project-config.ts";

const BASE = {
  schema: 1,
  tracker: [{ key: "", repo: "acme-corp/widgets", board: { owner: "acme-corp", number: 7 } }],
  code: [{ key: "", repo: "acme-corp/widgets" }],
};
const GUIDANCE = { what: "a stated edit", signals: ["one file"], notFor: "a new module", examples: ["#4629 a constant", "#4875 a threshold"] };

/** The base with a `routing` block of `block`, as the text the reader is given. */
const withRouting = (block: unknown): string => JSON.stringify({ ...BASE, routing: block });
const routingOf = (block: unknown) => parseProjectDeclaration(withRouting(block), "fixture/project.json").routing;

function fieldRefused(text: string): string {
  try {
    parseProjectDeclaration(text, "fixture/project.json");
  } catch (error) {
    assert.ok(error instanceof ProjectDeclarationRefusal, String(error));
    assert.ok(error.message.includes(`\`${(error as unknown as { field: string }).field}\``), `the message names its field: ${error.message}`);
    return (error as unknown as { field: string }).field;
  }
  return assert.fail("the block was ACCEPTED where a refusal was required");
}

test("an ABSENT routing block reads as today: every route, the four questions composed, and the acceptance thresholds 0.5 and 0.7", () => {
  const read = parseProjectDeclaration(JSON.stringify(BASE), "fixture/project.json").routing;
  assert.deepEqual(read, { question: "traits", routes: ["haiku/high", "sonnet/medium", "sonnet/high"], guidance: {}, cheaperMinP: 0.5, dearerMinP: 0.7, sonnetVetoMinP: 0.7 });
  assert.deepEqual(read.routes, [...ROUTES]);
  assert.notEqual(read.routes, ABSENT_ROUTING.routes, "a reader's copy: a caller that sorts it does not move every project's routes");
  assert.deepEqual(routingOf({}), read, "an empty block is an absent one");
});

test("a valid block reads back as written, and `question: choice` is the one line that turns the route question on", () => {
  assert.equal(routingOf({ question: "choice" }).question, "choice");
  const full = routingOf({ question: "choice", routes: ["sonnet/high", "sonnet/medium"], cheaperMinP: 0.4, dearerMinP: 0.85, guidance: { "sonnet/high": GUIDANCE } });
  assert.deepEqual(full, { question: "choice", routes: ["sonnet/medium", "sonnet/high"], guidance: { "sonnet/high": { what: "a stated edit", signals: ["one file"], notFor: "a new module", examples: ["#4629 a constant", "#4875 a threshold"] } }, cheaperMinP: 0.4, dearerMinP: 0.85, sonnetVetoMinP: 0.7 });
  assert.equal(routingOf({ sonnetVetoMinP: 0.85 }).sonnetVetoMinP, 0.85, "a project sets the veto bar and it reads back");
});

test("#5208: `routing.sonnetVetoMinP` is REFUSED at load outside 0.5 to 0.99, naming the field; both ends are the control", () => {
  for (const bad of [0.49, 0.995, 1, 1.2, 0, "0.85", null, Number.NaN]) {
    assert.equal(fieldRefused(withRouting({ sonnetVetoMinP: bad })), "routing.sonnetVetoMinP", JSON.stringify(bad));
  }
  assert.equal(routingOf({ sonnetVetoMinP: 0.5 }).sonnetVetoMinP, 0.5, "the control: 0.5 is the bottom of the range");
  assert.equal(routingOf({ sonnetVetoMinP: 0.99 }).sonnetVetoMinP, 0.99, "the control: 0.99 is the top of the range");
  assert.equal(routingOf({ question: "traits" }).question, "traits");
  assert.equal(routingOf({ _comment: "keys that start with an underscore are notes" }).question, "traits");
});

test("DONE-WHEN: a block naming a route the router cannot start is REFUSED at load, naming the entry -- a typo, an effort it has no profile for, and a route listed twice", () => {
  assert.equal(fieldRefused(withRouting({ routes: ["haiku/high", "sonnet/medium", "sonnet/high", "opus/high"] })), "routing.routes[3]");
  assert.equal(fieldRefused(withRouting({ routes: ["sonnet/medium", "sonnet/low", "sonnet/high"] })), "routing.routes[1]");
  assert.equal(fieldRefused(withRouting({ routes: ["sonnet/medium", "sonnet/medium", "sonnet/high"] })), "routing.routes[1]");
  assert.equal(fieldRefused(withRouting({ routes: "sonnet/high" })), "routing.routes");
  // The control: the same list without the one bad entry loads.
  assert.deepEqual(routingOf({ routes: ["haiku/high", "sonnet/medium", "sonnet/high"] }).routes, ["haiku/high", "sonnet/medium", "sonnet/high"]);
});

test("DONE-WHEN: a block whose fallback is unreachable is REFUSED at load -- either route the file-count rule takes must be configured, and Haiku alone may be left out", () => {
  assert.deepEqual([...FALLBACK_ROUTES], ["sonnet/medium", "sonnet/high"]);
  for (const left of FALLBACK_ROUTES) {
    const routes = ROUTES.filter((route) => route !== left);
    assert.equal(fieldRefused(withRouting({ routes })), "routing.routes", `without ${left}`);
  }
  assert.equal(fieldRefused(withRouting({ routes: [] })), "routing.routes");
  assert.deepEqual(routingOf({ routes: ["sonnet/medium", "sonnet/high"] }).routes, ["sonnet/medium", "sonnet/high"], "the control: a project with no Haiku");
});

test("a block with an unknown key, a question that is neither shape, or a threshold that is not a probability is REFUSED naming the field; a mistyped key is never ignored in silence", () => {
  assert.equal(fieldRefused(withRouting({ questions: "choice" })), "routing.questions");
  assert.equal(fieldRefused(withRouting({ question: "choose" })), "routing.question");
  assert.equal(fieldRefused(withRouting({ question: 1 })), "routing.question");
  for (const bad of [0, -0.1, 1.2, "0.5", null, Number.NaN]) {
    assert.equal(fieldRefused(withRouting({ cheaperMinP: bad })), "routing.cheaperMinP", JSON.stringify(bad));
    assert.equal(fieldRefused(withRouting({ dearerMinP: bad })), "routing.dearerMinP", JSON.stringify(bad));
  }
  assert.equal(routingOf({ cheaperMinP: 1, dearerMinP: 0.01 }).cheaperMinP, 1, "the control: both ends of (0, 1] are probabilities");
  assert.equal(fieldRefused(withRouting("choice")), "routing");
  assert.equal(fieldRefused(withRouting(null)), "routing");
});

test("guidance is refused for a route the project did not configure, for a missing field and for an empty list; guidance for a configured route is kept whole", () => {
  assert.equal(fieldRefused(withRouting({ routes: ["sonnet/medium", "sonnet/high"], guidance: { "haiku/high": GUIDANCE } })), "routing.guidance.haiku/high");
  assert.equal(fieldRefused(withRouting({ guidance: { "opus/max": GUIDANCE } })), "routing.guidance.opus/max");
  assert.equal(fieldRefused(withRouting({ guidance: { "sonnet/high": { ...GUIDANCE, what: undefined } } })), "routing.guidance.sonnet/high.what");
  assert.equal(fieldRefused(withRouting({ guidance: { "sonnet/high": { ...GUIDANCE, examples: [] } } })), "routing.guidance.sonnet/high.examples");
  assert.equal(fieldRefused(withRouting({ guidance: { "sonnet/high": "a stated edit" } })), "routing.guidance.sonnet/high");
  assert.equal(fieldRefused(withRouting({ guidance: [] })), "routing.guidance");
  assert.deepEqual(routingOf({ guidance: { "haiku/high": GUIDANCE } }).guidance, { "haiku/high": GUIDANCE });
});
