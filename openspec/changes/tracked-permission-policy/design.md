# Design — tracked permission policy

## Context

Verified against `code.claude.com/docs/en/permissions` and the tree:

- Permission rules take the form `Tool` or `Tool(specifier)`. For files, **the
  file permission checks match `Edit(path)` and `Read(path)` only**; a
  `Write(path)`, `NotebookEdit(path)` or `Glob(path)` rule is accepted, never
  matched, and warns at startup. The docs say it outright: *Edit rules cover
  all file-editing tools*.
- Specifiers use gitignore syntax. A bare filename matches at any depth, so
  `Edit(.npmrc)` and `Edit(**/.npmrc)` are the same rule; `/path` anchors at
  the settings source, which for project settings is the repository root.
- `Tool(param:value)` matches a top-level input parameter on any tool, but the
  fields a tool already canonicalises are excluded — `command` for Bash,
  `file_path` for Read, Edit and Write, `path` for Grep and Glob. `Bash(command:
  rm *)` is called out by name as bypassable by a compound command; the
  `file_path` forms are excluded because those tools match paths with their own
  rules. Either way there is no content-matching permission rule to write.
- `.claude/settings.json` is 456 bytes: 4 deny, 14 ask, no allow.
  `.claude/settings.local.json` is 11 KB with 170 allow entries — 19 naming a
  path outside the repository or under `/tmp`, 8 a one-off `sed`/`cp`/`mv`.
- `bunfig.toml` carries `[install] exact`, `minimumReleaseAge`,
  `minimumReleaseAgeExcludes` and `[test] pathIgnorePatterns`. No `.npmrc`
  exists.
- `mechanised-prohibitions` contains no occurrence of `registry`, `bunfig` or
  `npmrc`.

## Goals / Non-Goals

**Goals:**

- Put the two supply-chain keys behind something that stops a turn.
- Make the tracked permission file the one that matters, and keep it clean.
- Add no script where two lines of configuration do.

**Non-Goals:** as listed in the proposal.

## Decisions

### Deny `.npmrc`, ask `bunfig.toml`

The rule being mechanised forbids *a registry key*, not *editing a file*, and
no permission rule can see a key — `Bash(command:…)` and its `file_path`
equivalent are explicitly ignored by Claude Code. So the choice is between a
file-scoped rule that is coarser than the prose, and a hook that reads
`tool_input`.

The two files fall on opposite sides. `.npmrc` is a registry source bun
honours — `bun install --help` on 1.3.14 lists it beside `bunfig.toml` and the
environment as what `--registry` overrides — and this repository deliberately
has none. So it is a live channel that is intentionally unused, *the file
existing* is the thing to prevent, and `deny` is exactly as coarse as the rule. `bunfig.toml` has legitimate content, so `deny` would
block the `[test]` key this project already relies on; `ask` costs a prompt on
a file that has been edited twice since it was created.

Rejected: a `PreToolUse` hook parsing `tool_input.new_string` for the actual
key syntax — `registry = "…"` under `[install]` in `bunfig.toml`, `registry=…`
in `.npmrc`, and any entry in `minimumReleaseAgeExcludes`. It is more precise
and it is a second script,
a second registration and a second thing to keep true, to save a prompt on a
file nobody edits. `mechanised-prohibitions` justified its hook by a boundary
no pattern could express at all — force-push in any argument position, a commit
conditioned on `HEAD`. This one is expressible, just bluntly.

Rejected: `Write(bunfig.toml)`. It is the form that reads naturally and the
form Claude Code never matches.

### The prompt is a boundary against the agent, not a proof

This was measured during implementation, on Claude Code 2.1.221, and neither
half answered the way this section first assumed.

The `deny` half holds. A Bash output redirection to a denied path is refused:
`printf … > tmpprobe/.npmrc` was blocked, while `printf … >
tmpprobe/other.txt` beside it went through, and neither `settings.local.json`,
the user-level settings nor `command-guard.ts` mentions `.npmrc` — so the
`Edit(.npmrc)` deny rule is what stopped it, at a subdirectory depth and in a
session that had started before the rule was written. A `Write` of `.npmrc` at
the repository root is refused the same way, which is the `Edit` specifier
covering every file-editing tool.

The `ask` half does not hold at all. Four calls matching a loaded `ask` entry —
an `Edit` of `bunfig.toml`, a `Write` of `scripts/bunfig.toml`, `bun update
--help`, and `bun pm pkg get name` — ran with no prompt, across the
`acceptEdits` and the `default` permission mode and against targets no earlier
approval in the session covered. `/permissions` lists all fifteen `ask` entries
as loaded from this file, while `deny` entries in the same object are enforced
in the same session. So the tier is registered and not consulted, and the cause
sits in Claude Code rather than in how the rule is written: the shapes match
the documented gitignore syntax, `Bash(npm *)` under `deny` and `Bash(bun
update *)` under `ask` are the same shape, and only the first one fires.

An earlier reading blamed a permission mode — `acceptEdits` answering the
prompt before the user sees it. Manual mode refutes it: the same calls pass
there too. What still passes both halves is a subprocess, which writes outside
the tool layer altogether.

So on this version the `deny` half stops what the agent actually does in an
ordinary session, which is the failure mode this repository has, and the `ask`
half stops nothing. What holds the asked file is task 1.7's content
assertions, which read `bunfig.toml` through bun's own TOML import and fail on
a wound-down age gate or an added registry key whichever route wrote it. The
rules stay because they are correctly written and cost nothing until the defect
is fixed, but the capability records the measurement rather than the intent.
That is also why the prose rule keeps its subject rather than being deleted the
way `mechanised-prohibitions` deletes what it fully replaces — the mechanism
here is partial, and both the capability and this design say so rather than
letting the entry read as a guarantee.

### Curation drops rather than promotes by default

An entry earns the tracked file by naming a command the documented workflow
runs — `bunx openspec`, `coderabbit`, `gh` reads, `bun test`. Everything else
goes: a `sed -i` against one named file was never a policy, and a path under
`/Users/…` is a fact about one laptop.

The test pins the *criterion*, not the list. Pinning 15 allow entries by name
would make every added convenience a test edit, and convenience is exactly what
an allow list is; pinning "no absolute path outside the repository, nothing
under `/tmp`" catches the failure that produced the 11 KB file in the first
place, and stays true as the list grows.

## Risks / Trade-offs

- **A prompt on every `bunfig.toml` edit, including the innocent ones.** →
  the file has changed twice since 25 July; the prompt is cheaper than the
  script that would avoid it.
- **The Bash redirection escapes the rule.** → recorded in the capability
  rather than hidden, and the prose rule stays for that reason.
- **The curated allow list gets stale as the workflow changes.** → it is
  additive convenience, so a missing entry costs a prompt and nothing else.
- **`settings.local.json` refills.** → it is untracked scratch space and
  always will; what this change protects is the tracked file, which is the one
  a clone and a reviewer see.

## Migration plan

Two groups, two pull requests on `feat/tracked-permission-policy-<step>`:

1. The two file-scoped rules and their assertions.
2. The curation and the hygiene check.

Group 1 first because it is a boundary and group 2 is housekeeping; they touch
the same file, so they are sequenced rather than parallel. Applied after
`mechanised-prohibitions`, which rewrites `deny` and adds `hooks` in that file.

## Open questions

None.
