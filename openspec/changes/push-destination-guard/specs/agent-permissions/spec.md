# agent-permissions delta specification

## MODIFIED Requirements

### Requirement: The git prohibitions are enforced by a hook

Three git prohibitions cannot be expressed as prefix-matched permission entries,
because their trigger is repository state or an argument in any position. They
SHALL be enforced by a single `PreToolUse` hook registered in the tracked
`.claude/settings.json`. The hook SHALL read the invoked command
from the event JSON on stdin rather than pattern-matching the raw payload, so
a `--force` appearing in a command's description cannot trigger it. It SHALL
block by exiting **2** with the reason on stderr — the only code Claude Code
treats as blocking — and SHALL exit 2 for an event it cannot decide as well: a
malformed payload, an absent command field or a git call that fails. Every
other non-zero code lets the command run, so the undecidable case fails closed
or it does not fail at all. It SHALL depend on nothing beyond git and bun, both
of which the repository already requires.

A guard that never starts is the undecidable case too, and the script cannot
answer for it: an unresolved path or an absent `bun` exits **1**, which lets the
command run. The registered command SHALL therefore carry an `|| exit 2`
fallback, so every failure to launch blocks as well.

The hook SHALL carry no `if` field, and SHALL therefore run on every Bash call.
The `if` field takes a permission pattern, and a permission pattern matches the
command word literally: `/usr/bin/git commit` and `command gh pr comment` reach
no hook narrowed that way, which was demonstrated against the registered guard
before this requirement was written. Narrowing by `if` would mean the boundary
is whatever spelling the pattern anticipates. Deciding in the script instead
costs one bun start per Bash call, measured at 16-22 ms — negligible beside the
call it precedes — and the script SHALL resolve each command to its base name,
past a leading assignment, past a wrapper word such as `command`, `builtin`,
`exec` or `env`, and into a shell's `-c` argument.

The residual ceiling is a command whose text does not contain the guarded name
at all — `python -c` spawning a subprocess, or anything encoded. That is
accepted: the guard exists for an agent that writes `git` and `gh` because the
documentation and this repository's prose do, not for an adversary.

The hook SHALL block a commit while `HEAD` is on `main`, and SHALL block any
force-push, whether written as `--force`, `--force-with-lease`, `-f`, bundled
into a short-flag group such as `-uf`, which git reads as `-u -f`, or as the
`+` prefix of a refspec, and wherever it sits in the command. This is stricter than the prose it replaces, which
forbade force-pushing only after a pull request was open: the agent loses
force-push entirely, and the user keeps it.

The hook SHALL also block a push unless every destination the command names is
a concrete ref other than `main`. The rule is stated as what it exempts rather
than as a list of the spellings that mean `main`, because git's grammar has
more of those than a list remembers: `git push origin :` pushes every branch
that already exists on the remote, a wildcard refspec pushes whatever it
matches, and `git push origin HEAD` names its destination only through the
current branch.

The first non-option argument SHALL be read as the repository operand and the
rest as refspecs, which is git's own order. A push naming no refspec SHALL be
blocked while `HEAD` is on `main`, because git then pushes the current branch
to the upstream branch of the same name.

Each refspec SHALL be read as `[+]<src>:<dst>`, where a refspec without
`:<dst>` updates the ref its `<src>` names. The hook SHALL block when the
destination equals `main` or `refs/heads/main`; when the destination is `HEAD`
or `@` and `HEAD` is on `main`, since those resolve through the current branch;
and when the destination is not a single concrete ref at all — the bare `:` and
`+:` matching form, a destination containing `*`, and an empty destination —
because an unbounded destination cannot be shown not to include `main`.

A leading `+` on a refspec SHALL be blocked as a force-push wherever it
appears, whatever its destination: it forces the update exactly as `--force`
does, and the flag pattern does not see it because it is not a flag.

`--all`, its alias `--branches`, and `--mirror` SHALL be blocked outright: they
name no ref and push every ref under `refs/heads/`, `main` among them.

The destination SHALL be read from the command's own words. A destination that
comes from configuration is outside the guard — `remote.<name>.push`,
`push.default` set to `matching`, `upstream` or `tracking`, and
`remote.<name>.mirror` set to true, which makes `--mirror` the default. Reading
them would make the hook decide on repository state the command does not carry,
and the fallback that fails closed on an unreadable state would then block
every push made where that configuration cannot be read. That half stays prose.

The script SHALL find the git command inside a compound one by splitting only
on separators outside quotes. A split that ignores quoting cuts both ways: it
severs a force flag from its command, and it turns a quoted `;` inside a
`--grep` argument into a fragment that reads as a commit. Quoting SHALL be
removed from the words it yields as well, so a value containing a space —
`GIT_AUTHOR_NAME="Jane Doe" git commit`, `git -C "some path" commit` — does not
break the command's resolution. A command substitution SHALL start a command
even inside double quotes, in **both** POSIX spellings, `$(…)` and backticks:
the shell expands them there alike, so honouring one and not the other leaves
the guard walked around by the other.

The branch SHALL be read from the repository the command names with `-C`, and
not from the guard's own working directory, which is a different repository in
exactly that case. `-C` is the only selector honoured: `--git-dir`,
`--work-tree` and the `GIT_DIR` and `GIT_WORK_TREE` environment assignments are
a declared limitation rather than coverage, so a command using one of them is
decided against the guard's own working tree — which can refuse a commit or a
push that would have landed elsewhere, and can miss one that lands on `main` in
another repository.

The long force flags SHALL be matched by the `--force` prefix rather than by
their full spellings. Git accepts any unambiguous abbreviation, so `--force-w`
and `--force-i` reach the force-push path while `--forc` and `--fo` are
rejected as ambiguous — every spelling git honours therefore begins with
`--force`.

#### Scenario: A commit attempted on main

- **WHEN** `HEAD` is on `main` and the agent attempts `git commit -m "fix"`
- **THEN** the hook blocks the call and the reason names branching first

#### Scenario: A commit on a feature branch

- **WHEN** `HEAD` is on `feat/something` and the agent attempts `git commit`
- **THEN** the hook allows the call

#### Scenario: A commit reached through a compound command

- **WHEN** `HEAD` is on `main` and the agent attempts `git add -A && git
  commit -m "fix"`
- **THEN** the hook blocks the call

#### Scenario: A commit reached through a command that does not start with git

- **WHEN** `HEAD` is on `main` and the agent attempts `bun test && git commit
  -m "fix"`
- **THEN** the hook blocks the call, because the script scans every subcommand
  and not the command string's prefix

#### Scenario: A guarded command reached by another spelling

- **WHEN** the agent attempts `/usr/bin/git commit` on `main`, `command gh pr
  comment 37 --body x`, or `bash -c "git commit"` on `main`
- **THEN** the hook blocks each one, because the script resolves the command to
  its base name rather than matching the word as written

#### Scenario: A guarded command behind a quoted value containing a space

- **WHEN** `HEAD` is on `main` and the agent attempts
  `GIT_AUTHOR_NAME="Jane Doe" git commit -m "fix"`
- **THEN** the hook blocks the call — splitting on whitespace alone would
  resolve the invocation to the tail of the quoted value instead of to `git`

#### Scenario: A guarded command inside a backtick substitution

- **WHEN** `HEAD` is on `main` and the agent attempts
  ``echo "`git commit -m fix`"``
- **THEN** the hook blocks the call, as it does for the `$(…)` spelling

#### Scenario: A forbidden command appearing only as text

- **WHEN** the agent attempts `printf 'git push --force'`
- **THEN** the hook allows the call — the guard reads invocations, and a quoted
  argument is data

#### Scenario: A command that merely ends in a guarded name

- **WHEN** the agent attempts `mygit commit -m "fix"` on `main`
- **THEN** the hook allows the call — the base name is `mygit`, not `git`

#### Scenario: A gh write reached by an absolute path

- **WHEN** the agent attempts `/opt/homebrew/bin/gh pr comment 37 --body x`
- **THEN** the hook blocks the call, which is the case the deny entry cannot see

#### Scenario: A gh write behind a global flag

- **WHEN** the agent attempts `gh --repo owner/name pr comment 37 --body x`
- **THEN** the hook blocks the call, because the pair is matched wherever it
  sits and not as the first two words

#### Scenario: A force-push with the flag last

- **WHEN** the agent attempts `git push origin feat/x --force`
- **THEN** the hook blocks the call, although no command-prefix pattern would
  have matched it

#### Scenario: A force flag bundled with another short flag

- **WHEN** the agent attempts `git push -uf origin feat/x`
- **THEN** the hook blocks the call, because git reads the group as `-u -f`

#### Scenario: A separator inside a quoted argument

- **WHEN** the agent attempts `git push origin "a;b" --force`
- **THEN** the hook blocks the call, because the `;` is inside quotes and does
  not start a second command that the flag would fall outside of

#### Scenario: An abbreviated force flag

- **WHEN** the agent attempts `git push --force-w origin feat/x`
- **THEN** the hook blocks the call, because git resolves the abbreviation to
  `--force-with-lease`

#### Scenario: A git command hidden in a command substitution

- **WHEN** the agent attempts `echo "$(git push --force origin feat/x)"`
- **THEN** the hook blocks the call

#### Scenario: A commit aimed at another repository

- **WHEN** `HEAD` here is on `feat/x` and the agent attempts `git -C ../other
  commit -m "fix"` where `../other` is on `main`
- **THEN** the hook blocks the call, because `-C` names where the commit lands

#### Scenario: A lease-guarded force-push

- **WHEN** the agent attempts `git push --force-with-lease`
- **THEN** the hook blocks the call — the boundary is the rewrite, not how
  carefully it is guarded

#### Scenario: An ordinary push

- **WHEN** the agent attempts `git push -u origin feat/x`
- **THEN** the hook allows the call

#### Scenario: The word force appears only in the description

- **WHEN** the agent attempts `git push origin feat/x` with the description
  "force the branch up to date"
- **THEN** the hook allows the call, because it reads the command field and
  not the whole payload

#### Scenario: A push aimed at main by refspec

- **WHEN** the agent attempts `git push origin HEAD:main` from a feature branch
- **THEN** the hook blocks the call

#### Scenario: A push naming main as its only refspec

- **WHEN** the agent attempts `git push origin main` from a feature branch
- **THEN** the hook blocks the call, because a refspec without `:<dst>` updates
  the ref its `<src>` names

#### Scenario: A push aimed at main by its full ref name

- **WHEN** the agent attempts `git push origin +HEAD:refs/heads/main`
- **THEN** the hook blocks the call

#### Scenario: A push with no refspec while HEAD is on main

- **WHEN** the agent attempts `git push` with `HEAD` on `main`
- **THEN** the hook blocks the call, because git pushes the current branch to
  the upstream branch of the same name

#### Scenario: A push of every branch

- **WHEN** the agent attempts `git push --all origin`
- **THEN** the hook blocks the call, because `--all` pushes every ref under
  `refs/heads/`, `main` among them

#### Scenario: A push that deletes main

- **WHEN** the agent attempts `git push origin :main`
- **THEN** the hook blocks the call — the refspec has no `<src>`, and `<dst>`
  is what the check reads

#### Scenario: A second refspec aimed at main

- **WHEN** the agent attempts `git push origin feat/x main`
- **THEN** the hook blocks the call, because every refspec is read and not
  only the first

#### Scenario: A push of every branch with no branch to read

- **WHEN** the agent attempts `git push --all origin` with a detached `HEAD`
- **THEN** the hook blocks the call on the flag alone, without reading a
  branch it cannot read

#### Scenario: A push to a branch whose name contains main

- **WHEN** the agent attempts `git push origin HEAD:mainline`
- **THEN** the hook allows the call — the destination is compared whole

#### Scenario: A push whose source is main but whose destination is not

- **WHEN** the agent attempts `git push origin main:feat/x`
- **THEN** the hook allows the call, because `<dst>` is what the push updates

#### Scenario: A push with no refspec from a feature branch

- **WHEN** the agent attempts `git push` with `HEAD` on `feat/x`
- **THEN** the hook allows the call

#### Scenario: A push of matching branches

- **WHEN** the agent attempts `git push origin :`
- **THEN** the hook blocks the call — the refspec names every branch already on
  the remote, which cannot be shown to exclude `main`

#### Scenario: A push through a wildcard refspec

- **WHEN** the agent attempts `git push origin 'refs/heads/*:refs/heads/*'`
- **THEN** the hook blocks the call, because the destination is not a single
  concrete ref

#### Scenario: A push naming HEAD as its refspec

- **WHEN** the agent attempts `git push origin HEAD` with `HEAD` on `main`
- **THEN** the hook blocks the call, because a refspec without `:<dst>` updates
  the ref its `<src>` names

#### Scenario: A push naming HEAD from a feature branch

- **WHEN** the agent attempts `git push origin HEAD` with `HEAD` on `feat/x`
- **THEN** the hook allows the call

#### Scenario: A force-push written as a refspec prefix

- **WHEN** the agent attempts `git push origin +feat/x:feat/x`
- **THEN** the hook blocks the call, because `+` forces the update exactly as
  `--force` does

#### Scenario: A push naming a remote and nothing else

- **WHEN** the agent attempts `git push origin` with `HEAD` on `main`
- **THEN** the hook blocks the call, because the only argument is the
  repository operand and the push therefore names no refspec
