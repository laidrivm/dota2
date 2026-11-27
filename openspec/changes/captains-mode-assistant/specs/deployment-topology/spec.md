# deployment-topology delta — captains-mode-assistant

## ADDED Requirements

### Requirement: The CM password reaches the application alone

The application service SHALL receive `CM_PASSWORD` from the deployment's
environment, and the job service SHALL NOT. `.env.example` SHALL name the
variable with no value.

#### Scenario: The password in the compose file

- **WHEN** `docker-compose.yml` and `.env.example` are read
- **THEN** the application service SHALL pass `CM_PASSWORD`, the job service
  SHALL pass no such variable, and `.env.example` SHALL name it empty and say
  that an unset or short one leaves the CM API closed

### Requirement: The application keeps a store of its own

The application SHALL mount a named volume, which the job does not mount, at
the directory it keeps uploaded CM meta in, so an upload outlives a restart
and a redeploy.

#### Scenario: The store in the compose file

- **WHEN** `docker-compose.yml` is read
- **THEN** the application service SHALL mount a named volume at its CM store
  path, the job service SHALL mount none at that path, and the volume SHALL be
  declared at the top level
