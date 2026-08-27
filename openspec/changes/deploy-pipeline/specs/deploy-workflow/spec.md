# deploy-workflow — delta spec

## ADDED Requirements

### Requirement: A deploy runs only against a commit the checks have passed

The deploy SHALL NOT build an image, push one, or open a connection to the
host unless the repository's correctness checks — the linter, the type
checker, the unit suite and the end-to-end suite — have completed
successfully **against the commit being deployed**.

The commit, not the branch, is what the gate is about. Every check in this
repository triggers on `pull_request` alone, and a squash merge puts a commit
on `main` that no check has ever run against: the tree may match what was
reviewed while the commit does not, and a workflow trusting the branch would
be trusting a run over a different object. This is the defect the pattern
source carries — its deploy job triggers on push and its check job on pull
request, so nothing connects them and a push to `main` deploys unchecked.

The connection SHALL be expressed inside the deploy workflow, as jobs it
depends on, rather than left to repository settings. Branch protection is not
visible in the tree, is not reviewed with the change, and is overridable by
the person merging; a reader of the workflow must be able to see what gates
it.

The gate list SHALL NOT be restated in the deploy workflow. The checks are
already defined once each, and a second copy of the commands is a list that
drifts from the first.

#### Scenario: A commit whose checks fail

- **WHEN** a commit reaches `main` and one of the checks fails against it
- **THEN** no image SHALL be pushed and the host SHALL NOT be contacted

#### Scenario: The gate is readable in the workflow

- **WHEN** the deploy workflow is read
- **THEN** the checks that gate it SHALL be named in it as dependencies, and
  the reader SHALL NOT have to consult repository settings to learn what
  gates a deploy

#### Scenario: The commands are defined once

- **IF** the deploy workflow spells out a check's own command rather than
  depending on the workflow that owns it
- **THEN** the change SHALL be rejected — the gate list has one home, and a
  copy of it is checked by nothing

### Requirement: Every deployed image is named by the commit it was built from

Each build SHALL push the image under two tags: the commit's full SHA and
`latest`. The SHA tag is what makes a rollback possible — the previous
release is an image that still exists under a name nothing overwrites — and
`latest` is what the host's compose file resolves.

The README SHALL state the rollback: which tag to pull, and that bringing the
host up on it is the whole of the operation. A rollback nobody has written
down is a rollback performed under pressure from memory.

#### Scenario: A deploy completes

- **WHEN** the workflow finishes for a commit
- **THEN** the registry SHALL hold that image under both the commit's SHA and
  `latest`

#### Scenario: A release that has to be undone

- **WHEN** a deployed release is found broken
- **THEN** the README SHALL name the steps that put the host back on a
  previous commit's image, using a tag the newer deploy did not overwrite

### Requirement: The running container is replaced only once its replacement is on the host

The deploy SHALL pull the new image onto the host before the running
container is stopped. Stopping first makes the download part of the outage,
so an image that is slow to pull — or one that cannot be pulled at all —
turns a deploy into a service that is down and not coming back.

#### Scenario: The image is pulled first

- **WHEN** the deploy's steps on the host are read in order
- **THEN** the pull SHALL precede anything that stops or replaces the running
  container

#### Scenario: A pull that fails

- **IF** the image cannot be pulled onto the host
- **THEN** the previously running container SHALL still be serving when the
  deploy reports failure

### Requirement: The deploy workflow is held to the hygiene the others already practise

The deploy workflow SHALL pin every action it uses by full commit SHA with
the version as a trailing comment, SHALL declare a `permissions:` block
granting no scope it does not use, SHALL declare a concurrency group, and
SHALL interpolate no `github.event.*` value into a `run:` block.

None of this is new practice: all six workflows already in the repository do
every one of it. It is written here because it is practised and stated
nowhere — no rule in `CLAUDE.md`, no criterion in any capability — and this
workflow is the one that holds a deploy key. The scope is deliberately this
workflow alone: generalising the same criteria to every workflow in the tree
is worth doing and is not this change's, since it needs a check over all of
them and a home that is not a capability about deploying.

`github.event.*` is singled out because its values are attacker-controllable
in a way the rest are not — a branch or title carrying shell metacharacters
becomes shell when a `run:` block interpolates it, where reading the same
value through `env:` never does.

#### Scenario: An action pinned by tag

- **IF** a `uses:` in the deploy workflow names an action by tag or branch
  rather than by a full commit SHA
- **THEN** the check SHALL fail — a tag is mutable, and this one is mutable
  in a workflow holding a deploy key

#### Scenario: A pin with no version beside it

- **IF** a `uses:` names a commit SHA and carries no version comment
- **THEN** the check SHALL fail — a bare forty-character SHA tells a reader
  nothing about what it is or how far behind it has fallen

#### Scenario: The permissions the workflow takes

- **WHEN** the deploy workflow is read
- **THEN** it SHALL declare `permissions:` explicitly rather than inherit the
  repository default

#### Scenario: An event value reaching a shell

- **IF** a `run:` block interpolates a `github.event.*` value
- **THEN** the check SHALL fail

### Requirement: A value is a secret only when disclosing it would grant something

The Docker Hub token and the SSH private key SHALL be secrets of a
`production` GitHub environment, so a deploy is gated on that environment
rather than on the workflow file alone. The SSH host, port and user SHALL be
secrets as well: this repository is public, and the host listens for SSH on a
port that is not the default one.

The registry, the image repository and the container names SHALL be written
in the workflow in the open. They grant nothing — the registry repository is
public and the names are visible to anyone who reaches the host — and holding
a non-secret in the secret store hides from a reader what the workflow
actually deploys, while the store's own contents become impossible to audit
for what is really sensitive.

#### Scenario: A non-secret in the secret store

- **IF** the workflow reads the registry, the image repository or a container
  name from `secrets`
- **THEN** the change SHALL be rejected — none of them grants anything, and
  the workflow becomes unreadable in exchange for nothing

#### Scenario: The host's address in a public repository

- **WHEN** the workflow names the machine it deploys to
- **THEN** the host, the port and the user SHALL come from secrets, the
  repository being public and the port not the default

#### Scenario: A deploy from a branch that is not the default

- **IF** a workflow run that is not on `main` reaches the deploy job
- **THEN** the `production` environment SHALL be what stands between it and
  the host, rather than the job's own conditions alone
