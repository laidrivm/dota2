# cm-access delta — captains-mode-assistant

## Purpose

The one password that guards the Captains Mode API: how a captain signs in,
how long the session lasts, and what every `/api/cm/` route answers to a
caller without one.

## ADDED Requirements

### Requirement: The password signs a captain in

WHEN `POST /api/cm/session` carries a JSON body whose `password` equals the
configured password, the server SHALL answer 204 and set a cookie
`cm_session` with `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/cm` and
`Max-Age=2592000`. The password SHALL be compared in constant time.

#### Scenario: Signing in with the password

- **WHEN** the configured password is `correct horse battery` and the body
  is `{"password":"correct horse battery"}`
- **THEN** the response SHALL be 204 with a `cm_session` cookie carrying
  exactly those five attributes
- **AND** `GET /api/cm/session` with that cookie SHALL answer 200 with
  `{"signedIn":true,"expiresAt":<ISO 8601 with offset, 30 days on>}`

### Requirement: The API answers nothing without a valid session

Every `/api/cm/` path other than `POST /api/cm/session`, unknown paths
included, SHALL answer 401 with `application/problem+json` and `code`
`"not-signed-in"` WHEN the request carries no `cm_session` cookie, a
malformed one, one whose signature does not verify, or one past its expiry.
Checks run in the order origin, configuration, session, route.

#### Scenario: A request without a valid session

- **WHEN** `GET /api/cm/session` arrives with no cookie, then with a cookie
  whose signature has one character changed, then with a validly signed
  cookie whose expiry is one second in the past
- **THEN** each SHALL be answered 401 with `code` `"not-signed-in"` and an
  `action` naming the sign-in
- **AND WHEN** a captain signs in, the deployment's password is changed, and
  the old cookie is sent again, that request SHALL be answered 401
  `"not-signed-in"` too

### Requirement: An unset password closes the API

IF the configured password is unset, empty, or shorter than 12 characters,
THEN every `/api/cm/` route, sign-in included, SHALL answer 503 with
`code` `"cm-not-configured"` and an `action` naming the variable to set. The
API SHALL never fall back to open access.

#### Scenario: No password configured

- **WHEN** the password variable is absent, then empty, then 11 characters
- **THEN** `POST /api/cm/session` with any body and `GET /api/cm/session`
  SHALL both answer 503 `"cm-not-configured"` in all three cases

### Requirement: Wrong passwords are limited

`POST /api/cm/session` with a wrong password SHALL answer 401 `code`
`"wrong-password"`. WHILE ten wrong passwords have been received within the
last 15 minutes, every sign-in, a right one included, SHALL answer 429 `code`
`"too-many-attempts"` with `Retry-After` set to the seconds until the oldest
of them leaves the window.

#### Scenario: Repeated wrong passwords

- **WHEN** ten wrong passwords arrive within 15 minutes, followed by the
  right one
- **THEN** the first ten SHALL be answered 401 `"wrong-password"` and the
  eleventh 429 `"too-many-attempts"` with a `Retry-After` between 1 and 900
- **AND WHEN** 15 minutes have passed since the first of them, the right
  password SHALL sign in again

### Requirement: Signing out clears the session

`DELETE /api/cm/session` with a valid session SHALL answer 204 and set
`cm_session` empty with `Max-Age=0` and the same `Path`.

#### Scenario: Signing out

- **WHEN** a signed-in captain sends `DELETE /api/cm/session`
- **THEN** the response SHALL be 204 and clear the cookie
- **AND** a following `GET /api/cm/session` without a cookie SHALL be 401

### Requirement: The API serves its own origin only

No `/api/cm/` response SHALL carry an `Access-Control-Allow-Origin` header,
and a request whose `Origin` header names another origin SHALL be answered
403 `code` `"cross-origin"` before any other check.

#### Scenario: A request from another origin

- **WHEN** `POST /api/cm/session` carries the right password and
  `Origin: https://evil.example`
- **THEN** the response SHALL be 403 `"cross-origin"` and set no cookie
- **AND WHEN** the same request carries the deployment's own origin, or no
  `Origin` header at all, the check SHALL pass it on, and no response
  SHALL carry `Access-Control-Allow-Origin`
