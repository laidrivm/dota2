# Claude Code permission tiers — what is measured, on 2.1.221

Written 2026-08-09, during `tracked-permission-policy`. Read this before
measuring permission behaviour again; it records both the conclusions and the
method that produced a wrong one first.

## The observer limitation, which governs everything below

An agent cannot see a permission prompt. A call the user approved and a call
that was never gated both come back as the same successful tool result. Only a
**refusal** is observable — it returns an error.

So a probe answered "yes" measures nothing, and "ran with no prompt" is not an
observation an agent can make. Every measurement here was taken by asking the
user to refuse.

This is what produced the wrong answer first: four probes were read as "no
prompt fired" when the prompts had fired and been approved. The conclusion
drawn from them — that the `ask` tier loads but is never consulted — reached
`main` in PRs #68 and #69 and was corrected in #70.

## Conclusions

- **`ask` is enforced.** Contrast pair, same file, same session, same
  `acceptEdits` mode: editing `PLAN.md` with no rule naming it went through
  unremarked; adding `Edit(PLAN.md)` to `permissions.ask` made the same edit
  prompt, and refusing the prompt refused the edit.
- **`deny` is enforced**, through every route tried: the `Edit` tool, the
  `Write` tool, and a Bash output redirection. `printf … > tmpprobe/.npmrc`
  was blocked while `printf … > tmpprobe/other.txt` beside it went through.
- **`ask` and `deny` load from `.claude/settings.json` and appear in
  `/permissions`**, listed under their own tabs, with no source column.
- **`/permissions` shows the union of all sources.** The tracked file, the
  untracked `settings.local.json` and user-level settings are merged in one
  list, so a count there does not match any single file.
- **`bunfig.toml` and `.npmrc` are on Claude Code's built-in protected-file
  list**, alongside `.gitconfig`, the shell rc files and `.mcp.json`. A write
  to either prompts in `acceptEdits` before any rule of this project applies.
  A rule naming them is therefore not what creates the boundary in that mode —
  it carries the boundary into modes and versions where the built-in list does
  not.

## Ruled out

Each of these was a live hypothesis, and each is dead:

- **The `ask` tier is inert on 2.1.221.** Refuted by the contrast pair above.
- **A permission mode swallowed the prompts.** `acceptEdits` auto-approves
  file edits and `mkdir`/`touch`/`rm`/`rmdir`/`mv`/`cp`/`sed` only; every
  other Bash command still prompts. Manual mode behaved the same as
  `acceptEdits` for the probes tried, because in both cases the prompts were
  appearing and being approved.
- **The project's `PreToolUse` hook auto-approved the calls.** Exit 0 from a
  `PreToolUse` hook means *no opinion*, not approval — the call continues
  through the normal permission flow. Only `hookSpecificOutput.permissionDecision`
  set to `allow` or `deny` decides anything, and `scripts/command-guard.ts`
  emits no JSON.
- **The probes were classified as read-only.** `git tag <name>` writes a ref,
  matches no rule in any tier, and prompted.
- **The rule was spelled wrongly.** `Bash(npm *)` under `deny` and
  `Bash(bun update *)` under `ask` are the same pattern shape; the first
  blocks.

## Open

- Whether an `ask` rule gates a **Bash output redirection** to the asked path.
  The `deny` half does. The `ask` half was probed once by approval, so it is
  untested — re-probe by refusing.
- Whether the local `coderabbit` CLI reaches Context7, or only the cloud
  reviews do. The docs describe cloud configuration only. Context7's dashboard
  showed 8 requests on 2026-08-02, a day with no cloud review, which suggests
  a second consumer but does not identify it.
- Whether `Bash(bunx --no-install openspec *)` in
  `.claude/settings.json:allow` is useful in a clone. `openspec` is in neither
  `package.json` nor `bun.lock`; it resolved here from a global bun binary at
  `~/.bun/bin/openspec`. A clone has no such binary, so `--no-install` would
  refuse rather than fetch — which is the safe direction, but makes the entry
  dead weight there. CodeRabbit raised this on #69 after the disposition pass
  and it is unread.

## Method that works

1. Pick an input the session has not already cleared — an approval persists
   and outlives the mode that granted it.
2. Build a contrast pair: the same action with and without the rule, in one
   session and one permission mode. Without the pair, a prompt cannot be
   attributed to the rule rather than to the mode or the protected-path list.
3. Ask the user to **refuse** each prompt, and read the tool result. An error
   means the rule fired; a success means nothing fired.
