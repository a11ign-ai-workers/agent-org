The org's own account list names the three GitHub Apps (a11ign/agent-org#797, follow-up of a11ign#4911). **The defect:** `classifyLogin("a11ign-workers[bot]")` answered `human` for every spelling of every App (`<slug>[bot]`, `<slug>`, `app/<slug>`), so an App's commit or pull request was a hand fix in the ledger, and `newestOrgComment` filtered an App's comment out as "not the org's word".

**What changes.**
- `src/messaging/sources/readers.ts` names the accounts and the three Apps once (`ORG_ACCOUNT_LOGINS`, `ORG_APP_SLUGS`), and `ORG_LOGINS` is the accounts plus each App in its three spellings.
- `src/hand-fix-ledger.ts` imports that list and re-exports it, no longer restating it (Done-when 2: derived, not two copies a comment asks to be kept equal). The leaf is the source because `readers.ts` is a leaf and the ledger imports the tool, so the dependency can only run that way.
- A test pins that the ledger's `ORG_LOGINS` IS the reader's array, that all nine App spellings are `org`, that lookalikes and people are still `human`, and that an App's comment on a fix row is the org's word.

Mutation: five, each red and each restore byte-identical (copy in the scratchpad and `diff`): the `app/` spelling dropped (1 red); the `[bot]` spelling dropped (3 red); the Apps never listed (3 red); the ledger restating its own copy (1 red: the identity test, and no other); `classifyLogin` answering `org` for a person (10 red, the controls).

Evidence: `node --test src/packaging/hand-fix-ledger.test.ts src/messaging/sources/readers.test.ts` 81 of 81 (the original 76 and five new). The row's own Acceptance command exits 0 in this tree. Not run: `pnpm run verify` and `tsc`, because this worktree has no `node_modules` and `rstest` could not be installed from it; `src/packaging/git-reads-name-their-checkout.test.ts` fails here for the same reason (`@a11ign/toolchain` not found) and is untouched by this change.

Acceptance:
```bash
AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node -e 'import("./src/hand-fix-ledger.ts").then(m=>{const r=["scheduler","workers","managers"].flatMap(x=>[`a11ign-${x}[bot]`,`a11ign-${x}`,`app/a11ign-${x}`]); const got=r.map(a=>m.classifyLogin(a)); if(got.some(x=>x!=="org")||m.classifyLogin("a11ign-ai-leads")!=="org")process.exit(1)})' && AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node -e 'import("./src/messaging/sources/readers.ts").then(m=>{for(const a of ["a11ign-scheduler[bot]","a11ign-workers[bot]","a11ign-managers[bot]"]) if(!m.ORG_LOGINS.includes(a))process.exit(1)})'
```

Closes a11ign/agent-org#797

Outside-Region: src/packaging/hand-fix-ledger.test.ts — the test that pins the ledger's list and the App spellings.
Outside-Region: src/messaging/sources/readers.test.ts — the test that an App's comment is the org's word on a fix row.

platform: n/a (a list of logins; GitHub offers no "is this one of our accounts" to ask)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
