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
- Not run: warm (no manifest change)
