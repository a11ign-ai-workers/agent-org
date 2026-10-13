`ci.yml`'s `suite` job runs as a matrix of shards (rstest's `--shard "$SHARD/$SHARDS"`, the values passed by `env:`). Shard 1 alone runs the steps that read the whole tree, and checks that the shards together list every test file exactly once. Each shard keeps its own build cache and trace artifact, and `gate` still needs `suite`. `src/ci-suite-shards.test.ts` checks each of these on the parsed workflow, against a copy with that one thing broken, and runs the every-file step's own script under bash with a fake `rstest`.

Acceptance:
```bash
npx rstest run --config scripts/rstest/rstest.config.ts src/ci-suite-shards.test.ts
```

Consumer-declaration: none -- a CI workflow change and its test; no non-test file under `src/` changes, and `gate` stays the one required check.
