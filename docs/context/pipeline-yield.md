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
