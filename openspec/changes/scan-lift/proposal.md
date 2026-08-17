# scan-lift

## Why

Three copies of one left-to-right source scanner stand in the tree, and two of
them are wrong in ways their own specifications already forbid. `PLAN.md` has
carried this as *The rule of two* since `reviewable-diff-gates` deferred it,
and `file-size-cap` step 7.5 shaped a test file around it landing.

Both defects reproduce today:

- `scripts/mutation-floor.ts` — a backtick inside a regex literal opens what
  its scanner takes for a template literal and runs to end of input. Control:
  `exemptions()` over `const re = /[x]/;` + a disable comment returns one
  problem; the same source with `/[`]/` returns none. `mutation-floor`
  §*An equivalent mutant is admitted at the line it occupies* requires the
  check to read the same comments Stryker does, and after a regex literal it
  reads none.
- `scripts/spec-coverage.ts` — its per-line strip stops at an escaped quote, so
  `const s = "he said \"/*\"";` leaves a stray `/*`, the block-comment flag
  sticks, and every `// spec:` citation below it in that file is dropped. The
  failure is loud but blames the wrong thing: the floor reports uncited
  criteria rather than a broken scanner.

`scripts/scan.ts` is the correct scanner and already carries the fix for both
shapes, but neither copy can use it: its only export, `blank`, erases comments,
and both callers exist to read them.

## What Changes

- `scripts/scan.ts` gains an export that hands callers the comments a scan
  found — their text, the line each opens on, and whether it is a block — so a
  caller reading comments uses the same scan as a caller erasing them.
- `scripts/mutation-floor.ts` drops its private `comments()` and switches to
  that export. A disable directive after a regex literal becomes visible.
- `scripts/spec-coverage.ts` drops its per-line strip and derives which lines
  sit inside a block comment from the same export. A citation below an escaped
  quote becomes visible.
- `scripts/mutation-floor-exemptions.test.ts` is emptied of everything about
  scanning. `file-size-cap` step 7.5 made it its own file so this change would
  be surgery on nothing else; what survives splits along the seam the lift
  creates — which comments `exemptions()` reaches goes to a new
  `scripts/mutation-floor-comments.test.ts`, the directive grammar stays in the
  file under its accurate name `scripts/mutation-floor-directives.test.ts`, and
  the scanning cases go to `scripts/scan.test.ts` where they are not already
  covered.
- `CLAUDE.md` gains the rule of two in its Code list. `reviewable-diff-gates`
  prescribed that vehicle — "its own one-line rule, separately" — and the
  nearest rule there today covers only the opposite direction.

## Non-goals

- **The other two rule-of-two candidates.** The tracked-file sweep in three
  copies and the focus-restore idiom in two are their own changes; they share
  the rule this one writes down and nothing else.
- **Making `scan.ts` a parser.** It answers one question per character — what
  encloses it — and the new export answers it for comments rather than for
  code. A caller wanting syntax gets a parser, not this.
- **Widening `scan.ts` beyond `ts` and `css`.** The language table stays what
  the two callers need.
- **Re-measuring the mutation floor.** Making a hidden directive visible can
  move the count; the floor moves with its own reason on its own line, which
  `mutation-floor` already requires, and does not become this change's subject.

## Capabilities

### New Capabilities

None. `scripts/scan.ts` is the shared implementation of checks two existing
capabilities already specify; giving a helper a capability of its own would put
a specification where `CLAUDE.md`'s Code rules already govern the technique.

### Modified Capabilities

- `mutation-floor`: the requirement that the check reads the same comments
  Stryker does gains a scenario pinning the case it fails today — a directive
  below a regex literal.
- `spec-test-traceability`: the requirement that a test cites a criterion in a
  `// spec:` comment gains a scenario pinning the case it fails today — a
  citation below a string holding an escaped quote and a `/*`.

## Impact

- `scripts/scan.ts`, `scripts/scan.test.ts` — the new export and its cases.
- `scripts/mutation-floor.ts` — `comments()` deleted, ~50 lines.
- `scripts/spec-coverage.ts` — the per-line strip and its `ponytail:` comment
  deleted, ~25 lines.
- `scripts/mutation-floor-exemptions.test.ts` (236 lines) — renamed to
  `scripts/mutation-floor-directives.test.ts` and emptied of everything but the
  grammar; `scripts/mutation-floor-comments.test.ts` is new.
- `src/app/module-classes.test.ts` — the existing `blank` caller; unaffected,
  and the check that the lift kept `blank`'s contract.
- `CLAUDE.md` — one Code rule.
- No dependency changes. Both consumers are gates, so a regression in either
  shows as a gate that passes on nothing.
