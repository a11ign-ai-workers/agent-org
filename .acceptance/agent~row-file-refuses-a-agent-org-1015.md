**`row-file` refuses a build row whose `spec` block is missing a required field or has an empty one (agent-org#1015, split from a11ign#5109).** A ` ```spec ` fence must parse as YAML and carry `files`, `tests` (`path`, and `cases` each with a non-empty `given`, `when`, `then`), `run` and `out_of_scope`; `errors` and `examples` are optional and non-empty when present. A `then` of `works`, `correct`, `as expected` or `ok` is refused, and so is a second fence. The refusal names the field path (`tests.cases[2].then`).

Behind `rows.specBlock` in `.agent-org/project.json`, absent meaning OFF. A row with no `spec` fence is exempt.

Acceptance: `AGENT_ORG_HOST=/home/agent/repos/a11y-witness/.agent-org/host.json npx rstest run --config scripts/rstest/rstest.config.ts src/packaging/spec-block-refusal.test.ts`

Mutation: six, each red and each restore byte-identical: flag ignored (1 red); rule never fires (7); several fences allowed (1); vacuous `then` allowed (1); no-fence exemption removed (2); `run` unchecked (2).

Closes: a11ign/agent-org#1015
