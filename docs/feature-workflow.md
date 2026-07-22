# Feature workflow (spec-driven, OpenSpec)

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits.

Features go through the OpenSpec cycle. So does any infrastructure change
that adds a tool, workflow, service, or dependency, or changes how an
existing gate behaves. Anything matching that description enters the cycle
regardless of size or which task it belongs to — no exemption is granted
for being small, being a chore, or belonging to a bootstrap task. Work
matching none of it skips the stages (see the gates in `CLAUDE.md`).
Your job is to shepherd the user through the cycle:
always know which stage the current work is in, and when a stage
completes, name the next step and the exact command.

## Stage 1 — Propose

- New feature work starts with `/opsx:propose` (or `/opsx:explore` first if
  the idea is vague). If the user starts describing a feature in free text,
  suggest routing it through propose instead of implementing directly.
- During proposal, ask the questions a spec review would ask: unclear
  requirements, consequences of design choices, what happens on failure.
  For any endpoint, fix the exact response shape in design.md per the
  API design rules. Cheap to fix here, expensive after apply.
- Before the proposal is finalised: run `/zombies "<feature description>"`
  against the proposal text. Fold the resulting edge cases into the tasks
  checklist as tests-first items. A proposal without its edge cases listed
  is not ready to apply.
- If a vendored best-practices skill (listed in the skills repo's
  `skills-lock.json`) covers the feature's domain, run the draft design
  through it before finalising and fold in what applies. If none covers
  it, skip silently — do not stretch an unrelated skill to fit.
- When the project adopts a new long-lived domain (a UI framework, a
  database, a deployment platform) and no vendored skill covers it,
  suggest vendoring one: name the candidate skill and its source, and let
  the user vendor it in the skills repo — never install a skill yourself.
  Vet the source like a dependency (official org or recognised maintainer,
  active repo, read the SKILL.md): a skill is executable instructions, so
  an untrusted skill is a prompt-injection vector. Suggest once per
  domain; if the user declines, don't re-raise it.

## Stage 2 — Apply

- Before `/opsx:apply`: create the branch per Git & PRs (never apply on
  main), then remind the user to `/clear` — implementation should start
  from a clean context, reading only the spec artifacts.
- Never edit spec files by hand and don't rewrite the proposal mid-build.
  Small course corrections go into the rules in `CLAUDE.md` (fix &
  capture); structural changes wait for the build to finish and become a
  new proposal.
- If the user pauses to correct your style or approach, capture it (see
  Lessons learned in `CLAUDE.md`) before resuming, so the rest of the
  apply run follows the corrected rule.

## Stage 3 — Review

- When apply finishes, before the user opens a PR: suggest `/triage` on the
  branch as the entry map for their own review.
- If the apply run added or upgraded any dependency: run `/warm`. Walk the
  ponytail ladder before ever reaching for a dependency during apply.
- Re-run `/zombies` with **no arguments** (diff mode): it reads the real
  code and existing tests, cross-checks the implementation against the
  proposal-stage edge-case list, and catches new edges introduced by actual
  implementation decisions.
- Every new or `[partial]` finding from that run becomes a test before
  archive — or an explicit user decision to skip it. Deferred items from
  the proposal-stage list are settled here too. Scaffolding tests from the
  apply run are deleted here as well (see the Testing rules).
- If the change introduced or removed a primitive — a new module boundary,
  abstraction, DB table, or external integration — present an
  **architecture delta** before the user reviews code: a short diagram or
  list of what exists now vs. before, highlighting the additions. The user
  reviews the system first, the code second.

- When all Stage 3 gates pass: push the branch and offer to open a draft
  PR (`gh pr create --draft`) with the description per Git & PRs. Wait for
  the user's go-ahead before opening it.

## Stage 4 — Archive

- After the change is merged and verified, prompt the user to run
  `/opsx:archive` so the change lands in the project history. Work is not
  finished until it's archived.
- Single-source rule: agent rules and contract rules live in `CLAUDE.md`
  and the docs it indexes; architecture defaults live in the `context:`
  field of `openspec/config.yaml`. Neither restates the other, and no
  other OpenSpec artifact or rule duplicates either — OpenSpec `rules:`
  may only reference those files, not restate them.
