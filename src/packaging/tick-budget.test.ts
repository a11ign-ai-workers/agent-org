// no-token: gh
//
// Nothing here reaches GitHub. The org-health reads run in a child process whose PATH is one temporary directory holding a stub `gh` that logs each call and prints `[]`.
// ERASABLE TYPESCRIPT ONLY (no enum, namespace or parameter property): node strips the types itself.

/**
 * (agent-org#1225) THE ORG-HEALTH PHASE OF THE TICK HAS A CEILING ON ITS `gh` SPAWNS, AND THE CEILING ONLY GOES DOWN.
 *
 * WHY A COUNT AND NOT A TIMING. A timing is a reading of one runner on one day. A spawn is a fact: the org-health phase asks GitHub this many times, and asking
 * the same question twice is a call that could have been one. The first-wave read (`readWithFirstWaveTogether`) changes WHEN the calls happen, not how many, so this
 * test holds the number that the wave must not raise. A cut to the phase lowers `phases["org-health"].spawns` in `docs/gh-call-baseline.json` by hand, the same
 * way `gh-call-ratchet.test.ts` lowers a file's entry.
 *
 * WHAT IS COUNTED. Each line the stub `gh` writes is one spawn of the command. The fixture is the org-health project the other org-health tests use, with no open
 * rows and no pull requests, so the count is the reads the phase makes on an empty org, not on the production org (whose timings this test cannot measure).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL("..", import.meta.url));
const PRELOAD = join(SRC, "lib", "crash-exit.ts");
const FIXTURE = fileURLToPath(new URL("./fixtures/org-health/project", import.meta.url));
const BASELINE = fileURLToPath(new URL("../../docs/gh-call-baseline.json", import.meta.url));
const REPO = "a11ign/agent-org";

/** The one child script: it runs the org-health phase exactly as the gate does, with the io the gate's own tests use, and nothing else. */
const PROBE = `import { orgHealthTogether } from ${JSON.stringify(join(SRC, "work-gate", "org-health.ts"))};
const NOW = Date.parse("2026-10-03T16:00:00Z");
const decideArgs = { prs: [], required: [], readyRows: [], prFiles: new Map(), rowBranches: [], openRows: [], primaryDrift: null, claimRefusals: [] };
orgHealthTogether({ prsRead: [], readyRead: [], openRowsRead: [], decideArgs, decided: [] },
  { now: NOW, log: () => {}, readCaptures: () => undefined, readLabJobs: () => [], teamAccess: () => undefined, readWaits: () => ({ facts: new Map(), stale: [], bare: [], manual: 0 }) },
  { repo: ${JSON.stringify(REPO)}, openRowsRead: [], claimedComments: [], now: NOW });
`;

/** The `gh` the child finds on its PATH: it records its arguments, one line per call, and answers an empty list. */
const STUB_GH = `#!/bin/sh\necho "$*" >> "$STUB_LOG"\necho "[]"\n`;

test("the org-health phase spawns gh no more often than the ceiling docs/gh-call-baseline.json records for it, and the stub saw real calls", () => {
  const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
  const ceiling: number = baseline.phases["org-health"].spawns;
  assert.ok(Number.isInteger(ceiling), `${BASELINE} has no integer ceiling for the org-health phase`);

  const dir = mkdtempSync(join(tmpdir(), "tick-budget-"));
  try {
    const bin = join(dir, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "gh"), STUB_GH);
    chmodSync(join(bin, "gh"), 0o755);
    const log = join(dir, "gh.log");

    cpSync(FIXTURE, join(dir, "project"), { recursive: true });
    const host = join(dir, "host.json");
    writeFileSync(host, JSON.stringify({ schema: 1, home: dir, binDir: bin, primary: "fixture",
      projects: [{ id: "fixture", checkout: join(dir, "project") }],
      gh: { workers: join(dir, "workers"), leads: join(dir, "leads"), leadsHeader: [], leadsWorkspaces: [] } }));
    writeFileSync(join(dir, "package.json"), '{"type":"module"}'); // node reads a loose .ts as CommonJS without it
    writeFileSync(join(dir, "probe.ts"), PROBE);

    const env = { PATH: bin, STUB_LOG: log, AGENT_ORG_HOST: host };
    const run = spawnSync(process.execPath, [`--import=${PRELOAD}`, join(dir, "probe.ts")], { encoding: "utf8", cwd: dir, env });
    assert.equal(run.status, 0, `the org-health phase threw on the fixture:\n${run.stderr}`);

    const spawns = existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean).length : 0;
    // CONTROL: a stub that was never reached counts zero, which would pass any ceiling. The fixture's release and board reads must reach it.
    assert.ok(spawns > 0, "the stub gh logged no call, so a count of zero is a probe that never ran and not a phase that asks nothing");
    assert.ok(spawns <= ceiling, `the org-health phase spawned gh ${spawns} times, above the ceiling ${ceiling} in docs/gh-call-baseline.json: a rise needs its own reason, and a cut lowers the ceiling there`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
