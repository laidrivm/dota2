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
scenario turns on `npmlog` not matching `Bash(npm *)`. `Bash(bun add *)`
does not reach `bun a preact`, so the install family alone is eight entries
for three commands: `bun add`, `bun a`, `bun install`, `bun i`, `bun remove`,
`bun rm`, `bun r`, `bun uninstall`. Six more cover the commands outside that
family: `bun update`, `bun patch`, `bun patch-commit`, `bun pm pkg`,
`bun pm version`, `bun pm trust`.

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
one, and "the eight" was — see below. The requirement now describes what
changes the dependency record and enumerates beneath it, so a newly discovered
form makes the settings incomplete — a test failure — without making the spec
wrong.

**The surface is wider than the install family, found by the gate reviewing its
own branch.** CodeRabbit's local review objected that `bun install` writes the
lockfile rather than `package.json`, and that the real manifest writers were
missing. Probed against bun 1.3.14 in a scratch project: `bun pm pkg set
sideEffects=false` and `bun pm version patch` both rewrote `package.json` with
no prompt, `bun update --latest` and `bun patch --commit` both exist, and `bun
pm trust` is documented as adding to `trustedDependencies` — the one thing
`CLAUDE.md` forbids the agent to do unilaterally, unenforced until now. The
review's second pass then found `bun patch-commit`, which `Bash(bun patch *)`
misses on the hyphen and bun's own `--help` list omits, though it is documented
as equivalent to `bun patch --commit`. So six flat entries join the list; none
of these commands has an alias. `bun link` and `bun unlink` were probed and
left out — neither touched `package.json`.

Left ungated deliberately: the read-only `bun pm` siblings, `bun pm untrusted`
above all, because surfacing its output is how the user reaches that decision.
The cost is that `Bash(bun pm pkg *)` also prompts on `bun pm pkg get`, taken
over three narrower entries.

**The gate is inert on the authoring machine, and the spec now says so.**
Asked to demonstrate the prompt, neither `bun pm pkg get` nor `bun update
--help` prompted. Nor did `bun install --help`, whose `ask` entry has been in
the tracked settings since PR #26 and was therefore loaded at session start —
which rules out a stale in-session copy of the file. The cause is
`.claude/settings.local.json`, which carries `Bash(bun *)` under
`permissions.allow`: a broader grant suppresses `ask`, so none of the 14 entries
prompt there. `deny` behaves the opposite way and is unaffected.

Nothing in this repository can catch that — the local file is gitignored, the
case the tracked-path rule in `CLAUDE.md` names. So it is written into the
requirement as a stated limit rather than left as a surprise, and the prompt
scenarios read as conditional on no broader grant existing.

The two blanket entries were then removed from the local file, and the prompt
still did not appear: a session holds the permission set it loaded at startup,
so an edit to either settings file takes effect only in the next session. That
is why the widened `ask` list is verified here by the test reading the tracked
file, and the prompt itself is left for the user to confirm after a restart —
claiming it from this session would be claiming what was not observed.

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

- **Twelve new approval prompts** → all but one on commands that write
  `package.json` or the lockfile, which is the boundary the policy exists to
  hold. The exception is the read-only `bun pm pkg get`, caught by the single
  `bun pm pkg` entry and accepted rather than split into three precise ones. If
  the short aliases prove never to be used, dropping them is a two-line edit
  and a test update.
- **The alias list can go stale on a `bun` upgrade** → the test probes the
  installed binary in both directions, so a renamed alias and a dropped form
  each fail `bun test` on the next run. What it cannot see is a *new* alias for
  a command that already has one, since `--help` prints only one `Alias:` line
  per command.
- **An exact-equality assertion on 14 strings is brittle to reordering** →
  intended: the test pins the policy, and a reviewer reading a diff of that
  array is the point.
- **`bun r` is surprising** → `bun run` is the far more common `bun r*`
  command, and a user seeing a prompt for `bun r` may read it as a prompt for
  `bun run`. The prompt shows the resolved command string, so the risk is
  confusion rather than a wrong approval.

## Open Questions

None. The fork over whether to widen the policy or narrow the sentence was
settled by the user at propose time, and put again — same answer — when the
local review found the surface reached beyond the install family.
