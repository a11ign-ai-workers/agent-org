An overrun that released its sweep lock is the guard working: `reportSweepWindows` records it once as `sweep-window-released` (no class, no repeat), and `sweep-overrun` is written only for a claim refused on that Region after the overrun notice (B4), with the refused row as the ref.

Acceptance:

```bash
node --test src/sweep-window-overrun-kind.test.ts src/sweep-window.test.ts
```
