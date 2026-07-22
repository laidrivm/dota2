# API design

Indexed from `CLAUDE.md`, which holds the rule quality bar and the
single-source rule this file inherits.

The API is a product; its consumer is a TypeScript frontend. Contract rules
— all checkable in a diff:

- Every endpoint responds through an explicit response schema (zod/typebox
  or equivalent) — never a raw ORM/DB object. The TypeScript response type
  derives from that schema, not the other way round.
- Honest types: booleans are `true`/`false` (never 0/1), enums are strings
  (`"published"`, not magic numbers), dates are ISO 8601 with offset.
- Every contract key is always present; an absent value is `null`. No
  dynamic or conditional keys.
- camelCase everywhere in JSON — including error bodies and pagination
  metadata.
- IDs are UUIDv7 via `Bun.randomUUIDv7()` (time-sortable) — never
  incremental integers, no ulid/uuid packages.
- Display-ready fields are computed server-side once (assembled URLs,
  initials) instead of in every consumer.
- Errors follow RFC 9457 (`application/problem+json`) with two extension
  fields: a machine-readable `code` (frontend logic keys off codes, never
  off message strings) and an `action` hint, `null` when the user can do
  nothing about the error.
- CORS is configured server-side together with the first endpoint — a
  consumer staring at a CORS error means the backend isn't finished.
- List endpoints use cursor pagination unless the list is small and
  internal-only.

Architecture defaults (SSE vs WebSockets, BFF response shaping, caching,
N+1 policy) live in the `context:` field of `openspec/config.yaml` — apply
them at propose time.
