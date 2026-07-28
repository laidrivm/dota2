# module-boundaries delta specification

## ADDED Requirements

### Requirement: The prediction model never imports from the application layer

`src/model.ts` and `src/types.ts` SHALL NOT import from `src/app/**`. The rule
SHALL be enforced by the linter already wired into the pre-commit hook and
`lint.yml`, not by a bespoke script.

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

### Requirement: No module import cycles

The codebase SHALL contain no import cycle among its own modules, enforced by
the linter across all source files rather than only at the model boundary.

#### Scenario: A cycle between two application modules

- **WHEN** `src/app/session.ts` imports from `src/app/board/board.tsx`, which
  already imports `src/app/session.ts`
- **THEN** `biome lint` reports the cycle on both files and exits non-zero

#### Scenario: The tree as it stands

- **WHEN** the linter runs over the current codebase
- **THEN** it reports no cycle and no restricted import
