A new identity goes live on the canary repository first and widens only on a proof reading (a11ign/agent-org#1247). The gate is `widenIdentity`, `countsAsProof` and `recordIdentityProof` in `src/host-units.ts`.

**What changes.**
- `src/host-units.ts`: an identity-canary section next to the re-render. A `github-apps` role is installed for the canary repository, and `widenIdentity` refuses widening with the proof it lacks named. A proof is ONE reading (who, repository, PR, `reviewDecision` before and after, time), written once by `recordIdentityProof` into `identity-canary-proofs.json` under the state directory. It counts only when the PR moved from not-APPROVED to APPROVED by the role's own `[bot]` on the canary repository. REVIEW_REQUIRED after the approval does not count.
- **Assumptions, said so:** the wrapper is role-scoped, not repository-scoped (`host/gh` and `host-config.ts` are outside this Region), so the canary install is recorded as `scope: <canary>` in the decision and NOT enforced by the rendered `gh`. The gate is not yet called from the tick, the widening CLI flag is not wired, and no GitHub reader produces the reading; each is a row of its own.

Mutation: refusal removed in `widenIdentity` (3 red); `countsAsProof` accepting any reading (2 red); each restore byte-identical (copy in the scratchpad, `diff`).

Evidence: `src/host-identity-canary.test.ts` 8 of 8; `src/app-role-silent.test.ts` 18 of 18; `src/packaging/host-units*.test.ts` 183 of 183; `pnpm run typecheck` reports no error.

Acceptance: `bash -c 'cd ~/repos/wt-agent-org-1247 && node --test src/host-identity-canary.test.ts'`

History: full

The gate and its pins are this row; left open as rows: the wrapper's repository scope (Done-when 1's "canary only" in the rendered file), the tick call, the widening flag, and the GitHub reviewDecision reader.

Closes a11ign/agent-org#1247

Outside-Region: .changeset/identity-canary-widens-on-proof.md — the entry a project that pins a tag reads.

platform: n/a (a gate inside the host tool; no platform feature reads identities)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
