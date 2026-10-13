`ci.yml`'s `suite` job runs as four shards at once (a `shard` matrix and rstest's `--shard`), shard 1 alone runs the steps that read the whole tree, and shard 1 checks that the shards together list every test file exactly once.

Acceptance:
```bash
bash -c 'grep -qE "^        shard: \[1, 2, 3, 4\]$" .github/workflows/ci.yml && grep -qF -- "--shard \${{ matrix.shard }}/\${{ strategy.job-total }}" .github/workflows/ci.yml'
```

Consumer-declaration: none -- a CI workflow change; no file under `src/` changes, and `gate` stays the one required check.
