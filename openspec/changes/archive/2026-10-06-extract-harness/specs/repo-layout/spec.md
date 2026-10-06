# repo-layout

## REMOVED Requirements

### Requirement: A check reads the tracked tree from the repository root

**Reason**: The requirement governs the shared harness, not d2ass, and moves with the code it governs.

**Migration**: Carried unchanged to `openspec/specs/repo-layout/spec.md` in `laidrivm/harness`, where a later change re-words it for any consumer.

### Requirement: The repository root holds only what is exempted by name

**Reason**: The requirement governs the shared harness's root check, not d2ass, and moves with the code and tests it governs. The files d2ass allows at its root are a value `harness-consumption` keeps here, in `package.json`'s `harness.rootFiles`.

**Migration**: Carried unchanged to `openspec/specs/repo-layout/spec.md` in `laidrivm/harness`, where a later change re-words it for any consumer.

### Requirement: The README states where each kind of file lives

**Reason**: The requirement governs the shared harness's README layout check, not d2ass, and moves with the code and tests it governs. d2ass's README keeps its section, and `harness-consumption` asserts the check passes over it.

**Migration**: Carried unchanged to `openspec/specs/repo-layout/spec.md` in `laidrivm/harness`, where a later change re-words it for any consumer.
