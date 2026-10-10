Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json node --import tsx --test src/pr-open-other-repository-branch.test.ts src/pr-open-only-creates.test.ts`

Mutation: five mutants of `src/pr-open.ts`, each killed by the new file (10 tests), each restored from a copy and `diff`ed byte-identical: the commit comparison dropped (1 red); an absent branch read as a match (1); the Region's repository not added to the send (2); a tree whose `origin` is the Region's repository not recognised (2); a failed read of the branch swallowed as a match (1).
