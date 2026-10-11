// a11ign/a11ign#4074 (token efficiency v2, #4055 move 8, FIRST STEP ONLY): a SEEDED, reproducible draw of manager wakes for a human to label `wake`, `digest` or `drop`.
//
// A PURE FUNCTION over the store's events (`drawTriageSample`): it opens no file, calls no `gh` and no model. The labelling belongs to `product-manager` and is posted on the row; nothing
// here decides what a wake is worth, and nothing here checks a model's alias or changes an effort.
//
// STRATIFIED BY CAUSE, because a plain draw from ~2,300 wakes is mostly the two or three causes that fire all day, and a labeller who never meets a rare cause cannot say whether a model
// triaged it. Every cause with at least one wake in the window gets one place; the remaining places are shared out in proportion to each cause's wakes; a cause with fewer wakes than its
// share contributes ALL of them and the places it cannot use go to the others (water-filling). A window with more causes than places is REFUSED: a sample that silently dropped a cause would
// read as a sample of every cause.
//
// WHAT THE LABELLER SEES is four facts and a number: cause, causeKey, session and the wake's cost. The store holds no order text, so there is none to show. Everything else on a wake is
// left out on purpose: `bytes` and `deliveryLagMs` hint at how big or how late an order was, `at` and the wake id carry the time, and the draw's own stratum sizes would say how common a
// cause is. The rows are shown in a seeded SHUFFLE, so their position says nothing about their cause. The wake id is kept on the row (`wakeId`) so a posted label can be joined back; the
// printed sheet does not show it.
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readStore } from "./store.ts";
import type { TraceEvent } from "./store.ts";

/** The three managers the row names: the seats whose wakes #4055 move 8 would route through a small model. */
export const MANAGERS = ["ceo", "product-manager", "orchestrator"];
export const DEFAULT_SIZE = 100;
/** A wake whose ledger line named no cause is its own stratum and never dropped. */
export const NO_CAUSE = "(no cause)";
const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;
const UINT32 = 2 ** 32;
const SEED_BYTES = 4;
const COST_DECIMALS = 4;

/** What a wake's cost is. A wake with no turn is `no turn`, never free; one with an unpriced turn is a FLOOR. */
export const COST = Object.freeze({ PRICED: "priced", FLOOR: "floor (a turn has no price)", UNPRICED: "not priced", NO_TURN: "no turn" });
/** The only keys a printed row carries (see the header). `wakeId` is on the drawn row beside these and is not printed. */
export const SHOWN = Object.freeze(["n", "cause", "causeKey", "session", "cost"]);
export const LABELS = Object.freeze(["wake", "digest", "drop"]);

/**
 * A small deterministic generator (mulberry32), seeded from a hash so that any string is a seed and a seed of `4074` and one of `4075` are unrelated streams.
 * @returns uniform in [0, 1)
 */
function generatorFor(seed: string): () => number {
  let state = createHash("sha256").update(seed).digest().readUIntBE(0, SEED_BYTES);
  return () => {
    state = (state + 0x6d2b79f5) % UINT32;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return (((mixed ^ (mixed >>> 14)) >>> 0)) / UINT32;
  };
}

/**
 * A seeded shuffle that does not depend on the order the input arrived in: the items are sorted by `keyOf` first, so a store read in another order draws the same.
 */
function shuffled<T>(items: T[], seed: string, keyOf: (item: T) => string): T[] {
  const next = generatorFor(seed);
  const out = items.toSorted((a, b) => byText(keyOf(a), keyOf(b)));
  for (let last = out.length - 1; last > 0; last--) {
    const swap = Math.floor(next() * (last + 1));
    [out[last], out[swap]] = [out[swap], out[last]];
  }
  return out;
}

/** Plain code-unit order, because `localeCompare` follows the machine's locale and a draw must not. */
const byText = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const causeOf = (wake: TraceEvent): string => wake.cause ?? NO_CAUSE;

/**
 * Places per stratum. One each first (so every cause appears), then the rest in proportion to the wakes, WATER-FILLED: a stratum whose proportional share exceeds what it has left is
 * given all it has, and the places it leaves over are re-shared among the others. The last places go by largest remainder, ties by cause name, so the result is a function of the counts.
 * @param counts wakes per cause
 */
export function allocate(counts: Map<string, number>, size: number): Map<string, number> {
  const wakesOf = (cause: string) => counts.get(cause) ?? 0;
  const quota = new Map([...counts.keys()].map((cause) => [cause, 1]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total <= size) return new Map(counts);
  let open = [...counts.keys()];
  let spare = size - counts.size;
  for (let capped = true; capped && open.length > 0;) {
    const weight = open.reduce((sum, cause) => sum + wakesOf(cause), 0);
    const full = open.filter((cause) => (wakesOf(cause) - 1) <= (spare * wakesOf(cause)) / weight);
    capped = full.length > 0;
    for (const cause of full) {
      spare -= wakesOf(cause) - 1;
      quota.set(cause, wakesOf(cause));
    }
    open = open.filter((cause) => !full.includes(cause));
  }
  return shareRemainder({ quota, counts, open, spare });
}

/** The last step of `allocate`: floor each open stratum's proportional share, then hand the leftover places to the largest remainders. */
function shareRemainder({ quota, counts, open, spare }: { quota: Map<string, number>; counts: Map<string, number>; open: string[]; spare: number; }) {
  const wakesOf = (cause: string) => counts.get(cause) ?? 0;
  const placed = (cause: string) => quota.get(cause) ?? 0;
  const weight = open.reduce((sum, cause) => sum + wakesOf(cause), 0);
  const shares = open.map((cause) => ({ cause, ideal: (spare * wakesOf(cause)) / weight }));
  for (const { cause, ideal } of shares) quota.set(cause, placed(cause) + Math.floor(ideal));
  const left = spare - shares.reduce((sum, { ideal }) => sum + Math.floor(ideal), 0);
  const byRemainder = shares.toSorted((a, b) => (b.ideal - Math.floor(b.ideal)) - (a.ideal - Math.floor(a.ideal)) || byText(a.cause, b.cause));
  for (const { cause } of byRemainder.slice(0, left)) quota.set(cause, placed(cause) + 1);
  return quota;
}

/**
 * The cost of one wake: every turn of the wake's own session that carries its id, sidechains included (a subagent's turn is the wake's spend), summed.
 * @param turnsOf by wake id
 */
function costOf(wake: TraceEvent, turnsOf: Map<string, TraceEvent[]>): { usd: number | null; state: string; turns: number; } {
  const turns = (turnsOf.get(wake.id) ?? []).filter((turn) => turn.session === wake.session);
  if (turns.length === 0) return { usd: null, state: COST.NO_TURN, turns: 0 };
  const priced = turns.filter((turn) => typeof turn.costUsd === "number");
  if (priced.length === 0) return { usd: null, state: COST.UNPRICED, turns: turns.length };
  const usd = Number(priced.reduce((sum, turn) => sum + (turn.costUsd as number), 0).toFixed(COST_DECIMALS));
  return { usd, state: priced.length === turns.length ? COST.PRICED : COST.FLOOR, turns: turns.length };
}

/** @returns turns by the wake id they carry */
function turnsByWake(events: TraceEvent[]): Map<string, TraceEvent[]> {
  const byWake: Map<string, TraceEvent[]> = new Map();
  for (const event of events) {
    if (event.kind !== "turn" || !event.wakeId) continue;
    byWake.set(event.wakeId, [...(byWake.get(event.wakeId) ?? []), event]);
  }
  return byWake;
}

/** @returns the manager wakes with `from <= at < to`, once per id */
function managerWakes(events: TraceEvent[], { from, to, sessions }: { from: number; to: number; sessions: string[]; }): TraceEvent[] {
  const wakes = events.filter((event) => event.kind === "wake" && sessions.includes(event.session) && event.at >= from && event.at < to);
  return [...new Map(wakes.map((wake) => [wake.id, wake])).values()];
}

function strataOf(wakes: TraceEvent[]): Map<string, TraceEvent[]> {
  const strata: Map<string, TraceEvent[]> = new Map();
  for (const wake of wakes) strata.set(causeOf(wake), [...(strata.get(causeOf(wake)) ?? []), wake]);
  return strata;
}

function checked({ events, seed, size = DEFAULT_SIZE, from, to, sessions = MANAGERS, causes = [] }: { events: TraceEvent[]; seed: string; size?: number; from: number; to: number; sessions?: string[]; causes?: string[]; }) {
  if (typeof seed !== "string" || seed === "") throw new Error("a seed is required: an unseeded draw cannot be reproduced");
  if (!Number.isInteger(size) || size < 1) throw new Error(`size must be a positive integer, got ${size}`);
  if (!(from < to)) throw new Error("the window is empty: `from` must be before `to`");
  const inWindow = managerWakes(events, { from, to, sessions });
  if (inWindow.length === 0) throw new Error("no manager wake in the window: there is nothing to draw, and an empty sample is not a sample of zero causes");
  const wakes = restrictedTo(inWindow, causes);
  const strata = strataOf(wakes);
  if (strata.size > size) throw new Error(`${strata.size} causes in the window and only ${size} places: a sample cannot show every cause`);
  return { strata, size, seed, population: wakes.length };
}

/**
 * @returns the wakes of the named causes, or all of them when none is named. A name no wake in the window carries is REFUSED: a typo would draw nothing, and an empty draw reads as a pass.
 */
function restrictedTo(wakes: TraceEvent[], causes: string[]): TraceEvent[] {
  const unknown = causes.filter((cause) => !wakes.some((wake) => causeOf(wake) === cause));
  if (unknown.length > 0) throw new Error(`no manager wake in the window has cause ${unknown.join(", ")}: a typo would draw nothing`);
  return causes.length === 0 ? wakes : wakes.filter((wake) => causes.includes(causeOf(wake)));
}

/**
 * Draw the sample.
 * @param input `from` inclusive, `to` exclusive, epoch ms
 */
export function drawTriageSample(input: { events: TraceEvent[]; seed: string; size?: number; from: number; to: number; sessions?: string[]; causes?: string[]; }): { rows: Array<{ wakeId: string; n: number; cause: string; causeKey: string | null; session: string; cost: { usd: number | null; state: string; turns: number; }; }>; strata: Array<{ cause: string; wakes: number; drawn: number; }>; population: number; causes: string[]; } {
  const { strata, size, seed, population } = checked(input);
  const turnsOf = turnsByWake(input.events);
  const counts = new Map([...strata].map(([cause, wakes]) => [cause, wakes.length]));
  const quota = allocate(counts, size);
  const drawn = [...strata].flatMap(([cause, wakes]) => shuffled(wakes, `${seed}\t${cause}`, (wake) => wake.id).slice(0, quota.get(cause)));
  const rows = shuffled(drawn, `${seed}\torder`, (wake) => wake.id).map((wake, index) => ({
    wakeId: wake.id, n: index + 1, cause: causeOf(wake), causeKey: wake.causeKey, session: wake.session, cost: costOf(wake, turnsOf),
  }));
  const strataReport = [...strata].map(([cause, wakes]) => ({ cause, wakes: wakes.length, drawn: quota.get(cause) ?? 0 })).sort((a, b) => b.wakes - a.wakes || byText(a.cause, b.cause));
  return { rows, strata: strataReport, population, causes: input.causes ?? [] };
}

function costText({ usd, state }: { usd: number | null; state: string; }): string {
  if (usd === null) return state;
  return state === COST.PRICED ? `$${usd.toFixed(COST_DECIMALS)}` : `>= $${usd.toFixed(COST_DECIMALS)} (${state})`;
}

/**
 * The sheet a human labels: one line per wake, a blank for the label, and nothing but the `SHOWN` facts. The strata sizes are NOT on it (they are in `renderProvenance`, for whoever
 * posts it), so the labeller is not told how common a cause is.
 */
export function renderSheet(sample: ReturnType<typeof drawTriageSample>): string {
  const header = `label each wake as one of: ${LABELS.join(" | ")}\n`;
  const lines = sample.rows.map((row) => `${String(row.n).padStart(3)}. [   ]  ${row.session}  ${row.cause}  ${row.causeKey ?? "(no ledger line)"}  cost ${costText(row.cost)}`);
  return `${header}${lines.join("\n")}\n`;
}

/**
 * How the draw was made, to go beside the sheet: the command's inputs and each cause's wakes and places. Kept apart from the sheet on purpose.
 */
export function renderProvenance(sample: ReturnType<typeof drawTriageSample>, { seed, from, to }: { seed: string; from: number; to: number; }): string {
  const lines = sample.strata.map((one) => `  ${one.cause}: ${one.drawn} of ${one.wakes}`);
  const scope = sample.causes.length === 0 ? "manager wakes" : `manager wakes of cause ${sample.causes.join(", ")}`;
  return [
    `seed ${seed}, window ${new Date(from).toISOString()} to ${new Date(to).toISOString()} (from inclusive, to exclusive), ${sample.rows.length} drawn of ${sample.population} ${scope} (MEASURED from the store).`,
    "stratified by cause: one place each, the rest in proportion, a cause with fewer wakes than its share contributes all of them.",
    ...lines,
  ].join("\n");
}

// ---- a11ign/a11ign#4183: score a small model's triage against #4074's hand labels. Routes nothing, and never draws: it reads the FROZEN fixture, because the sample is deterministic only for an unchanged store.
//
// THE BAR IS DECLARED HERE, BEFORE ANY RUN, so a result cannot be argued into it: a cause class is a `candidate` for a small model when it has at least `BAR.minRows` labelled READABLE rows and the
// model missed none of its `wake` rows. The error that matters is a MISSED wake (labelled `wake`, predicted `digest` or `drop`): that is an order nobody acts on, where an over-wake costs a turn.
// With n this small a pass is a `candidate`, never proved, and a switch is a separate row and `ceo`'s. A class with NO wake row passes the second half vacuously; its verdict says so.
//
// THE SIX UNREADABLE ROWS (`excluded`: no ledger line, so no cause) were labelled `wake` so that an event nobody can read is not dropped. They are evidence of nothing, so every figure is given WITH and WITHOUT them,
// and they belong to no cause class. THE SAMPLE IS STRATIFIED, not proportional: the label shares are not the population's, and nothing here scales them up or prices anything.
export const BAR = Object.freeze({ minRows: 5, minWakeRows: 0 });
/**
 * The bar for the week-2 sheet (a11ign#4187), declared on that row BEFORE its sample was drawn: a class passes only with 20 labelled `wake` rows and no missed wake.
 * Under 20 is "not testable this window", a result and not a failure. `--labels` selects it; the frozen #4074 sheet keeps `BAR`, which its tests pin.
 */
export const WEEK2_BAR = Object.freeze({ minRows: 0, minWakeRows: 20 });
type Bar = Readonly<{ minRows: number; minWakeRows: number; }>;
const LABELS_FILE = new URL("./triage-labels-4074.json", import.meta.url);
const PERCENT = 100;
const PERCENT_DECIMALS = 1;

type LabelRow = { position: number; session: string; cause: string; causeKey: string; cost: string; label: string; excluded: boolean };
type Figures = { n: number; agree: number; confusion: Record<string, Record<string, number>>; missedWakes: number[] };

/**
 * @returns a labelled sheet, the frozen #4074 one by default. REFUSED unless it is whole: a score over a duplicated position, or a row no cause can explain, reads as a score over the sample.
 */
export function loadLabels(file: string | URL = LABELS_FILE): { definitions: Record<string, string>; rows: LabelRow[]; } {
  const sheet = JSON.parse(readFileSync(file, "utf8"));
  if (!sheet?.definitions || !Array.isArray(sheet.rows)) throw new Error(`${file} is not a labelled sheet: it needs "definitions" and "rows"`);
  const positions = new Set<number>();
  for (const row of sheet.rows) {
    if (positions.has(row.position)) throw new Error(`position ${row.position} is labelled twice`);
    positions.add(row.position);
    if (!LABELS.includes(row.label)) throw new Error(`position ${row.position}: label ${JSON.stringify(row.label)} is not one of ${LABELS.join(" | ")}`);
    if (typeof row.cause !== "string" || row.cause === "") throw new Error(`position ${row.position} names no cause: an unreadable row is "${NO_CAUSE}", never blank`);
  }
  return sheet;
}

/**
 * What the model is shown: the three label definitions and the printed columns of every row, in the sheet's order. Exactly what the labeller had, so a disagreement is not explained by information
 * the labeller lacked: no order text, no state, no label, no `excluded` mark.
 */
export function renderPrompt({ definitions, rows }: { definitions: Record<string, string>; rows: LabelRow[]; }): string {
  const rules = LABELS.map((label) => `- ${label}: ${definitions[label]}`).join("\n");
  const lines = rows.map((row) => `${String(row.position).padStart(3)}.  ${row.session}  ${row.cause}  ${row.causeKey}  cost ${row.cost}`);
  return [
    `Each line below is one wake of a manager seat in an agent organisation: position, session, cause, cause key, and what the wake cost. Label each wake as one of: ${LABELS.join(" | ")}.`,
    rules,
    `Answer with ONLY a JSON array of ${rows.length} objects, one per line below and in order, like [{"position": 1, "label": "wake"}]. No other text.`,
    "", ...lines, "",
  ].join("\n");
}

/**
 * Refuse what cannot be scored honestly: a score over a partial or duplicated file reads as a score over the sample.
 * @returns the predicted label by position
 */
function predictedBy(rows: LabelRow[], predictions: unknown): Map<number, string> {
  if (!Array.isArray(predictions)) throw new Error("predictions must be a JSON array of { position, label }");
  if (predictions.length !== rows.length) throw new Error(`${predictions.length} predictions for ${rows.length} rows: a partial file is not scored`);
  const known = new Set(rows.map((row) => row.position));
  const predicted = new Map();
  for (const entry of predictions) {
    if (!known.has(entry?.position)) throw new Error(`position ${entry?.position} is not a row of the sheet`);
    if (predicted.has(entry.position)) throw new Error(`position ${entry.position} is predicted twice`);
    if (!LABELS.includes(entry.label)) throw new Error(`position ${entry.position}: label ${JSON.stringify(entry.label)} is not one of ${LABELS.join(" | ")}`);
    predicted.set(entry.position, entry.label);
  }
  return predicted;
}

function figuresOf(rows: LabelRow[], predicted: Map<number, string>): Figures {
  const confusion = Object.fromEntries(LABELS.map((label) => [label, Object.fromEntries(LABELS.map((guess) => [guess, 0]))]));
  for (const row of rows) confusion[row.label][predicted.get(row.position) as string] += 1;
  const missedWakes = rows.filter((row) => row.label === "wake" && predicted.get(row.position) !== "wake").map((row) => row.position);
  return { n: rows.length, agree: LABELS.reduce((sum, label) => sum + confusion[label][label], 0), confusion, missedWakes };
}

/** @returns the declared bar, applied: a missed wake fails whatever the count; a class too small to read is "not testable", not a failure */
function barFor({ n, wakeRows, missed }: { n: number; wakeRows: number; missed: number; }, bar: Bar): { passed: boolean; verdict: string; } {
  if (missed > 0) return { passed: false, verdict: "fail: missed a wake" };
  if (n < bar.minRows) return { passed: false, verdict: `fail: fewer than ${bar.minRows} readable rows` };
  if (wakeRows < bar.minWakeRows) return { passed: false, verdict: `not testable this window: ${wakeRows} wake rows, need ${bar.minWakeRows}` };
  return { passed: true, verdict: wakeRows === 0 ? "candidate (no wake row in the class: the no-miss half is untested)" : "candidate" };
}

function classesOf(readable: LabelRow[], predicted: Map<number, string>, bar: Bar) {
  const byCause: Map<string, LabelRow[]> = new Map();
  for (const row of readable) byCause.set(row.cause, [...(byCause.get(row.cause) ?? []), row]);
  return [...byCause].map(([cause, rows]) => {
    const missedWakes = figuresOf(rows, predicted).missedWakes;
    const wakeRows = rows.filter((row) => row.label === "wake").length;
    return { cause, n: rows.length, wakeRows, missedWakes, bar: barFor({ n: rows.length, wakeRows, missed: missedWakes.length }, bar) };
  }).sort((a, b) => b.n - a.n || byText(a.cause, b.cause));
}

/**
 * Score predictions against the labels.
 * @param labels the rows @param predictions `[{ position, label }]`, one per row @param bar the bar the classes are read against
 */
export function scoreTriage(labels: LabelRow[], predictions: unknown, bar: Bar = BAR) {
  const predicted = predictedBy(labels, predictions);
  const readable = labels.filter((row) => !row.excluded);
  const excluded = labels.filter((row) => row.excluded);
  return {
    withExcluded: figuresOf(labels, predicted),
    withoutExcluded: figuresOf(readable, predicted),
    excluded: { positions: excluded.map((row) => row.position), predicted: excluded.map((row) => ({ position: row.position, label: row.label, predicted: predicted.get(row.position) })) },
    classes: classesOf(readable, predicted, bar),
    bar,
  };
}

/** @returns the bar in words, as the printed score states it */
function describeBar(bar: Bar): string {
  const parts = [bar.minRows > 0 ? `${bar.minRows} readable rows` : null, bar.minWakeRows > 0 ? `${bar.minWakeRows} wake rows` : null].filter((part) => part !== null);
  return `>= ${parts.join(" and >= ")} and no missed wake`;
}

const percent = (part: number, whole: number): string => `${((PERCENT * part) / whole).toFixed(PERCENT_DECIMALS)}%`;

function figureLines(title: string, { n, agree, confusion, missedWakes }: Figures): string[] {
  const rows = LABELS.map((label) => `  labelled ${label.padEnd("digest".length)} -> ${LABELS.map((guess) => `${guess} ${String(confusion[label][guess]).padStart(2)}`).join("  ")}`);
  return [`${title}: n ${n}, agreement ${agree}/${n} (${percent(agree, n)}), missed wakes ${missedWakes.length}${missedWakes.length > 0 ? ` (positions ${missedWakes.join(", ")})` : ""}`, ...rows];
}

export function renderScore(score: ReturnType<typeof scoreTriage>): string {
  const classes = score.classes.map((one) => `  ${one.cause.padEnd(Math.max(...score.classes.map((c) => c.cause.length)))}  n ${String(one.n).padStart(2)}  wake rows ${String(one.wakeRows).padStart(2)}  missed ${one.missedWakes.length}  ${one.bar.verdict}`);
  const apart = score.excluded.predicted.map((one) => `  ${one.position}: labelled ${one.label}, predicted ${one.predicted}`);
  return [
    ...figureLines("WITH the six unreadable rows", score.withExcluded),
    ...figureLines("WITHOUT them (the figure to read)", score.withoutExcluded),
    "",
    `the six unreadable rows, apart (positions ${score.excluded.positions.join(", ")}):`, ...apart,
    "",
    `the bar, per cause class (${describeBar(score.bar)}; a pass is a candidate, never proved):`, ...classes, "",
  ].join("\n");
}

/** Flags that take no value; every other flag takes the next argument, and `--cause` may repeat */
const SWITCHES = new Set(["json", "prompt"]);

export type Args = {
  seed: string; size: number; from: number; to: number; store: string; json: boolean;
  score: string | null; labels: string | null; causes: string[]; prompt: boolean;
};

export function parseArgs(argv: string[]): Args {
  const flags = new Map<string, string>();
  const causes: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) throw new Error(`unexpected argument ${flag}`);
    const name = flag.slice(2);
    if (SWITCHES.has(name)) flags.set(name, "true");
    else if (name === "cause") causes.push(argv[++i] ?? "");
    else flags.set(name, argv[++i]);
  }
  const to = flags.has("to") ? Date.parse(flags.get("to") ?? "") : Date.now();
  const from = flags.has("from") ? Date.parse(flags.get("from") ?? "") : to - WEEK_DAYS * MS_PER_DAY;
  if (Number.isNaN(to) || Number.isNaN(from)) throw new Error("--from and --to take an ISO time, e.g. 2026-10-01T08:40:00Z");
  if (flags.has("score") && !flags.get("score")) throw new Error("--score takes a predictions file");
  if (flags.has("labels") && !flags.get("labels")) throw new Error("--labels takes a labels file");
  if (causes.some((cause) => cause === "")) throw new Error("--cause takes a cause class name");
  if (flags.has("labels") && !flags.has("score")) throw new Error("--labels reads the labels a score is read against: it needs --score");
  if (causes.length > 0 && flags.has("score")) throw new Error("--cause restricts the draw: it has no meaning with --score");
  return {
    seed: flags.get("seed") ?? "", size: flags.has("size") ? Number(flags.get("size")) : DEFAULT_SIZE, from, to,
    store: flags.get("store") ?? join(homedir(), ".cache", "a11ign", "trace", "events.ndjson"), json: flags.has("json"),
    score: flags.get("score") ?? null, labels: flags.get("labels") ?? null, causes, prompt: flags.has("prompt"),
  };
}

/** @returns the sampler's output: it is the only mode that reads the store */
function sampled(args: Args): string {
  const sample = drawTriageSample({ events: readStore(args.store), seed: args.seed, size: args.size, from: args.from, to: args.to, causes: args.causes });
  return args.json ? `${JSON.stringify(sample, null, 2)}\n` : `${renderProvenance(sample, args)}\n\n${renderSheet(sample)}`;
}

/**
 * @returns the score of a predictions file. With no `--labels` it reads the frozen #4074 sheet against `BAR`; with `--labels` it reads that
 * sheet against `WEEK2_BAR`. Either way it never reads the store and never draws.
 */
function scored({ predictionsPath, labelsPath, json }: { predictionsPath: string; labelsPath: string | null; json: boolean; }): string {
  const bar = labelsPath === null ? BAR : WEEK2_BAR;
  const result = scoreTriage(loadLabels(labelsPath ?? undefined).rows, JSON.parse(readFileSync(predictionsPath, "utf8")), bar);
  return json ? `${JSON.stringify(result, null, 2)}\n` : renderScore(result);
}

const USAGE = `usage: node src/trace/triage-sample.ts --seed <text> [--size 100] [--from <iso>] [--to <iso>] [--store <path>] [--cause <class>]... [--json]
       node src/trace/triage-sample.ts --score <predictions.json> [--labels <labels.json>] [--json]   (no --labels: the frozen #4074 sheet; never draws)
       node src/trace/triage-sample.ts --prompt   (what a model is shown)
`;

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.prompt) process.stdout.write(renderPrompt(loadLabels()));
    else process.stdout.write(args.score === null ? sampled(args) : scored({ predictionsPath: args.score, labelsPath: args.labels, json: args.json }));
  } catch (error) {
    process.stderr.write(`triage-sample: ${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) await main();
