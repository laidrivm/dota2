# cm-meta-import delta — captains-mode-assistant

## Purpose

The dota2protracker meta the captain uploads for the Captains Mode model:
which files the upload accepts, how each position is kept on the server, and
how the model reads hero strength from it in place of the statistics snapshot.

## ADDED Requirements

### Requirement: An upload carries one position of the Pubs 7000+ meta

`POST /api/cm/meta` SHALL accept the body of dota2protracker's meta data
file for one position at 7000+ MMR, of at most 5 MB. WHEN it holds at least
50 heroes whose ids the snapshot knows and whose rating is not null, all at
one position `pos 1`–`pos 5`, every rating null or within 0–100 and not all
of them equal, the server SHALL store that position, replacing its previous
upload, and answer 200.

#### Scenario: A valid upload for one position

- **WHEN** a signed-in captain posts the fixture file for `pos 3`
- **THEN** the response SHALL be 200 with `{"position":3,"heroes":<count>,
  "patch":<string>,"uploadedAt":<ISO 8601 with offset>}`
- **AND** `GET /api/cm/meta` SHALL return that position's heroes, every
  other position's entry unchanged

#### Scenario: An upload that is not the meta file

- **WHEN** the body is not JSON, is JSON of another page, mixes two
  positions, carries fewer than 50 known rated heroes, a rating outside
  0–100, ratings all equal, or
  exceeds 5 MB
- **THEN** the response SHALL be 422 with `code` `"not-d2pt-meta"` (413 with
  `"too-large"` for the size), and the stored meta SHALL be unchanged

### Requirement: The stored meta is served whole

`GET /api/cm/meta` SHALL answer 200 with `{"positions":{"1":…,"5":…}}`,
every one of the five keys present, each either `null` or `{patch,
uploadedAt, heroes}`, `heroes` mapping a hero id to `{rating, tier,
matches, winRate, phaseWinRates:{first, second, last}}` with absent values
`null`. The meta SHALL outlive a restart and a redeploy.

#### Scenario: Nothing uploaded yet

- **WHEN** no upload has been made
- **THEN** the response SHALL be 200 with all five positions `null`

### Requirement: The model takes hero strength from the upload where it exists

For a position whose meta is uploaded, the model SHALL use as `meta(h, k)`
the hero's rating mapped linearly so that 50 is 0 and the ratings' spread
matches the snapshot's meta spread at that position; a hero without a rating
there SHALL count as unable to play it. Positions without an upload SHALL
keep the snapshot's meta.

#### Scenario: One position uploaded

- **WHEN** only `pos 1` is uploaded
- **THEN** meta at position 1 SHALL come from the upload, a rating of 50
  giving 0, and meta at positions 2–5 SHALL equal the snapshot's

#### Scenario: The page names where its meta comes from

- **WHEN** the board is shown
- **THEN** it SHALL show, per position, either the upload's patch and date or
  that the snapshot is used, with a link to the page that file is
  downloaded from
