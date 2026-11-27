# module-boundaries delta — captains-mode-assistant

## MODIFIED Requirements

### Requirement: The prediction model never imports from the application layer

`src/model.ts`, `src/types.ts` and every module under `src/cm/engine/` SHALL
NOT import from `src/app/**` or from the Captains Mode page's own interface
under `src/cm/ui/**`. The rule SHALL be enforced by the linter already wired
into the pre-commit hook and `lint.yml`, not by a bespoke script.

#### Scenario: The model reaches into the app

- **WHEN** `src/model.ts` imports from `./app/session.ts`
- **THEN** `biome lint` reports the restricted import and exits non-zero
- **AND** the pre-commit hook rejects the commit

#### Scenario: The app imports the model

- **WHEN** `src/app/app.tsx` imports from `../model.ts`
- **THEN** the linter reports nothing — the arrow runs one way only

#### Scenario: A type-only import back into the app

- **WHEN** `src/types.ts` imports a type from `src/app/session.ts`
- **THEN** the linter reports the restricted import — the restriction covers
  type imports, because the boundary is about ownership, not emitted code

#### Scenario: The CM engine reaches into its page

- **WHEN** a module under `src/cm/engine/` imports from `src/cm/ui/` or from
  `src/app/`
- **THEN** `biome lint` reports the restricted import and exits non-zero,
  while the engine importing `src/model.ts` or `src/types.ts` is reported
  nothing
