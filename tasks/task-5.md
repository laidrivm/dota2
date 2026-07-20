# Task 5 — Error tracking for the deployed product

## Context

Error tracking watches the product where tests can't — in production, with
real users. Its output feeds the fix & capture loop: a production error
group is a confirmed mistake, and enters the loop like any review finding.

Facts you must respect:

- **Precondition**: the product must be deployed (or a deployment target
  firmly chosen). If not, STOP and report — this task is premature.
- The ponytail ladder applies to observability too: before proposing any
  SDK, lay out what the deployment platform provides natively (error
  logs, aggregation, alerting) and whether that already suffices. An SDK
  earns its place only for what the platform can't do: grouping across
  releases, alert routing, client-side capture.
- If an SDK is chosen, it is a dependency (full Dependency safety flow +
  `/warm`) and observability is a new long-lived domain — the
  skill-vendoring suggestion rule from CLAUDE.md applies.
- Server errors follow RFC 9457 with a machine-readable `code`. Grouping
  and fingerprinting in the tracker must key off that `code`, never off
  message strings — messages change and get translated; codes are the
  contract.

## Steps

### 1. Decide the capture layer

Walk the ladder and present the user a short comparison: platform-native
capture vs. one SDK candidate (state what each covers and misses for this
product). The user picks. Do not default to an SDK out of habit.

### 2. Server-side capture

- Report unhandled exceptions and handled-but-5xx responses. Attach the
  problem+json `code`, a request id, and the release/commit identifier.
- Do NOT report 4xx validation outcomes — expected client errors are
  contract behaviour, not defects; they'd bury real signals.
- Never let the reporting call itself break a response: capture must be
  fire-and-forget with its own error swallowed to a local log line.

### 3. Client-side capture (only if a UI exists)

- Global `error` and `unhandledrejection` handlers.
- If the client bundle is minified, wire source-map upload into the build
  so traces are readable; source maps must not be publicly served.

### 4. Alerting

- One channel, two triggers only: a new error group, and a spike in an
  existing one. No per-occurrence notifications — alert fatigue kills the
  loop faster than missing alerts do.

### 5. Secrets and config

- Keys/DSNs via environment variables, never committed. Follow the
  provider's docs on which values are secret — do not assume.

### 6. Close the loop and document

- Append to README.md operations section: where errors land, how to read
  a group, and the rule that a production error group is a fix & capture
  trigger.
- Propose one line for CLAUDE.md's loop trigger list adding production
  error groups explicitly — add it only after the user confirms.

## Constraints

- Errors only: no APM, tracing, metrics, session replay, or logging
  pipeline in this task — each of those is a separate future decision.
- One provider/layer, chosen in step 1 — never two capture systems.
- No wrapper abstraction around the SDK (a `lib/errors.ts` indirection
  layer) — call it directly until a second consumer proves the need.
- Do not modify API error shapes — the tracker adapts to RFC 9457, not
  the other way around.

## Acceptance criteria

- [ ] Step 1 comparison was shown and the user made the choice explicitly.
- [ ] Server capture reports 5xx/unhandled with `code`, request id, and
      release id; 4xx are excluded; reporting failures can't break
      responses.
- [ ] Client handlers present iff a UI exists; source maps wired and not
      publicly exposed if the bundle is minified.
- [ ] Alerting: one channel, new-group + spike only.
- [ ] No secrets in the repo.
- [ ] README documents the flow; the CLAUDE.md trigger line was proposed
      to the user.
- [ ] Nothing beyond error capture was configured (no APM/tracing/etc.).
