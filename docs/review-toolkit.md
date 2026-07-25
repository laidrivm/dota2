# Review toolkit

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits.

Review skills live in `.claude/skills/` (symlinked from the shared skills
repo — edit them there, not here); `/ponytail-review` comes from the ponytail
plugin.

Show a review skill's report, then act on it in the same turn: apply the
findings that hold against the current code, and say which you skip and why.
The report alone is never the deliverable.

## The skills

- `/zombies [feature]` — test ideas via the ZOMBIES heuristic. With args:
  works from a feature description (pre-code). Without args: diff mode,
  cross-referenced against existing tests.
- `/warm [base]` — WARM check of dependencies the branch pulls in. The change
  is not done until its dependencies are vetted.
- `/ponytail-review` — over-engineering pass over the diff. Invoke it
  yourself and apply the cuts that survive.
- `/triage [base]` — risk-ordered map of the branch diff. Invoke it yourself.
  It returns no findings by design, so acting on it means reading the files it
  ranks High and Medium, reporting the defects they hold, and grepping every
  decision or value the diff changes for the sites that restate it.
- `/coderabbit [pr]` — chews the bot's PR comments. Its
  `disable-model-invocation` flag reserves it for the user, because the bot's
  review arrives on its own schedule and waiting for it burns a session doing
  nothing. Once a PR is open, say so and stop —
  do not poll the checks, do not sleep on a timer, do not re-run `gh` to see
  whether the bot has posted. It drops Trivial and Minor with a reason and
  holds Major and above for the user's approval before applying anything.

## The pre-PR sequence

Before every PR that changes code — a feature, a bugfix, a chore alike, and
whether or not it goes through the OpenSpec stages:

1. `/zombies` with **no arguments** — diff mode reads the real code and
   existing tests, cross-checks the implementation against the
   proposal-stage edge-case list, and catches the edges only implementation
   decisions create. Fix what it finds.
2. `/warm`, only when a dependency manifest changed, having walked the
   ponytail ladder before ever reaching for a dependency.
3. `/ponytail-review`, applying the cuts that survive.
4. `/triage` last, over the final diff, so it maps the diff the reviewer
   will actually see.

A branch of documentation, rules or config runs `/triage` alone, plus a grep
for every site restating what it changes.

Your sequence ends there — the PR link is the deliverable. `/coderabbit`
closes the loop on either, whenever the user chooses to run it.
