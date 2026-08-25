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
  schema, reference page, `--help` — never against a prose summary of it or a
  type declaration of it: exercise the call.
- Exercise a documented capability on every path the project runs it —
  documentation describes one implementation, and a bundler and a dev server
  are two.
- Verify an external recommendation, or a tool mechanism a plan prescribes,
  before writing it into an artefact — a plan is not an implementation, so a
  mechanism named from priors reads exactly like one that was tried; report
  which parts failed verification and what replaces them.
- Never infer a permission outcome from a command that succeeded — an
  approved prompt and an unprompted call are indistinguishable from inside
  the session.
- Verify a permissions change only in a session started after it — a session
  holds the permission set it loaded at startup, while a hook is re-read from
  the settings file per tool call and is observable at once.
- Record the cause a measurement establishes, not the one it merely permits —
  name the alternatives ruled out.
- Name what a measurement was taken over beside its number, and cite it for
  nothing else.
- Re-run the failure probe that justified an assertion after rewriting it.
- Verify what a thing does against the thing, never against what governs it —
  a git hook is what `.git/hooks/` holds, not what `package.json` declares,
  and a module checks what its code checks, not what its specification
  requires of it. Cite the file and line when an artefact states what existing
  code does.
- Read a command's exit status from the command, not from a pipeline or a
  loop that continued past its failure, and read a gating check's output
  before running what it gates rather than chaining the two with `&&`.
- Pass the directory to a search rather than changing into it — a shell's
  working directory outlives the command that set it, and a scan run from the
  wrong one answers with a plausible subset instead of an error.
- Probe a signal with the event that must leave it unchanged, not only with
  the event that must move it.
- Before editing an artefact to match an observed state, confirm the state is
  the intended one.
- Probe one mutation of shared state per run, never a sequence of them.
- Take a move's evidence from the suite that needs its service, never from the
  offline run alone.
