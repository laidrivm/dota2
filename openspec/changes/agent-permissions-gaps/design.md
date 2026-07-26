# Design — Close the gaps in the agent permission policy

## Context

`agent-permissions` was archived with PR #26. Its first local CodeRabbit review
raised three Major findings against the already-merged
`openspec/specs/agent-permissions/spec.md`, which is why they need their own
change rather than a follow-up commit on that branch.

Current state: `permissions.ask` is `["Bash(bun add *)", "Bash(bun install *)"]`,
pinned by `agent-permissions.test.ts` (4 tests) whose `ask` assertion is an
exact-equality check against those two strings.

## Goals / Non-Goals

**Goals:**

- Make the `ask` gate cover the manifest-mutating surface it claims to cover.
- Leave every requirement in the spec saying only what the repository can
  demonstrate.

**Non-Goals:**

- Denying bun's aliases, auditing the `deny` list for aliases, pinning skill
  frontmatter, editing a vendored skill — see the proposal.

## Decisions

**The policy widens; the sentence does not narrow.** The false claim in
`spec.md:65` could have been fixed from either end — drop the words "the two
bun commands that mutate the dependency manifest", or extend `ask` until the
words are true. Extending was chosen: the appositive is false because the
policy is narrow, and the narrow policy is itself the defect. `bun a preact`
writing `package.json` without a prompt is not a documentation problem.

**Every alias gets its own entry, because a pattern cannot cover them.** Claude
Code matches a permission rule against the literal command string, which is
already how this spec reasons about `deny` — the trailing-space wildcard
scenario turns on `npmlog` not matching `Bash(npm *)`. So `Bash(bun add *)`
does not reach `bun a preact`, and the list is eight entries for three
commands: `bun add`, `bun a`, `bun install`, `bun i`, `bun remove`, `bun rm`,
`bun r`, `bun uninstall`.

**The alias list comes from `bun`'s own `--help`, not from memory.** `bun
remove --help` prints `Alias: bun r`; `bun add --help` prints `Alias: bun a`;
`bun install --help` prints `Alias: bun i`. `bun rm` and `bun uninstall` both
resolve to `bun remove` while appearing in no `Alias:` line, and `bun un` is
not a command at all. CodeRabbit's finding named `bun remove`/`bun rm` and
missed `bun r`, `bun uninstall`, and the two that matter most — `bun a` and
`bun i`, which are holes in the gate rather than gaps in a sentence. The list
is verified against the installed binary, and the apply stage re-runs that
probe rather than trusting this paragraph.

**The requirement is stated as a surface, not a count.** "Exactly the two bun
commands" was falsified by an alias; "the four" would be falsified by the next
one. The requirement now names the three commands plus "each alias `bun`
documents for them", so a new alias makes the settings incomplete — a test
failure — without making the spec wrong.

**The requirement is renamed because removal is no longer an install.** *Only
bun's install commands prompt* stops describing a policy that prompts for
`bun remove`. The rename is a delta `RENAMED` entry so the archive applies it
to the main spec rather than leaving two requirements.

**The test-pinning requirement narrows instead of growing a test.** It promises
to guard "the policy above", which includes *Who may invoke a skill is enforced,
not narrated*. That half cannot be pinned from this repository:
`.claude/skills/*` are symlinks into a sibling repository, and `git ls-files
.claude/` returns only `commands/` and `settings.json`, so an assertion on a
skill's frontmatter reads a path that exists for the author and not in a clone
— the case the `CLAUDE.md` rule about tracked paths names directly. The spec
will say what the test covers and why the rest is uncovered, which is worth
more than a promise no clone can keep.

**"Every package manager other than `bun`" becomes its enumeration.** A
universal claim implemented by four strings invites a reader to trust the claim.
The requirement now states that the enumeration *is* the policy, so a manager
absent from it is visibly not denied.

## Risks / Trade-offs

- **Six new approval prompts** → all of them on commands that write
  `package.json`, which is the boundary the policy exists to hold. If the
  short aliases prove never to be used, dropping them is a two-line edit and a
  test update.
- **The alias list can go stale on a `bun` upgrade** → the requirement is
  written as a surface, so a new alias shows up as an incomplete settings file
  rather than a spec that lies. Nothing detects it automatically; the probe is
  an apply-stage task, not a CI job.
- **An exact-equality assertion on eight strings is brittle to reordering** →
  intended: the test pins the policy, and a reviewer reading a diff of that
  array is the point.
- **`bun r` is surprising** → `bun run` is the far more common `bun r*`
  command, and a user seeing a prompt for `bun r` may read it as a prompt for
  `bun run`. The prompt shows the resolved command string, so the risk is
  confusion rather than a wrong approval.

## Open Questions

None. The fork over whether to widen the policy or narrow the sentence was
settled by the user at propose time.
