# deployment-topology — delta spec

## ADDED Requirements

### Requirement: The application is reachable only through the proxy

The compose project SHALL publish no port on the host. The application
container SHALL attach to the reverse proxy's existing external network, and
the proxy SHALL reach it by container name.

A published port is a second way in, unencrypted, beside the proxy that exists
to terminate TLS — and it is reachable from the internet the moment it is
bound, whatever the proxy is configured to do.

#### Scenario: The project brought up

- **WHEN** the compose project is up
- **THEN** no service in it SHALL have bound a port on the host

#### Scenario: The proxy reaching the application

- **WHEN** the reverse proxy forwards a request to the application
- **THEN** it SHALL resolve it by container name over the shared network,
  with no host port involved

### Requirement: The database is reachable only from this project

The database SHALL attach to a network private to this compose project and
SHALL NOT attach to the shared proxy network. The application and the job
SHALL attach to both.

The shared network is shared: every other application on the host sits on it,
and a database placed there is reachable by all of them, on a port protected
by a password in an `.env` file and by nothing else. Nothing outside this
project has a reason to open a connection, and the network is the place to
say so — a credential is what stops a caller who is authorised to try, not one
who should never have been able to reach the port.

#### Scenario: A container on the shared network

- **IF** a container attached only to the shared proxy network attempts a
  connection to the database
- **THEN** it SHALL NOT resolve or reach it

#### Scenario: The job reaching the database

- **WHEN** the job runs
- **THEN** it SHALL reach the database over the project's private network

#### Scenario: The database on the host

- **WHEN** the project is up
- **THEN** the database SHALL have bound no port on the host, its only
  callers being on the private network

### Requirement: The bundle and the icon mirror are one set of files, shared

The application and the job SHALL mount the same two named volumes, at the
paths the server resolves for the publication directory and the icon mirror.
A bundle the job publishes SHALL be served by the running application without
restarting it, and a hero image the ingest mirrors SHALL be served the same
way.

This is what the deployment exists to arrange. The job writes both
directories and the server reads both; the server resolves each per request
rather than at start, so the shared mount is sufficient and no restart, no
rebuild and no signal is part of publishing.

#### Scenario: A bundle published while the application is running

- **WHEN** the job completes an export and `/snapshot.json` is requested
  afterwards
- **THEN** the newly published bundle SHALL be served, by the same process
  that was running before it

#### Scenario: A hero mirrored while the application is running

- **WHEN** the ingest mirrors an image for a hero seen for the first time
- **THEN** a request naming that image SHALL be answered from the mirror,
  without the application having been restarted
