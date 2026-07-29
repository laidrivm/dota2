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
- `Bash(command:…)` and the equivalent parameter form for `file_path` are
  ignored with a startup warning, because a compound command would bypass
  them. So there is no way to write a content-matching permission rule.
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

The two files fall on opposite sides. `.npmrc` has no legitimate content here
at all: bun reads `bunfig.toml`, nothing in this repository references an
`.npmrc`, so *the file existing* is the thing to prevent and `deny` is exactly
as coarse as the rule. `bunfig.toml` has legitimate content, so `deny` would
block the `[test]` key this project already relies on; `ask` costs a prompt on
a file that has been edited twice since it was created.

Rejected: a `PreToolUse` hook parsing `tool_input.new_string` for `registry:`
and `minimumReleaseAgeExcludes`. It is more precise and it is a second script,
a second registration and a second thing to keep true, to save a prompt on a
file nobody edits. `mechanised-prohibitions` justified its hook by a boundary
no pattern could express at all — force-push in any argument position, a commit
conditioned on `HEAD`. This one is expressible, just bluntly.

Rejected: `Write(bunfig.toml)`. It is the form that reads naturally and the
form Claude Code never matches.

### The prompt is a boundary against the agent, not a proof

`echo 'registry = …' >> bunfig.toml` is a Bash call, not an `Edit`, and no
`Bash(...)` pattern catches a redirection reliably. So the rule stops the path
the agent actually takes and not every path that exists. That is why the prose
rule keeps its subject rather than being deleted the way
`mechanised-prohibitions` deletes what it fully replaces — the mechanism here
is partial, and its own capability says so.

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
