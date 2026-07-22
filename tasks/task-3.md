# Task 3 — Linting: Biome for code, actionlint for workflows, native YAML check

> **Status: DONE.** Live config: `biome.json`, `scripts/check-yaml.ts`,
> the `lint`/`lint:fix`/`lint:yaml`/`typecheck` scripts in `package.json`,
> and the four jobs in `.github/workflows/lint.yml`.

## Context

Biome is our linter/formatter for JS/TS/JSON, but it does not support YAML
yet (it's on their 2026 roadmap — "parser almost ready"). Our actual YAML
surface is tiny: GitHub workflow files and `openspec/config.yaml`. So
instead of dragging in a generic YAML linter (yamllint = a Python
toolchain), we compose:

1. **Biome** — lint + format for JS/TS/JSON.
2. **actionlint** — deep static checks for `.github/workflows/*` (validates
   expressions and action inputs, runs shellcheck on `run:` blocks). This
   mechanically enforces two CLAUDE.md security rules: no `github.event.*`
   interpolation in `run:`, and workflow correctness in general.
3. **`Bun.YAML.parse`** — native, zero-dependency syntax validation for all
   remaining YAML files.

Facts you must respect:

- Bun executes TypeScript by **stripping types without checking them** — a
  call to a nonexistent method runs fine until it crashes. Biome does not
  typecheck either. The typechecker (`tsc --noEmit`) is therefore a
  separate, mandatory third leg of static analysis here, not an optional
  extra.
- Adding `@biomejs/biome` is a dependency change: the full Dependency
  safety flow from CLAUDE.md applies (registry verification, then `/warm`
  after the manifest change).
- actionlint is a Go binary, NOT an npm package. Never install it via
  `curl … | bash` (CLAUDE.md rule). In CI, use its official Docker image
  pinned by digest, or download the release archive to a file, verify its
  checksum against the published checksums file, and only then run it.
- When Biome ships YAML support, step 3's script becomes deletable — leave
  a `TODO(biome-yaml)` comment in the script saying exactly that.

## Constraints

- No dependencies beyond `@biomejs/biome`, `typescript`, and `@types/bun`
  (all dev). No yamllint, no prettier, no eslint, no yaml npm packages.
- No Biome rule customization, no format-on-save editor config — defaults
  only until real friction appears.
- Do NOT modify audit.yml / triage.yml except for confirmed actionlint
  findings (step 4).
- Do NOT add pre-commit/pre-push hooks in this task.

## Acceptance criteria

- [x] `biome.json` exists; `bun run lint` passes on the repo.
- [x] `tsconfig.json` exists, strict, based on Bun's recommended config;
      `bun run typecheck` passes; lint.yml has a typecheck job.
- [x] `@biomejs/biome` is an exact-version devDependency; `/warm` report
      was produced for the change.
- [x] `scripts/check-yaml.ts` exists, uses `Bun.YAML.parse`, contains the
      `TODO(biome-yaml)` note; `bun run lint:yaml` passes.
- [x] `.github/workflows/lint.yml` exists with the four jobs; every
      action pinned by full SHA; actionlint runs via pinned digest or
      checksum-verified binary — no `curl | bash` anywhere.
- [x] actionlint passes against all existing workflow files (or findings
      were reported and resolved with user confirmation).
- [x] README.md documents the lint commands.
