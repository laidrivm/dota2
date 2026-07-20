# Task 3 — Linting: Biome for code, actionlint for workflows, native YAML check

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

## Steps

### 1. Set up Biome

- `bun add --dev --exact @biomejs/biome` (after the Dependency safety
  check; run `/warm` afterwards).
- `bunx biome init` to generate `biome.json`; keep the recommended preset,
  add no custom rule overrides in this task.
- Add package.json scripts:
  - `"lint": "biome ci ."` (check only, CI-friendly)
  - `"lint:fix": "biome check --write ."`

### 2. Set up the typecheck

- `bun add --dev --exact typescript @types/bun` (Dependency safety check
  first, `/warm` after — one report may cover all of this task's deps).
- Create `tsconfig.json` from **Bun's officially recommended tsconfig**
  (take it from the Bun docs, don't compose one from memory), with
  `"strict": true` and `"noEmit": true` kept/added.
- Add package.json script: `"typecheck": "tsc --noEmit"`.
- Strictness is not negotiable downward later: loosening a tsconfig flag
  is a fix-&-capture-level decision for the user, never a workaround for
  a red typecheck.

### 3. Add the YAML syntax check script

Create `scripts/check-yaml.ts`:

- Verify first that `Bun.YAML` exists in the installed bun
  (`bun -e "console.log(typeof Bun.YAML?.parse)"`). If it does not, STOP
  and report — do not install a YAML package as a fallback.
- The script: glob all `*.yml` / `*.yaml` outside `node_modules`, parse
  each with `Bun.YAML.parse`, print per-file errors, exit non-zero if any
  file fails. Keep it under ~30 lines.
- Include the `TODO(biome-yaml)` comment from Context.
- Add package.json script: `"lint:yaml": "bun scripts/check-yaml.ts"`.

### 4. Create `.github/workflows/lint.yml`

Jobs, all on `pull_request` (no path filters — all three are fast):

- **biome**: checkout → setup bun (pinned SHA, same as audit.yml) →
  `bun install --frozen-lockfile` → `bun run lint`.
- **typecheck**: checkout → setup bun → `bun install --frozen-lockfile` →
  `bun run typecheck`.
- **yaml-syntax**: checkout → setup bun → `bun run lint:yaml` (no install
  needed if the script has zero imports; otherwise install frozen).
- **actionlint**: checkout → run actionlint via the official
  `rhysd/actionlint` Docker image pinned by digest (or
  download-verify-checksum-run). No `curl | bash`.

Same workflow rules as always: actions pinned by full commit SHA with a
version comment, `permissions: contents: read`, no `github.event.*` in
`run:` blocks.

### 5. Fix what the linters find

Run all three locally against the current repo. actionlint findings in
existing workflows (audit.yml, triage.yml if present): report each to the
user, fix only after confirmation — same as task 2 step 4.

### 6. Document

Append to README.md's tooling section: the four commands (`bun run lint`,
`bun run lint:fix`, `bun run lint:yaml`, `bun run typecheck`), and one line on actionlint
running in CI (plus `brew install actionlint` as the optional local
equivalent).

## Constraints

- No dependencies beyond `@biomejs/biome`, `typescript`, and `@types/bun`
  (all dev). No yamllint, no prettier, no eslint, no yaml npm packages.
- No Biome rule customization, no format-on-save editor config — defaults
  only until real friction appears.
- Do NOT modify audit.yml / triage.yml except for confirmed actionlint
  findings (step 4).
- Do NOT add pre-commit/pre-push hooks in this task.

## Acceptance criteria

- [ ] `biome.json` exists; `bun run lint` passes on the repo.
- [ ] `tsconfig.json` exists, strict, based on Bun's recommended config;
      `bun run typecheck` passes; lint.yml has a typecheck job.
- [ ] `@biomejs/biome` is an exact-version devDependency; `/warm` report
      was produced for the change.
- [ ] `scripts/check-yaml.ts` exists, uses `Bun.YAML.parse`, contains the
      `TODO(biome-yaml)` note; `bun run lint:yaml` passes.
- [ ] `.github/workflows/lint.yml` exists with the four jobs; every
      action pinned by full SHA; actionlint runs via pinned digest or
      checksum-verified binary — no `curl | bash` anywhere.
- [ ] actionlint passes against all existing workflow files (or findings
      were reported and resolved with user confirmation).
- [ ] README.md documents the lint commands.
