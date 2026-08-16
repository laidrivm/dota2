# module-boundaries — delta spec

## MODIFIED Requirements

### Requirement: No module import cycles

The codebase SHALL contain no import cycle among its own modules, enforced by
the linter across all source files rather than only at the model boundary.

#### Scenario: A cycle between two application modules

- **WHEN** `src/app/session.ts` imports from `src/app/board/pieces.tsx`, which
  already imports `src/app/session.ts`
- **THEN** `biome lint` reports the cycle on both files and exits non-zero

#### Scenario: The tree as it stands

- **WHEN** the linter runs over the current codebase
- **THEN** it reports no cycle and no restricted import
