// @ts-check
// module: what a ticket-mode worker is given -- its brief, and the settings file that holds its rules -- built as pure functions
//
// THE RULES LIVE IN A FILE, NOT ONLY IN FLAGS. herdr restores a session after its own restart as a bare `claude --resume`, which keeps none of the
// flags the pool started it with (`host-units.ts` records the shape). So the permission mode, the model and both hooks are written to the ticket
// folder's `.claude/settings.local.json`, which a resumed session reads again. The flags repeat them for the first start.
//
// THE WORKER CHOOSES THE REPOSITORY AND FINDS ITS COMMANDS. It starts in the ticket's own folder beside the person's repositories, reads the ticket,
// decides where the work lands, and makes a worktree there with `ticket:worktree`. Each repository's `CLAUDE.md`/`AGENTS.md` names how to install,
// test and typecheck it, which is where any engineer looks, so nothing about a repository is declared here or in the host file.
import type { Ticket } from "./source.ts";

/** The file a worker writes last, and the one thing the pool and the stop hook read to know a run has ended. */
export const OUTCOME_FILE = "outcome.json";
export const BRIEF_FILE = "brief.md";
/** The stop hook's count of refused stops in a row, beside the outcome file. */
export const STOP_COUNT_FILE = "stop-refusals";
/** The host file's `tickets.deny`, copied beside the outcome file, where the PreToolUse hook reads it. */
export const DENY_FILE = "deny.json";

/**
 * The brief, as markdown. `worktreeCommand` is the full command line that makes a worktree, short of the repository's name. `notes` is the host
 * file's `tickets.brief`, how workers behave on this machine.
 */
export function briefText({ ticket, folder, ticketDir, attachments, clones, worktreeCommand, notes }: {
  ticket: Ticket; folder: string; ticketDir: string; attachments: readonly string[]; clones: Readonly<Record<string, string>>; worktreeCommand: string; notes?: string;
}): string {
  const repos = Object.entries(clones).map(([name, path]) => `- \`${name}\` at \`${path}\``).join("\n");
  const files = attachments.length === 0 ? "None." : attachments.map((path) => `- \`${path}\``).join("\n");
  return `# ${ticket.key}: ${ticket.title}

You are an unattended worker. Nobody will answer a question, so decide, do the work, and end by writing the outcome file below.

## The ticket

${ticket.url}

${ticket.description.trim() || "(no description)"}

## Attachments from the ticket

${files}

## Where the work lands: you decide

You are in this ticket's own folder, \`${folder}\`. These are the repositories on this machine, checked out by the person you work for. Read them, but never commit or change branches in them:

${repos}

1. From the ticket, decide which repository the fix belongs in. A ticket may name a repository that has since been retired or moved into another one: check where the code lives now, and use that. If the fix belongs in none of these (a backend service, a plugin, another team's code), change nothing and write a \`wrong-repo\` outcome naming where it belongs.
2. Make your worktree there with \`${worktreeCommand} <repo>\`. It creates \`${folder}/<repo>\` on the ticket's branch \`${ticket.branch}\`, from the repository's default branch, and on a retry it gives you back the one an earlier run made: continue from its commits rather than starting again. Run it once per repository you change; most tickets need one.
3. Work, commit and push only inside those worktrees. Read each repository's \`CLAUDE.md\` and \`AGENTS.md\` before you change anything, and use the install, test and typecheck commands they give, scoped to the package you change.

## What to do

1. Find the cause in the code. Fix it, with a test that fails without the fix.
2. Run the repository's checks on what you changed, then run the clean-code-review skill on your diff and fix what it finds.
3. Commit with a conventional commit message.
4. Push the branch and open ONE DRAFT pull request per repository you changed: \`gh pr create --draft\`, titled \`<type>(<scope>): <what changed>\`. The body links ${ticket.url}, says what changed and how you verified it, and ends with "Screenshot pending: ticket-mode workers have no browser." A pull request that needs another repository's unmerged one says so in its body.
5. If a design gate asks for a design check, decline it with "unattended worker, no browser" and say so in the pull request body.

Never mark a pull request ready, request a review, merge, force-push, run a workflow, or post to Slack. Those are the person's.
${notes?.trim() ? `\n## On this machine\n\n${notes.trim()}\n` : ""}
## The outcome file

Write \`${ticketDir}/${OUTCOME_FILE}\` as the last thing you do, with exactly one of:

\`\`\`json
{ "kind": "draft-pr", "prs": [{ "repo": "<repo>", "url": "<pull request url>" }] }
{ "kind": "wrong-repo", "where": "<the repository or service the fix belongs in, and why>" }
{ "kind": "needs-human", "reason": "<what a person must decide or provide>" }
\`\`\`
`;
}

/** The hook command a settings file names: this tool's `ticket:hook`, by absolute path, so it runs without the tool on `PATH`. */
export type HookCommand = Readonly<{ node: string; bin: string }>;

/** The ticket folder's `.claude/settings.local.json`. `readDirs` are the person's repositories, which the worker reads but never changes. */
export function workerSettings({ model, ticketDir, readDirs, hook }: {
  model: string; ticketDir: string; readDirs: readonly string[]; hook: HookCommand;
}): Record<string, unknown> {
  const command = (event: string) => ({ type: "command", command: hook.node, args: [hook.bin, "ticket:hook", event, ticketDir], timeout: 30 });
  return {
    autoMemoryEnabled: false,
    model,
    permissions: { defaultMode: "bypassPermissions", additionalDirectories: [ticketDir, ...readDirs] },
    hooks: {
      Stop: [{ hooks: [command("stop")] }],
      PreToolUse: [{ matcher: "*", hooks: [command("pre-tool-use")] }],
    },
  };
}

/** The flags after the first prompt. `--disallowedTools` is last, so a list never swallows a flag after it (`wake.ts`'s seat flags say why). */
export function workerFlags({ name, model, effort, addDirs }: { name: string; model: string; effort: string; addDirs: readonly string[] }): string[] {
  return ["--model", model, "--effort", effort, "--name", name, ...addDirs.flatMap((dir) => ["--add-dir", dir]),
    "--dangerously-skip-permissions", "--disallowedTools", "AskUserQuestion"];
}

/** The first prompt: a pointer to the brief, short enough that no quoting or argument limit can cut it. */
export function firstPrompt(ticketDir: string): string {
  return `Read ${ticketDir}/${BRIEF_FILE} and follow it.`;
}
