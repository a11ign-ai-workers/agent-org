The engineer route is ONE choice put to Jev, accepted with uneven thresholds, instead of four questions composed by hand thresholds; a project's `routing` block selects it, and an absent block routes exactly as before (a11ign#4904).

Closes a11ign#4904

## What changes, and why

- **One `choice` question decides the route** (`question: "choice"`): "the cheapest route that finishes this row in one pass, with no move up to a stronger route". Its options are the project's configured routes (`haiku/high`, `sonnet/medium`, `sonnet/high`), each with `what`, `signals`, `not_for` and 2-3 examples that are rows of ours whose merge is known (`ROUTE_DATA`). The four questions stay in the SAME call, are still logged for `route-accuracy` and still size the window, and no longer decide.
- **Uneven acceptance (`acceptPick`, pure).** A pick CHEAPER than the deterministic fallback stands at P >= `cheaperMinP` (0.5); a DEARER one needs P >= `dearerMinP` (0.7), because a wrong cheap start costs one move up (#4630) and a wrong dear one costs the row's whole price. A pick that is the fallback stands. Anything else (under threshold, off-list, no distribution, a failed call, no provider) is the fallback unchanged: the file-count rule, never Haiku. A Haiku pick the Haiku switch or its refusals hold is the fallback, not Sonnet/high.
- **Labels override Jev.** `tier:haiku` is now `tier:<model>-<effort>` for any configured route (`tier:sonnet-medium`, `tier:sonnet-high`), `tier:haiku` still works; two labels give the dearer. A row nothing may lower (lane:ceo, needs:chairman, workflows Region, no command Acceptance) is never lowered by a label and never asked.
- **The project declaration carries it** (`project-config.ts`, optional `routing` block): `question` (`choice`|`traits`), `routes`, `guidance`, `cheaperMinP`, `dearerMinP`. Absent reads as `ABSENT_ROUTING` (all three routes, `traits`), which is today's behaviour byte for byte. Validated at load: an unknown route, a duplicate, a fallback route left out, an unknown key, a bad `question`, a threshold outside (0, 1] and guidance for an unconfigured route are each REFUSED naming the field.
- **The decision line keeps everything a replay needs.** The outcome line ends with `[pick <route|none>; ran <route>; because <jev|low-confidence|invalid-option|override|refused|fallback>; P <route>=<p> ...|not given; <n>ms]`, before `[fallback would be X]`, which `routeCostReading` anchors on and which only a provider-decided route carries. `pickedOf` is the one reader of the bracket. The request line already carries every route's probability as the provider gave it.
- **Not in this change:** `wake.ts`, `decision-provider.ts` and a11ign's own `.agent-org/project.json` (see below).

## How you verified it

Run with `AGENT_ORG_HOST` set to a checkout holding `.agent-org/project.json` (this worktree has none; without it every test file refuses to load, as it did before this change). `--config scripts/rstest/rstest.config.ts` is the package's own `test` script's.

Done-when 1, each with a mutation (below): Haiku at P=0.55 over a Sonnet/medium fallback routes Haiku, 0.45 does not; Sonnet/high at 0.6 over a Sonnet/medium fallback takes the fallback, 0.69 does too, 0.7 is taken; an off-list answer is the fallback with `invalid-option`; no provider leaves the fallback unchanged and asks zero times; `tier:sonnet-high` beats Jev; a refused row carrying `tier:sonnet-medium`, `tier:sonnet-high` or `tier:haiku` stays Sonnet/high and is not asked; a config naming an unknown route, or leaving a fallback route out, is refused at load; `traits` mode and an absent block give identical routes and lines, and send no route question. Done-when 2: the line carries all of point 5 and `pickedOf` reads it back.

Acceptance: `bash -c 'cd ~/repos/agent-org && npx rstest run --config scripts/rstest/rstest.config.ts src/engineer-route.test.ts src/project-config.test.ts'`

Mutation: fourteen mutants, each killed by named tests, sources restored with `cp` and `diff`ed identical. engineer-route.ts: cheaper pick read against the dearer threshold (3 fail), dearer read against the cheaper (3), threshold `<=` for `<` (3), off-list answer taken as the pick (3), Sonnet labels ignored (3), a refused row lowered by a label (1), `traits` ignoring the config (26), `choice` ignoring the config (9), duration always 0 (1), labels never consulted before the provider (7). project-config.ts: fallback reachability unchecked (1), unknown route accepted (1), unknown key ignored (1), an absent block reading as `choice` (2).

## One-off replay: the new question over the last 100 routed rows

Read-only against `~/.cache/a11ign/decisions` (the last 100 distinct `row-N` with a route line, 2026-10-10), rows read from a11ign/a11ign, the question put to the live provider with a temporary log, so `route-accuracy`'s record was not touched. **Evidence only; it does not gate the merge.**

- **Cost:** 90 provider calls (10 rows were refused or labelled and never asked): 301,770 input and 13,512 output tokens, 3,353 and 150 per call, about 224 ms median per row (p90 248 ms, max 408 ms). A price per token is not established here, so no dollar figure is quoted.
- **Share by route, the rule that ran at the time versus the new question:**

  | route | ran then | new question |
  |---|---|---|
  | `haiku/high` | 4 | 41 |
  | `sonnet/medium` | 16 | 20 |
  | `sonnet/high` | 80 | 39 |

  74 routes were the provider's pick taken, 16 were the fallback (every one of them `low-confidence`: 5 Haiku picks under 0.5, 11 Sonnet/high picks under 0.7; none `invalid-option`), 9 were refused rows and 1 a label. Moved: 23 Sonnet/high to Haiku, 14 Sonnet/medium to Haiku, 18 Sonnet/high to Sonnet/medium; none went up.
- **Every row it sends to Haiku (41; `*` = also Haiku then):** #4735, #4793, #4730, #4799, #4547*, #4787, #4816, #4817, #4804, #4801, #4810*, #4832, #4833, #4840, #4843, #4844, #4845, #4846, #4847, #4849, #4850*, #4852, #4851, #4552, #4854, #4863, #4866, #4867, #4858, #4869, #3870*, #4689, #4877, #4690, #4765, #4882, #4623, #4874, #4880, #4871, #4902.

## Anything a reviewer should be sceptical of

- **The Haiku share goes from 4 to 41 of 100.** Haiku's first-pass rate of 100% on 16 rows came from rows the OLD rule sent it, which were the mechanical ones; the replay sends it kinds of row it has not been measured on, among them failure-class rows ("make its guard stop it everywhere": #4833, #4623, #4871) and VERIFY rows (#4730, #4765, #4880, #4882). The instruction asks for no move up and a cheap pick needs only 0.5. The thresholds are config values and every decision line keeps the whole distribution, so they can be re-tuned by replay; the live evidence is the separate verify row 24 h after merge, not this one.
- **The replay is of the question, not of outcomes.** It says what would be routed, not that it would have finished; the rows' merged results were not read.
- **The change is live only where a declaration says `choice`.** a11ign's `.agent-org/project.json` is in another repository and outside this row's Region, so this PR does not set it: until `"routing": {"question": "choice"}` lands there, a11ign routes by `traits` as before. Reverting is that one line.
- **`wake.ts` is untouched**: `routeEngineer` reads the home declaration itself (`routingOf`) when the caller passes none, and a declaration it cannot read routes as before and prints why.
- **Window sizing still reads the four answers** in `choice` mode; they are asked in the same call and kept for exactly that and for `route-accuracy`.
