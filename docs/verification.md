# Verification

Indexed from `CLAUDE.md`, which holds the rule quality bar, the single-source
rule and the fix & capture routing this file inherits. A rule here is added,
tightened or deleted by the same loop, and must clear the same bar: checkable
from a diff, one line, imperative, non-duplicate.

What counts as evidence for a claim, and what a claim may rest on.

## Rules

- Name the environment a verification claim ran in — viewport, browser,
  data — not the one it targeted.
- Verify an external contract against its machine-readable artefact —
  schema, reference page, `--help` — never against a prose summary of it.
- Verify every external recommendation before implementing it; report which
  parts failed verification and what replaces them.
- Never infer a permission outcome from a command that succeeded — an
  approved prompt and an unprompted call are indistinguishable from inside
  the session.
- Record the cause a measurement establishes, not the one it merely permits —
  name the alternatives ruled out.
