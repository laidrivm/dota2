# hero-reference

## MODIFIED Requirements

### Requirement: The mirrored images are served from the application's origin

A request for a hero's `icon` path SHALL be answered `200` with
`content-type: image/png` and `cache-control: public, max-age=31536000,
immutable`. The filename carries the hero, and the bytes under a given name
never change, which is the same reason the font routes are cached forever.

A request naming a file the mirror does not hold SHALL be answered `404` with
an empty body. There is no error envelope to shape: `harness/api-design.md`'s
RFC 9457 rule reaches a response that carries a body, and this one carries
none.

The route SHALL resolve the directory's contents per request rather than at
startup, because the job writes that directory while the server is running, and
SHALL serve no path outside it.

#### Scenario: A mirrored image

- **WHEN** a request names the `icon` path a hero carries
- **THEN** the response SHALL be `200` carrying the mirrored bytes,
  `content-type: image/png` and the immutable cache header

#### Scenario: A name the mirror does not hold

- **WHEN** a request names an image file absent from the mirror
- **THEN** the response SHALL be `404` with an empty body

#### Scenario: A path that climbs out

- **IF** a request names a path that resolves outside the mirror directory
- **THEN** no file outside it SHALL be served

#### Scenario: A file written after the server started

- **WHEN** the ingest adds a hero's image while the server is running
- **THEN** the next request for it SHALL be answered from that file, with no
  restart
