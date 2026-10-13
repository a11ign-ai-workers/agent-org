// no-token: gh -- the hook decides on text; the one real process is `node` running `bin.ts ticket:hook`, to prove the command a settings file names works
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpDir } from "../lib/tmp-fixture.ts";
import { MAX_STOP_REFUSALS, main, stopVerdict, toolVerdict } from "./hook.ts";

const bash = (command: string) => toolVerdict("Bash", { command }).code;

test("a worker opens a draft and nothing past it: ready, merge, review, reviewers, workflows, force pushes and assumego are refused", () => {
  assert.equal(bash("gh pr create --title t --body b"), 2, "a pull request that is not a draft");
  assert.equal(bash("gh pr create --draft --title t --body b"), 0, "POSITIVE CONTROL: a draft is allowed");
  for (const refused of ["gh pr ready 12", "gh pr merge 12 --squash", "gh pr review 12 --approve", "gh pr edit 12 --add-reviewer x", "gh workflow run ci.yml",
    "git push --force origin b", "git push -f origin b", "git push --force-with-lease", "git push origin +b", "assumego prod"]) {
    assert.equal(bash(refused), 2, refused);
  }
  for (const allowed of ["git push -u origin nbf-1270-refresh", "gh pr view 12", "gh pr edit 12 --body x", "npm test", "git commit -m 'fix: x'"]) {
    assert.equal(bash(allowed), 0, allowed);
  }
});

test("every connector is refused, and so are the two skills that reach outside the worker", () => {
  assert.equal(toolVerdict("mcp__claude_ai_Linear__save_comment", {}).code, 2);
  assert.equal(toolVerdict("mcp__plugin_slack_slack__slack_send_message", {}).code, 2);
  assert.equal(toolVerdict("Skill", { skill: "tool-screenshot-app" }).code, 2);
  assert.equal(toolVerdict("Skill", { skill: "post-pr-to-slack" }).code, 2);
  assert.equal(toolVerdict("Skill", { skill: "clean-code-review" }).code, 0, "POSITIVE CONTROL: the review the brief asks for is allowed");
  assert.equal(toolVerdict("Edit", { file_path: "/x" }).code, 0);
});

test("a stop with no outcome is refused twice in a row, then allowed; an outcome allows it and resets the count", () => {
  const dir = tmpDir("ticket-hook-stop-");
  const verdicts = Array.from({ length: MAX_STOP_REFUSALS + 1 }, () => stopVerdict(dir).code);
  assert.deepEqual(verdicts, [2, 2, 0]);
  writeFileSync(join(dir, "outcome.json"), "{\"kind\":\"needs-human\",\"reason\":\"r\"}");
  assert.equal(stopVerdict(dir).code, 0);
  writeFileSync(join(dir, "outcome.json"), "");
  assert.equal(stopVerdict(dir).code, 0, "the outcome file's presence decides; the pool reads what it says");
});

test("`stop_hook_active` does not let a stop through: the nbl-ui gates set it, and the outcome would be skipped", () => {
  const dir = tmpDir("ticket-hook-active-");
  assert.equal(main(JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true }), ["stop", dir]).code, 2);
});

test("an unreadable payload or a bad call fails open, out loud", () => {
  const unreadable = main("{not json", ["pre-tool-use", "/x"]);
  assert.equal(unreadable.code, 0);
  assert.match(unreadable.say[0], /ALLOWED/);
  assert.equal(main("{}", ["wrong", "/x"]).code, 0);
});

test("the command a settings file names runs: `node bin.ts ticket:hook pre-tool-use` exits 2 for `gh pr ready`, with the reason on stderr", () => {
  const bin = fileURLToPath(new URL("../bin.ts", import.meta.url));
  const result = spawnSync(process.execPath, [bin, "ticket:hook", "pre-tool-use", "/x"], {
    input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "gh pr ready 5" } }), encoding: "utf8",
  });
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, /the person's/);
});
