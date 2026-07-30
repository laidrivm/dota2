# Tasks — mechanised prohibitions

Four groups, four pull requests on `feat/mechanised-prohibitions-<step>`, in
order. Group 4 runs last because it deletes the prose the first three replace.
Requirement citations are the `### Requirement:` headings in
`specs/agent-permissions/spec.md`, `specs/commit-gates/spec.md` and
`specs/agent-rulebook/spec.md`.

## 1. Deny entries and the git guard

- [x] 1.1 Add `Bash(gh pr comment *)`, `Bash(gh issue comment *)` and
      `Bash(gh pr review *)` to `permissions.deny` in `.claude/settings.json`
      — *GitHub write commands are denied*
- [x] 1.2 Write `scripts/command-guard.ts`: read the event JSON from stdin, take
      `tool_input.command`, split it on `&&`, `||`, `;`, `|` and newlines, and
      for each subcommand decide whether it is a commit while `HEAD` is on
      `main` or a push carrying a force flag — *The git prohibitions are
      enforced by a hook*
- [x] 1.3 Match the force flags as whole arguments, not substrings, so
      `--follow-tags` and `--fixup` do not trigger them (7, 8), and compare the
      branch for equality so `mainline` does not match `main` (6)
- [x] 1.4 Exit 0 to allow and 2 for everything else — a blocked command and an
      event the script cannot read alike, with the reason on stderr. Any other
      non-zero code is non-blocking, so a malformed event or a missing work
      tree would let the commit through with only a transcript notice
      (11, 12, 13)
- [x] 1.5 Register the hook in `.claude/settings.json` under
      `hooks.PreToolUse`, `matcher: "Bash"`, with **no** `if` field — that
      field takes a permission pattern, which matches the command word
      literally, so a narrowed hook never sees `/usr/bin/git` — *The git
      prohibitions are enforced by a hook*
- [x] 1.6 Write `scripts/command-guard.test.ts` driving the script with fabricated
      event JSON against fabricated repositories: missing command (1); a
      non-git command (2); a commit on `main` (3); a compound `git add -A &&
      git commit` on `main` (4); `git log --grep="git commit"` on `main` (5);
      detached `HEAD` (9); `--force-with-lease` (10); a compound whose first
      command is not git, `bun test && git commit` on `main`; the clean
      feature-branch cases (14)
- [x] 1.7 Extend `agent-permissions.test.ts`: the three `gh` deny entries
      present (17), the hook registered and pointing at the tracked script
      (18), `gh pr create` and `gh pr view` matching no deny entry (15, 16) —
      *The permission policy is pinned by a test*
- [x] 1.8 Watch each new assertion fail before it passes, by breaking the
      policy rather than by editing the assertion
- [x] 1.9 Confirm the hook actually fires, and record the result in `PLAN.md`.
      This task assumed a fresh session was needed, because settings load at
      startup; that holds for the permission set and not for a hook, which is
      re-read per tool call — so the authoring session can observe it
- [x] 1.10 Confirm live that a git command is caught wherever it sits in a
      compound command, with `bun test && git commit` on `main`. Confirmed
      first through the `if` field, then again after `if` was dropped and the
      script took over the scan

## 2. The secret scan

- [ ] 2.1 Add a `gitleaks` job to `.github/workflows/lint.yml` using the
      container image pinned by digest with the version in a trailing comment,
      as `actionlint` is — re-fetch the digest rather than copying the one in
      `design.md` — *A secret scan runs in CI and, when available, before a
      commit*
- [ ] 2.2 Add `gitleaks` to the `pre-commit` hook in a form that runs only
      when `command -v gitleaks` finds a binary and exits 0 otherwise — *A
      secret scan runs in CI and, when available, before a commit*
- [ ] 2.3 Prove the CI job red by planting a recognisable fake credential on a
      throwaway branch, then remove it — the check must be seen failing before
      it is trusted
- [ ] 2.4 Confirm the pre-commit path is a no-op on a machine without the
      binary, and does not print a warning on every commit

## 3. The suppression check

- [ ] 3.1 Write `scripts/no-suppressions.ts`: read `git ls-files`, keep
      `.ts`, `.tsx` and `.json`, drop its own two paths — they carry the
      markers literally and would fail the check on arrival — report every
      occurrence of `biome-ignore`, `@ts-expect-error` and `@ts-ignore` with
      its file and line, and subtract the approved count for the matching
      path *and marker* — *Linter and type-checker suppressions fail CI*
- [ ] 3.2 Keep the allowlist inside the script, empty on arrival, keyed by path
      and marker, with the approval reason as a comment beside each entry
- [ ] 3.3 Add the check to `lint.yml` and to `package.json` scripts
- [ ] 3.4 Write `scripts/no-suppressions.test.ts`: the clean tree passes with
      an empty allowlist (19); one suppression fails naming file and line
      (20); two files both reported (21); a markdown file naming
      `biome-ignore` passes (22); an allowlisted path with a second occurrence
      still fails (23); an allowlisted path whose marker was swapped for
      another kind fails; an untracked file passes (24)
- [ ] 3.5 Confirm the check passes over the tree as it stands, that the three
      artefacts of this change do not trip it, and that it does not trip on its
      own script and test

## 4. The rulebook

- [ ] 4.1 Split the `CLAUDE.md` rules list into Code, Process and Safety
      sublists, and restate the ~20 trigger as per-sublist — *The rules list
      is partitioned into three sublists*
- [ ] 4.2 Delete the prose each mechanism now enforces: the commit-on-main and
      force-push sentence in Git & PRs, and the suppression rule in the rules
      list. The "never post to a PR" sentence is narrowed instead of deleted —
      the deny entries reach `gh` only, so it keeps the external services they
      cannot, and names replying, commenting and reviewing, which stops it
      reading as a ban on `gh pr create` — *A mechanised prohibition leaves its
      prose home*
- [ ] 4.3 Shorten the secrets sentence to what `gitleaks` cannot see —
      capability URLs, internal identifiers, machine-local files — rather than
      deleting it — *A mechanised prohibition leaves its prose home*
- [ ] 4.4 Delete the "Gates (reminder)" section from `PLAN.md` — *The pre-PR
      sequence has one home*
- [ ] 4.5 Narrow the grep rule to the sites that still restate things, keeping
      the widened subject it carries by then — a change's own sibling artefacts
      as well as the rulebook — and confirm `docs/feature-workflow.md`
      references the sequence rather than repeating it — *The pre-PR sequence
      has one home*
- [ ] 4.6 Write `rulebook.test.ts`: the three headings exist and every rule
      bullet sits under one of them (25); a bullet outside them fails (26)
- [ ] 4.7 Add rows to the README ownership map for anything this change adds
      that owns a rule, and re-run `readme-map.test.ts`
- [ ] 4.8 Grep for every site restating a deleted rule — `docs/`,
      `openspec/specs/**`, `README.md`, `PLAN.md` — and reconcile each
