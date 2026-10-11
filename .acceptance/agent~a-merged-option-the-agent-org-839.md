Acceptance:

```bash
git grep -q "POSITIVE CONTROL" -- src/inert-option-incident.test.ts
AGENT_ORG_HOST=$HOME/repos/role-product-manager/.agent-org/host.json node --test src/inert-option-incident.test.ts
```

Mutation: in `src/inert-option-incident.ts` make the comparison always answer "present" (`if (got.found || true) continue;`): the POSITIVE CONTROL and 10 other tests go red (11 of 15). Make it always fire (`&& false`): `set: the consumer holds the value` and `two lines in one acceptance file` go red and no other. Restored byte-identical (`diff`).

Mutation (rework, agent-org#938 review): in `src/org-retro.ts` `readFileAt`, drop the `oid` (`readFile(repo, path)`): the two tests that name the merge commit go red. Restored byte-identical.
