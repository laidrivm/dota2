# skill-provenance

## REMOVED Requirements

### Requirement: Every gate skill records the commit it was verified against

**Reason**: The skills are now installed from a package pinned to a commit in `bun.lock`, so the commit a gate runs at is recorded by the lockfile rather than typed into a table.

**Migration**: `harness-consumption` §*The harness is one dependency pinned to a commit* and §*The skills resolve from the pinned package*. The table and its test are deleted; the capability is not re-created in the harness.

### Requirement: Skills no gate depends on are marked archived

**Reason**: The skills are now installed from a package pinned to a commit in `bun.lock`, so the commit a gate runs at is recorded by the lockfile rather than typed into a table.

**Migration**: `harness-consumption` §*The harness is one dependency pinned to a commit* and §*The skills resolve from the pinned package*. The table and its test are deleted; the capability is not re-created in the harness.

### Requirement: The table is pinned by a test, within what a clone can see

**Reason**: The skills are now installed from a package pinned to a commit in `bun.lock`, so the commit a gate runs at is recorded by the lockfile rather than typed into a table.

**Migration**: `harness-consumption` §*The harness is one dependency pinned to a commit* and §*The skills resolve from the pinned package*. The table and its test are deleted; the capability is not re-created in the harness.
