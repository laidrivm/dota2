# Pipeline yield

## 2026-07-25 — chore/coderabbit-config

- triage: PASS — 2 groups, 1 medium-risk read, 0 findings, 0 acted on
- Not run: zombies (no test ideas at propose — config-only), warm (no manifest change), ponytail-review (YAML only), coderabbit-local (gate not yet landed)

## 2026-07-26 — fix/vendored-skill-permissions

- zombies: OPEN — 2 gaps, 2 acted on (1 test added, 1 dispositioned with a reason)
- ponytail-review: 2 findings, 2 acted on — net -11 lines
- triage: PASS — 3 groups, 1 high-risk read, 0 findings, 0 acted on
- Not run: warm (no manifest change), coderabbit-local (gate not yet landed)

## 2026-07-26 — chore/coderabbit-local-gate

- triage: PASS — 3 groups, 1 medium-risk read, 1 finding, 1 acted on (the config requirement had no anchor in this repo)
- coderabbit-local: PASS — 3 findings, 3 dispositioned (1 Major applied, 1 Minor applied, 1 Minor skipped as a one-off); an earlier attempt was refused on the rate limit, whose quota is shared with the web app
- coderabbit (PR #28): PASS — 2 findings, 2 dispositioned (1 Major: the alignment requirement demanded both instruction sources, its positive scenario checked only one; 1 Minor: a stale PLAN.md status)
- Not run: zombies (no test ideas at propose — rules only), warm (no manifest change), ponytail-review (prose only)

## 2026-07-26 — fix/agent-permissions-gaps

- zombies: PASS — 2 gaps, 2 dispositioned (both written, both red first)
- ponytail-review: 3 findings, 2 applied, 1 rejected — net -6 lines
- triage: PASS — 3 groups, 1 high-risk group reviewed, 0 findings
- coderabbit-local: PASS — 3 passes, 11 findings, 9 applied, 2 rejected; pass 3 returned nothing. The loop paid for itself twice: pass 1 found the manifest-writing surface reaches past the install family (`bun pm pkg set`, `bun pm version`, `bun pm trust`), pass 2 found `bun patch-commit`, which `Bash(bun patch *)` misses on the hyphen
- coderabbit (PR #30): PASS — 2 findings, 2 dispositioned (1 Major: this file's name broke the dated-context convention and my append had eaten a blank line; 1 Minor: a stale PR-wait state)
- Not run: warm (no manifest change)

## 2026-07-27 — chore/archive-agent-permissions-gaps

- Not run: all of them — archive-only branch (spec sync + `git mv` + PLAN.md). The review runs from this session are logged under the two branch headings above, on the branches they ran against.

## 2026-07-27 — fix/readme-drift

- zombies: PASS — 1 gap, 1 dispositioned (a present-but-untracked path must not satisfy a map row; written and watched red against a filesystem check)
- ponytail-review: 1 finding, 1 applied — net -4 lines (three-branch path resolver → one `Bun.Glob`, since a magic-free pattern matches its literal)
- triage: PASS — 4 groups, 1 medium-risk group reviewed, 0 findings
- coderabbit-local: PASS — 4 findings, 4 dispositioned (1 Major applied with a smaller fix than suggested — the bot's own diff renamed the probe file but kept the old literal in the assertion, which would have made the test vacuous; 3 Minor applied)
- **One pass run where the gate prescribes up to three.** Pass 1 returned a Major, and the gate stops early only on a pass returning nothing above Minor, so a second pass was owed and skipped. It would have paid: applying Minor 3 replaced `paths.length > 10` with `expect(paths).toHaveLength(rows.length)`, which passes on `0 === 0` — an emptied map then generated no cases at all, and the whole test file went green on nothing. The PR bot found it; a second local pass is exactly the thing that finds what the previous pass's fixes broke.
- coderabbit (PR #33): PASS — 1 finding, 1 applied (the vacuous length assertion above)
- Not run: warm (no manifest change)

## 2026-07-27 — chore/archive-readme-drift

- Not run: all of them — archive-only branch (spec sync + `git mv` + PLAN.md); the runs are logged under `fix/readme-drift` above.
