# Design — CodeRabbit local review as a pre-push gate

## Context

`coderabbit-local` is vendored from the shared skills repo. It grants
`Bash(cr doctor:*)` and `Bash(cr review:*)` and carries no
`disable-model-invocation`, so the agent may invoke it — which is what this
change relies on. Its `allowed-tools` names no package manager, so it already
satisfies the reconciliation rule `vendored-skill-permissions` introduces.

The skill's own procedure is: `cr doctor`, then `cr review --base <base>
--plain`, then sort findings on the `🔵 Trivial < 🟡 Minor < 🟠 Major <
🔴 Critical` ladder, then show a plan and wait. It ends with "**No fixes
before approval.** Steps 1–3 change nothing on disk."

`cr` is not installed on this machine.

## Goals / Non-Goals

**Goals:**

- Move CodeRabbit's findings from after the PR to before the push, without
  reintroducing the wait that made `/coderabbit` the user's to invoke.
- Give a skipped finding's justification somewhere durable, so the same
  point is not re-raised on the next branch.

**Non-Goals:**

- Learnings, installing `cr`, CI or hook integration, editing the skill —
  see the proposal.

## Decisions

**The agent invokes `/coderabbit-local`; `/coderabbit` stays the user's.**
These look contradictory and are not. `CLAUDE.md` reserves `/coderabbit`
because the bot's PR review "arrives on its own schedule, and waiting for it
burns a session doing nothing" — the cost is the wait, not the review. `cr
review` returns in the same turn, so the rationale does not carry over. Both
sentences are kept, next to each other, with the distinction stated, because
the pair otherwise reads as an inconsistency someone will later "fix".

**Auto-apply Major and Critical, override the skill's approval rule.** A
branch before push is the cheapest possible place to be wrong: nothing is
shared, and `git checkout` undoes everything. Pausing for approval on a
finding the agent has already verified against the code buys nothing and
turns a three-pass loop into three interruptions. This is a project override
of a vendored skill's rule — the same class of conflict
`vendored-skill-permissions` addresses, resolved the other way, and recorded
here so it is a decision rather than drift.

**Minor is collected, not decided per pass.** Minor findings are judgement
calls, and judging them one pass at a time means three separate
interruptions about taste. They accumulate across passes and are reported
once at the end, each with fixed-or-skipped and a reason. `below severity
threshold` remains not a reason, per the skill.

**Three reviews, two fix rounds, early exit.** The sequence is review → fix →
review → fix → review. It stops early the moment a review returns nothing
above Minor — the third pass exists to confirm the second round of fixes, not
to be spent. If Major or above survives the third review, the agent reports
what remains and stops; deciding whether to push anyway is the user's.
Without a cap this loop has no termination proof, because each fix is new
code the next review can object to.

**A skipped Minor becomes a rule only when it is a convention.** The
temptation is to route every justification into `CLAUDE.md` so the bot stops
repeating it. That would destroy the file: `CLAUDE.md` sets a rule quality
bar (checkable, one line, non-duplicate) and a maintenance trigger at ~20
rules, and a bot's taste objections would blow through both. So the existing
fix & capture routing applies unchanged — a settled convention becomes a
rule, a one-off is named as a one-off and captured nowhere. The rule list
stays a list of decisions this project made, not a transcript of arguments
with a reviewer.

**Whether the CLI reads `.coderabbit.yaml` on its own is unverified, and the
gate is gated on finding out.** The whole justification-feedback route assumes
it: `.coderabbit.yaml` points `knowledge_base.code_guidelines.filePatterns` at
`**/CLAUDE.md` and `docs/*.md`, so a rule written there should be read by the
next review. The CLI reference does not say the repo config is picked up
automatically, and it lists a flag that suggests the opposite —
`-c, --config <files...>`, "Additional instructions for CodeRabbit AI (for
example, CLAUDE.md or coderabbit.yaml)". A flag whose own example is the repo
config is hard to explain if the config were already being read.

If it is not read, the local reviewer is a *differently* aligned reviewer from
the PR bot: it would raise what the PR bot suppresses and miss what the PR bot
enforces, doubling the noise instead of removing it — the opposite of this
change's purpose. So this is a precondition, not a footnote.

It is cheap to settle: `cr review --show-prompts` prints the saved prompts
from the most recent local review without running a new one, so one review
followed by that flag shows whether the `path_instructions` and the
`code_guidelines` pointer reached the model. That check runs before any rule
is written.

**Either answer leaves the gate workable, which is why the change is worth
proposing before the check.** If the config is read, nothing more is needed.
If it is not, `--config .coderabbit.yaml CLAUDE.md` is added to the invocation
the rule prescribes, and the same alignment is bought explicitly. What must
not happen is writing the rule without knowing which of the two it is.

**Gitignored paths need no mirroring into the config.** The CLI reference
defines `--include-untracked` as "Tracked changes plus **non-ignored** files
not added to Git", so an ignored path is out of scope even under the widest
scope flag. Nothing in `.gitignore` needs restating in `path_filters` for the
local run — which is also why `coderabbit-config` rejects a `dist/**` filter.

**Doc-only branches get one pass, not three.** `CLAUDE.md` already runs a
reduced gate for a branch of documentation, rules or config. Three reviews of
a prose diff is a poor trade against several minutes each.

## Risks / Trade-offs

- **Up to three reviews of several minutes each, on every code PR** → the
  early exit is what keeps the common case at one or two, and `--light` is
  available if a branch is large and the user asks. If the cost proves worse
  than the churn it prevents, the cap drops to one pass; that is a one-line
  change to the rule.
- **`cr` is not installed and needs authentication** → the gate is inert
  until the user runs `brew install coderabbit` and `cr auth login`. The
  skill's own step 1 is `cr doctor`, which exits non-zero and names the
  failing check, so the failure mode is a clear message rather than a
  confusing review. Until then the agent reports the gate as unavailable and
  pushes without it rather than blocking the branch.
- **Auto-applied fixes can be wrong** → they are verified against the current
  code before applying, per the skill's Major/Critical rule, and every
  applied fix is listed in the final report. The branch is unpushed, so the
  blast radius is a local `git checkout`.
- **The loop's fixes are not re-run through the other gates** → a fix applied
  after `/triage` was never triaged, and a fix touching a tested path was
  never re-run through `/zombies`. `bun test` and the pre-push hook still
  cover the mechanical part; the judgement part is accepted as the price of
  putting this step last.

## Open Questions

- **Does `cr` read `.coderabbit.yaml` from the repository without being told
  to?** Settled by the `--show-prompts` check in the task list, before any
  rule is written. The answer decides only whether the prescribed invocation
  carries `--config .coderabbit.yaml CLAUDE.md`; it does not decide whether
  the gate exists.
