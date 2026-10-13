// no-token: gh -- host fixtures and in-memory pull requests; nothing here spawns `gh`, `git`, `codex` or systemctl for real.
/**
 * agent-org#1268: the reviewer's `row-review` skill is SHIPPED, INSTALLED BY `host:install` and NAMED BY `host:check`. The order that names it, behind `review.rowReviewSkill`,
 * is held in `row-review-skill-order.test.ts`: it cannot share this file, whose fixture project declares no `roles` for the order module to read.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import "./host-units-project.ts"; // FIRST of the tool imports: it makes a fixture project the tool's before `host-units.ts` resolves one (#3233)
import { tmpDir } from "../lib/tmp-fixture.ts";

const { ROW_REVIEW_SKILL_FILES, ROW_REVIEW_SKILL_SOURCE, hostUnitDrift, rowReviewSkillDrift, rowReviewSkillInstall, rowReviewSkillPath, rowReviewSkillState }
  = await import("../host-units.ts");

const here = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

function inTemporaryHome(body: (home: string) => void): void {
  body(tmpDir("row-review-skill-1268-"));
}
const hostOf = (home: string) => ({ host: { home } }) as unknown as Parameters<typeof rowReviewSkillPath>[0];
/** Only the skill's own directory is placed; the rest of the host is the fixture's, which `hostUnitDrift` needs whole. */
const placedAt = (home: string) => ({ skillDir: join(home, ".codex", "skills", "row-review") });
const quiet = { out: () => {} };

// --- the file the repository ships --------------------------------------------------------------------------------------

test("the shipped skill is the one the order names: its frontmatter says `row-review`, it has the three axes, and the licence is upstream's MIT", () => {
  const skill = readFileSync(join(ROW_REVIEW_SKILL_SOURCE, "SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: row-review\ndescription: .+\n---\n/);
  for (const heading of ["## Axis 1: Spec", "## Axis 2: Tests and correctness", "## Axis 3: Standards", "## Verdict"]) assert.ok(skill.includes(heading), heading);
  assert.match(readFileSync(join(ROW_REVIEW_SKILL_SOURCE, "LICENSE"), "utf8"), /^MIT License\n\nCopyright \(c\) 2026 Matt Pocock/);
  assert.deepEqual([...ROW_REVIEW_SKILL_FILES], ["SKILL.md", "LICENSE"]);
});

// --- `host:check` -------------------------------------------------------------------------------------------------------

test("the skill is read from where Codex reads it: under the host's home, `.codex/skills/row-review`", () => {
  assert.equal(rowReviewSkillPath({ host: { home: "/home/somebody" } } as never), "/home/somebody/.codex/skills/row-review");
});

test("`host:check`: NOT INSTALLED, then CURRENT after the install, then STALE when a file is edited or one is missing", () => {
  inTemporaryHome((home) => {
    const deps = hostOf(home);
    assert.equal(rowReviewSkillState(deps).state, "NOT INSTALLED");
    assert.equal(rowReviewSkillDrift(deps)[0].problem, "row-review skill NOT INSTALLED");
    assert.match(rowReviewSkillDrift(deps)[0].detail, /host:install/);

    const written = rowReviewSkillInstall({ ...deps, ...quiet });
    assert.deepEqual(written.map((p) => p.slice(rowReviewSkillPath(deps).length + 1)), ["SKILL.md", "LICENSE"]);
    assert.equal(rowReviewSkillState(deps).state, "CURRENT");
    assert.deepEqual(rowReviewSkillDrift(deps), [], "the one-change control: CURRENT is no finding");
    for (const name of ROW_REVIEW_SKILL_FILES) assert.equal(readFileSync(join(rowReviewSkillPath(deps), name), "utf8"), readFileSync(join(ROW_REVIEW_SKILL_SOURCE, name), "utf8"));

    writeFileSync(join(rowReviewSkillPath(deps), "SKILL.md"), "an older skill\n");
    assert.deepEqual([rowReviewSkillState(deps).state, rowReviewSkillState(deps).differing], ["STALE", ["SKILL.md"]]);
    assert.equal(rowReviewSkillDrift(deps)[0].problem, "row-review skill STALE");

    rowReviewSkillInstall({ ...deps, ...quiet });
    rmSync(join(rowReviewSkillPath(deps), "LICENSE"));
    assert.deepEqual([rowReviewSkillState(deps).state, rowReviewSkillState(deps).differing], ["STALE", ["LICENSE"]], "a half-installed skill is stale, not not-installed");
  });
});

test("`host:check`: a shipped copy that cannot be read is SOURCE UNREADABLE, never CURRENT and never STALE", () => {
  inTemporaryHome((home) => {
    const deps = { ...hostOf(home), source: join(home, "no-such-skill") };
    assert.equal(rowReviewSkillState(deps).state, "SOURCE UNREADABLE");
    assert.match(rowReviewSkillDrift(deps)[0].detail, /could not be read/);
    assert.throws(() => rowReviewSkillInstall({ ...deps, ...quiet }), /cannot install the row-review skill/);
  });
});

test("`host:check` is WIRED to it: hostUnitDrift carries the finding and drops it once installed", () => {
  // THE MUTANT: deleting `...rowReviewSkillDrift(deps)` from `hostUnitDrift` kills none of the direct calls above.
  inTemporaryHome((home) => {
    const asked = { ...placedAt(home), systemctl: () => "LANG=C\n", shippedDir: home, installedDir: home };
    const mine = () => (hostUnitDrift(asked as never) as { unit: string; problem: string; }[]).filter((d) => d.unit === rowReviewSkillPath(asked as never));
    assert.deepEqual(mine().map((d) => d.problem), ["row-review skill NOT INSTALLED"]);
    rowReviewSkillInstall({ ...asked, ...quiet });
    assert.deepEqual(mine(), []);
  });
});

test("`host:install` runs it: the call sits inside the --install branch of main()", () => {
  const main = readFileSync(here("../host-units.ts"), "utf8").split("\n");
  const at = main.findIndex((l) => l.trim() === "rowReviewSkillInstall();");
  assert.ok(at > 0 && main.slice(at - 6, at).some((l) => l.includes("--install")), "rowReviewSkillInstall() is called inside the --install branch of main()");
});
