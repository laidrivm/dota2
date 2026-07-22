# Spec inbox — unsorted product specs

Landing zone for product specs that have not yet entered the repo through
an OpenSpec artifact or a source file. **Everything here except this file
is gitignored** — the repo is public, the specs are not.

Contents (dropped here by the user, listed in `PLAN.md` → Requirement
sources): `user-stories.md`, `model-spec.md`, `data-model.md`,
`screens-spec.md`, `types.ts`, `fixture-snapshot.json`,
`generate_fixture.py`.

Rules:

- Read from here; never commit from here. A spec leaves this directory by
  being turned into an OpenSpec artifact or a source file under the
  camelCase contract — not by being moved into the tree as-is.
- If a file the plan references is missing, ask the user for it. Do not
  reconstruct a spec from memory.
