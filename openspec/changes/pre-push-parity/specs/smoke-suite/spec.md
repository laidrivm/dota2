# smoke-suite — delta spec

## MODIFIED Requirements

### Requirement: The browser suite runs on pull requests and only there

A dedicated workflow SHALL run the smoke suite on `pull_request`. The suite
SHALL NOT be attached to the git hooks or to any other workflow. Its HTML
report SHALL be uploaded as an artifact only when the run fails.

#### Scenario: A green run uploads nothing

- **WHEN** the e2e workflow completes with every test passing
- **THEN** no report artifact SHALL be uploaded

#### Scenario: The push path starts no browser

- **WHEN** a branch is pushed
- **THEN** the pre-push hook SHALL NOT start a browser

This scenario names only the browser. Which checks the hook does run is
`commit-gates`'s to say, and enumerating them here contradicts it: the diff
budget runs on the same path, required by `change-slicing`.
