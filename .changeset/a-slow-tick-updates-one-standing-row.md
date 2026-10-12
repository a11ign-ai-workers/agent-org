---
"agent-org": minor
---

A tick that overran its threshold no longer wakes a session (agent-org#1208, chairman a11ign#928): `reportIfSlow` records the tick's cost line on ONE standing row, a comment edited in place that carries the rolling 24 h table of slow ticks and the p50/p95 tick wall, and `slowTickOrders` is gone. The row is the one `units.tickRecordIssue` names in `.agent-org/project.json`, never found by title. A tick that was KILLED still wakes, unchanged (`killedTickOrders`). A write the record could not make is not silent: it is kept in `tick-record.json`, the next tick retries it, and org-health carries one `tick-record-unwritten` line (a digest class, so it rides the next order and never wakes ceo per overrun).
