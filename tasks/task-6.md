# Task 6 — Git hooks: fast local gates via simple-git-hooks

> **Status: DONE.** Two deviations from the steps below, both deliberate:
> pre-commit is `biome check --staged` **without `--write`** (simple-git-hooks
> can't re-stage autofixes, so `--write` would let an unformatted blob into
> the commit while CI catches it — block instead); pre-push uses the native
> `bun test --pass-with-no-tests` flag as the zero-tests guard (no wrapper
> script). Live config: `package.json` → `simple-git-hooks`. `/warm` → Keep.

## Context

CI (lint.yml, audit.yml) catches problems minutes after push. Hooks catch
the same problems seconds before commit/push, when they're cheapest to fix.
Pattern source: mellon uses `simple-git-hooks` with a staged Biome check on
pre-commit and typecheck on pre-push — adopt that, not husky (laidrivm.com's
older setup: husky drags Node-specific wiring; simple-git-hooks is one tiny
package that writes `.git/hooks` entries from package.json).

Facts you must respect:

- `simple-git-hooks` is a dependency change: full Dependency safety flow
  (registry verification) + `/warm` afterwards.
- Hooks are configured declaratively in package.json and installed by
  running the package's CLI once (via the `prepare` script — our own
  script, which bun runs; this is not a blocked *dependency* lifecycle
  script).
- Hooks must stay fast: pre-commit under ~2 s, pre-push under ~15 s.
  A slow hook gets `--no-verify`'d out of existence and protects nothing.
- e2e never runs in hooks (task 4 constraint) — that's what CI is for.
- Hooks install with `bun install --frozen-lockfile` semantics — CLAUDE.md
  rule applies to anything a hook itself installs (nothing, ideally).

## Steps

### 1. Install and wire

- `bun add --dev --exact simple-git-hooks` (Dependency safety check first,
  `/warm` after).
- In package.json:
  - `"prepare": "simple-git-hooks"` script, so hooks reinstall on
    `bun install`.
  - ```json
    "simple-git-hooks": {
      "pre-commit": "bunx biome check --staged --write --no-errors-on-unmatched",
      "pre-push": "bun run typecheck && bun test"
    }
    ```
- Run `bunx simple-git-hooks` once and verify `.git/hooks/pre-commit` and
  `.git/hooks/pre-push` exist and are the generated stubs.

### 2. Guard the no-tests state

If no unit test files exist yet, `bun test` exits non-zero ("no tests
found") — guard the pre-push command so it passes cleanly until the first
test lands (e.g. `bun test 2>/dev/null || [ $? -eq 1 ]` is NOT acceptable —
find the precise bun behaviour and handle exactly that case, with a comment
to remove the guard when phase-1 tests land).

### 3. Verify both hooks fire

- Make a whitespace-broken staged change → commit → confirm Biome fixed or
  blocked it.
- Break a type in a scratch file → push attempt → confirm the push is
  rejected. Clean up the scratch file afterwards.

### 4. Document

README tooling section: one line — hooks are installed automatically by
`bun install` (prepare), what each hook runs, and that `--no-verify` is an
emergency exit, not a workflow.

## Constraints

- No hook frameworks (husky, lefthook, pre-commit) — simple-git-hooks only.
- No e2e, no coverage, no audit in hooks.
- Do NOT bypass or weaken existing gates: staged-only Biome on pre-commit
  (whole-repo `biome ci` stays in CI).

## Acceptance criteria

- [x] `simple-git-hooks` is an exact devDependency; `/warm` report produced.
- [x] package.json has `prepare` + `simple-git-hooks` config: pre-commit
      `biome check --staged` (no `--write`), pre-push
      `bun run typecheck && bun test --pass-with-no-tests`.
- [x] `.git/hooks/pre-commit` and `.git/hooks/pre-push` exist after
      `bun install`.
- [x] Both hooks demonstrated firing (step 3), scratch artifacts removed.
- [x] Pre-push passes cleanly on a repo with zero test files, via
      `--pass-with-no-tests` (drop the flag once phase-1 tests land).
- [x] README documents the hooks.
