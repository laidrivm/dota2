# Design — mechanised prohibitions

## Context

`.claude/settings.json` today carries four `deny` entries for foreign package
managers and fourteen `ask` entries for bun's manifest-writing commands, all
pinned by `agent-permissions.test.ts`. There are no hooks. `lint.yml` runs four
jobs, one of which — `actionlint` — already uses a digest-pinned container, so
the pattern for pulling a non-npm binary into CI exists.

Verified while drafting this design:

- The `PreToolUse` hook contract, against
  `code.claude.com/docs/en/hooks`: a hook entry carries `matcher` (tool name),
  and each command may carry an `if` field in permission-rule syntax that
  filters on tool name *and* arguments — `"Bash(git *)"`. The command receives
  the event JSON on stdin with `tool_input.command`, and **exit 2 blocks the
  call, feeding stderr back to the agent as the reason**. Any other non-zero
  code is a *non-blocking* error: the tool runs anyway and the transcript shows
  the first line of stderr. So the script has exactly two exits — 0 to allow,
  2 for everything else, including an event it cannot read. A separate
  "could not determine" code was drafted and dropped: it lets the commit
  through with a notice, which is the failure mode the hook exists to remove.
- The `if` field uses permission-rule syntax and **matches each subcommand of a
  compound command independently**, not the command string's prefix. The docs'
  own table gives `Bash(git *)` against `npm test && git push` as a match,
  strips leading `VAR=value` assignments before matching, and checks commands
  inside `$()` and backticks. So one entry covers a git command in any
  position.
- `zricethezav/gitleaks:v8.30.1` resolves to
  `sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f`.
  The digest is re-fetched at apply rather than trusted from here.
- The tree contains no `biome-ignore`, `@ts-expect-error`, `@ts-ignore` or
  `eslint-disable` in any tracked source, so the suppression check is green on
  arrival and must be proved red by hand.

## Goals / Non-Goals

**Goals:**

- Replace every prohibition that a mechanism can express exactly.
- Delete the prose each mechanism replaces, from wherever it lives.
- Make the rules list's maintenance trigger act on a sublist that can actually
  be evicted.
- Add no runtime dependency; the scanner is a container in CI and an optional
  binary locally.

**Non-Goals:** as listed in the proposal — `curl … | bash`, the non-token half
of the secrets rule, skill-frontmatter reconciliation, `gh api`, and moving
the pre-PR sequence out of `docs/review-toolkit.md`.

## Decisions

### A hook for git, deny entries for `gh`

`deny` matches a command prefix. That fits `gh pr comment …`, whose forbidden
part is the first three words. It does not fit either git prohibition:
`git push origin feat/x --force` puts the flag last, and `git commit` is
forbidden only when `HEAD` is on `main`, which no pattern can see. So the two
mechanisms split along what each can express, not along taste.

Rejected: `Bash(git push --force*)` as a deny entry, as originally sketched.
It would cover the form the agent usually writes and silently miss the
reordered one — a boundary that holds only for the well-behaved caller is the
kind of guarantee this change exists to stop relying on.

Rejected: adding both, deny for the prefix form and a hook for the rest. Two
mechanisms for one rule means two places to read and one to forget; the hook
already covers everything the deny entry would.

### One hook script in bun, not a shell one-liner or `jq`

The two git checks live in one `scripts/git-guard.ts`, run by `bun`, mounted
under a single hook entry with `if: "Bash(git *)"`.

- **Not `jq`.** The documented example parses stdin with `jq`, which this
  project does not require and macOS does not ship. Bun is already a hard
  dependency.
- **Not a shell one-liner per prohibition.** The commit check alone could be
  `test "$(git symbolic-ref --quiet --short HEAD)" != main || exit 2` with
  `if: "Bash(git commit*)"`, and nothing more. But the force-push check must
  read the command text, so a script exists either way — and one file
  answering "may this git command run?" is easier to test than two entries
  with different shapes.
- **Not pattern-matching the raw stdin payload.** The event JSON carries the
  command's `description` too, so grepping the whole payload for `--force`
  would block a push whose description merely says "force". The script reads
  `tool_input.command`.

The hook is stricter than the prose it replaces: the old rule forbade
force-pushing *after a PR is open*, and the hook forbids it always. Encoding
"after a PR is open" would mean a `gh` call inside a hook on every push —
network latency on a hot path, to preserve a capability the agent has no
routine use for. The user keeps force-push; the agent loses it.

### `gitleaks` from a digest-pinned image, optional locally

CI runs the container the way `actionlint` already does. Locally the pre-commit
hook calls the binary only if `command -v gitleaks` finds one, and skips
otherwise.

Rejected: making the binary a hard prerequisite. A fresh clone would fail its
first commit on a tool the repository cannot install for you — `gitleaks` is
a Go binary with no npm distribution, and this project's dependency rules keep
installers out of the repository.

Rejected: CI only. A secret caught at CI is already in the branch history and
on GitHub; removing it means a history rewrite and a rotation. The local scan
is best-effort precisely because the expensive case is the one it prevents.

### The suppression check is a grep with an allowlist

The rule it replaces has an escape hatch — a suppression is allowed when the
user approves it — and a grep cannot see approval. Encoding the approval as a
path and a count in the check's own allowlist turns it into a line of the
diff, which is where an approval should be visible anyway. The count is what
stops a second suppression riding in on the first one's approval.

The scanned set is `.ts`, `.tsx` and `.json` rather than every tracked file.
Prose discusses suppressions by name — this change's own three artefacts
contain `biome-ignore` between them — and a check that fails on the proposal
introducing it is a check that gets disabled in its first week. The check's own
script and test are excluded for the same reason: both are `.ts` files that
must carry the three markers literally, so the check would fail on itself the
moment it existed. Excluding them by path rather than by allowlist entry keeps
the counts off the test, which would otherwise have to be re-approved every
time a case is added.

The allowlist keys on path **and marker**, not path alone. With the path alone,
replacing an approved `@ts-ignore` with a `biome-ignore` at that path passes on
the earlier approval, which is the same hole as a second suppression riding in
on the first — one entry, one marker, one count.

Rejected: an in-comment marker such as `biome-ignore … approved-by:`. It keeps
the approval next to the code but makes the check parse comment text, and it
lets an approval be added without anyone reviewing a config change.

Rejected: Biome's own configuration for banning suppression comments. The
check must also cover `@ts-expect-error` and `@ts-ignore`, which are the
type-checker's, not Biome's, so one grep covers both tools where two
configurations would not.

### Three sublists, and where the boundary falls

Seventeen rules stand in the list today. Six describe this application's code —
the reducer, the key handler, the focus restore, the document listener, the
input guard, the single-caller helper — and are the evictable set. The other
eleven are process and safety, and none of them age. Exactly one of those
eleven is fully mechanised here — *Fix code a linter or type-checker flags;
never suppress a finding …*, which the suppression check takes over — so the
split leaves **six code rules and ten process/safety rules**, sixteen in all,
and no code rule is evicted by this change.

The split is worth its own diff because it changes what the maintenance
trigger means: at seventeen the list is near its threshold, and every
candidate for eviction is a code rule sitting behind ten that will never go.

### The grep rule is narrowed, not deleted

Removing `PLAN.md`'s copy of the gate sequence removes the duplication that
motivated the rule, but not every duplication: `openspec/specs/**` restates
decisions by design, and `README.md`'s ownership map restates paths — pinned
by `readme-map.test.ts`, which is itself the reason the map can be trusted.
The rule keeps its subject and loses its enumeration of sites.

## Risks / Trade-offs

- **The hook fires on every git command.** `if: "Bash(git *)"` runs a bun
  process per git call → the script does no I/O beyond one `git symbolic-ref`
  and exits; if it ever shows up, the `if` narrows to `git commit*` and
  `git push*` as two entries.
- **The `if` field's matching is documented, not observed here.** It splits
  compound commands by the docs' own table → apply confirms it live with
  `bun test && git commit` on `main`, since a wrong reading would leave the
  hook unregistered for exactly the compound form the prose forbids.
- **A blocked force-push during a rebase workflow.** The agent cannot finish a
  rebase it starts → it does not start one; branch rewrites become the user's,
  which is what the original rule already implied.
- **Digest pinning goes stale.** A pinned `gitleaks` stops receiving new
  detection rules → Dependabot does not watch container digests in workflow
  files here, so the version is bumped when a proposal touches CI, and the
  staleness is visible in the pinned tag comment beside it.
- **Deleting prose weakens the review bot.** `.coderabbit.yaml` points
  `code_guidelines` at `**/CLAUDE.md`, so a deleted rule is one the bot no
  longer enforces → acceptable for the mechanised ones, since the mechanism
  fails the build and the bot only comments.

## Migration plan — four sequenced steps

1. `feat/mechanised-prohibitions-permissions` — the `gh` deny entries, the git
   guard hook and its script, and the assertions in
   `agent-permissions.test.ts`.
2. `feat/mechanised-prohibitions-secrets` — `gitleaks` in CI and in the
   pre-commit hook.
3. `feat/mechanised-prohibitions-suppressions` — the suppression check and its
   CI job.
4. `feat/mechanised-prohibitions-rulebook` — the three sublists, the prose
   deletions the first three steps earn, the `PLAN.md` section removal and the
   narrowed grep rule.

Step 4 is last because it deletes the prose that steps 1–3 replace; running it
earlier would leave a window with neither the rule nor the mechanism. Rollback
for each is a revert.

## Open questions

None.
