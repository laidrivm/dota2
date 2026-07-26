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
- `/coderabbit-local [base]` — the same review against the working branch,
  before there is a PR. Invoke it yourself. 🟠 Major and 🔴 Critical findings
  that survive verification are applied without asking, overriding the skill's
  own "No fixes before approval" — the branch is unpushed, so being wrong
  costs a `git checkout`. At most three reviews with fixes between them; stop
  early the moment a review returns nothing above 🟡 Minor, and if Major or
  above survives the third, report it and stop rather than starting a fourth.
  Collect Minor findings across all passes and report them once at the end,
  each fixed or skipped with its reason. The CLI does not read
  `.coderabbit.yaml` on its own, so the skill passes it explicitly — a local
  review that skips that is a differently aligned reviewer, not a cheaper one.
- `/coderabbit [pr]` — chews the bot's PR comments. Its
  `disable-model-invocation` flag reserves it for the user, because the bot's
  review arrives on its own schedule and waiting for it burns a session doing
  nothing — the cost is the wait, which a synchronous CLI review does not
  have, and that is the whole difference between this bullet and the one above
  it. Once a PR is open, say so and stop —
  do not poll the checks, do not sleep on a timer, do not re-run `gh` to see
  whether the bot has posted. Once the user does invoke it, dispose of the
  findings on the same terms as `/coderabbit-local`: Major and above applied
  without asking, Minor read and then fixed or skipped with its reason,
  overriding the skill's "No fixes before approval". Invoking it is the
  approval — the user is present by definition, and a wrong fix on an open PR
  costs one more commit on a branch already under review.

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
4. `/triage`, over the final diff, so it maps the diff the reviewer
   will actually see.
5. `/coderabbit-local` last, then push.

A branch of documentation, rules or config runs `/triage` alone, plus a grep
for every site restating what it changes, then one pass of
`/coderabbit-local` — one, not three.

Your sequence ends there — the PR link is the deliverable. `/coderabbit`
closes the loop on either, whenever the user chooses to run it.
