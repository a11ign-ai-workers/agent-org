// no-token: none -- reads this checkout's renovate.json and ci.yml and nothing else
/**
 * (a11ign/a11ign#5153, item 1; replaces #5151's `project-ref-bump.yml`) `renovate.json` ADVANCES `PROJECT_REF`, AND NAMES THE BRANCH `ci-failure-class.ts` READS.
 *
 * Renovate's regex manager is a pattern over a file and answers "no dependencies found" without failing when the pattern stops matching (the first draft of this
 * rule did exactly that: it was read as valid and found nothing, because the pattern was not multi-line). So the pattern is run here, over the real `ci.yml`, and
 * must find the one pin `ci-pins-the-project.test.ts` holds. The branch is the second half: `src/ci-failure-class.ts` classes a pull request red only on pin drift
 * as waiting on the open pull request from `PIN_BUMP_BRANCH`, so a Renovate branch under another name would silently turn that class off. This test is the guard
 * `project-ref-bump-workflow.test.ts` was for the interim workflow, kept when that workflow goes.
 *
 * POSITIVE CONTROL: `bumpedLine` is asked about fixtures whose pin is a branch, a short sha and a commented mention and must find nothing in each, so a pattern
 * that matched everything would fail here and not pass for a rule that works.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PIN_BUMP_BRANCH } from "../ci-failure-class.ts";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const CI = read(".github/workflows/ci.yml");
const CONFIG = JSON.parse(read("renovate.json")) as {
  extends: string[]; enabled: boolean; enabledManagers: string[]; branchPrefix: string;
  customManagers: Array<{ customType: string; managerFilePatterns: string[]; matchStrings: string[]; datasourceTemplate: string; packageNameTemplate: string; currentValueTemplate: string }>;
  packageRules: Array<{ matchDepNames?: string[]; branchTopic?: string }>;
};
const MANAGER = CONFIG.customManagers[0];

/** Renovate reads `(?m)` as an inline flag; JavaScript has none, so the flag leaves the pattern and becomes a flag. */
const asRegExp = (matchString: string) => new RegExp(matchString.replace(/^\(\?m\)/, ""), matchString.startsWith("(?m)") ? "gm" : "g");

/** The sha the manager would replace in `workflow`, or `null` when it matches nothing or more than one line. */
function bumpedLine(workflow: string): string | null {
  const found = [...workflow.matchAll(asRegExp(MANAGER.matchStrings[0]))].map((match) => match.groups?.currentDigest ?? "");
  return found.length === 1 ? found[0] : null;
}

test("the manager finds exactly the pin ci.yml holds", () => {
  const pin = /^ {2}PROJECT_REF: ([0-9a-f]{40})\s*$/m.exec(CI)?.[1];
  assert.ok(pin, "ci.yml has a PROJECT_REF line holding a full sha");
  assert.equal(bumpedLine(CI), pin);
});

test("the control: a branch, a short sha, a commented mention and two pins are each found as nothing", () => {
  const sha = "a9ae7147dba6c891844ec6ea16e41e6594c4292d";
  assert.equal(bumpedLine(`env:\n  PROJECT_REF: ${sha}\n`), sha, "the green control");
  for (const [name, text] of [
    ["a branch", "env:\n  PROJECT_REF: main\n"],
    ["a short sha", "env:\n  PROJECT_REF: a9ae7147d\n"],
    ["a commented mention", `# PROJECT_REF: ${sha}\n`],
    ["two pins", `env:\n  PROJECT_REF: ${sha}\njobs:\n  PROJECT_REF: ${sha}\n`],
  ] as const) assert.equal(bumpedLine(text), null, name);
});

test("the manager reads ci.yml's path and a digest of a11ign/a11ign's main, the repository ci.yml checks out", () => {
  const pattern = MANAGER.managerFilePatterns[0];
  assert.match(pattern, /^\/.*\/$/, "a regular-expression file pattern is written between slashes");
  assert.ok(new RegExp(pattern.slice(1, -1)).test(".github/workflows/ci.yml"), "the file pattern reaches ci.yml");
  assert.equal(MANAGER.customType, "regex");
  assert.equal(MANAGER.datasourceTemplate, "git-refs");
  assert.equal(MANAGER.currentValueTemplate, "main");
  const checkedOut = /repository: (a11ign\/a11ign)\n\s+ref: \$\{\{ env\.PROJECT_REF \}\}/.exec(CI)?.[1];
  assert.ok(checkedOut, "ci.yml checks out the project at the pin");
  assert.equal(MANAGER.packageNameTemplate, `https://github.com/${checkedOut}`);
});

test("the pull request comes from the branch ci-failure-class.ts reads, and the preset is extended and switched on", () => {
  const topic = CONFIG.packageRules.find((rule) => rule.matchDepNames?.includes("a11ign/a11ign"))?.branchTopic;
  assert.ok(topic, "a rule for a11ign/a11ign names the branch topic");
  assert.equal(`${CONFIG.branchPrefix}${topic}`, PIN_BUMP_BRANCH);
  assert.deepEqual(CONFIG.extends, ["local>a11ign/.github"]);
  assert.equal(CONFIG.enabled, true, "the preset is enabled: false until a repository says otherwise");
  assert.deepEqual(CONFIG.enabledManagers, ["custom.regex"], "this repository's one rule is the pin: no manager reads package.json or a workflow's actions");
});
