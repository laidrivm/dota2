# tracked-file-sweep — tasks

One group, so this change ships whole on `feat/tracked-file-sweep`. It closes
the four criteria of the new `tracked-file-sweep` capability. Three of them are
tests; the fourth, *A second listing is introduced*, is a review verdict and
task 1.10 is what a reviewer runs.

## 1. One sweep, six call sites

- [ ] 1.1 Recount the copies before writing any of them. This list was three
      when `PLAN.md` recorded it and is five plus an inline sixth now; take the
      count from `grep -l show-toplevel` over tracked `.ts`/`.tsx` rather than
      from this file, and reconcile the two here. A seventh that arrived since
      is the case this task exists for
- [ ] 1.2 Write the sweep in `scripts/tracked.ts`, exporting the root and the
      tracked paths relative to it, with the three reasons carried as comments:
      the listing taken at the root and not `cwd`, only git's terminator
      stripped and not `trim()`, and regular files only
- [ ] 1.3 Test it in `scripts/tracked.test.ts` on the three cases the copies
      between them do not cover: run from a subdirectory it still lists the
      whole repository with root-relative paths; a tracked file deleted from
      the work tree is skipped; a repository whose path ends in a space keeps
      the space. Fabricate the repository — the last case cannot be observed in
      this one. These are the capability's first three criteria; cite each with
      a `// spec:` line
- [ ] 1.4 Switch `scripts/no-suppressions.ts`. Run the gate before and after
      and record that it reports the same findings on today's tree
- [ ] 1.5 Switch `scripts/spec-coverage.ts` — `check()`'s root and `tests()`'s
      listing are the same sweep. Record the uncited count before and after; it
      does not move
- [ ] 1.6 Switch `scripts/file-size.ts`. Record the file count it measures
      before and after
- [ ] 1.7 Switch `src/app/module-classes.test.ts` and
      `src/app/styles/styles.test.ts`, which is where `trim()` leaves. Record
      the assertion counts before and after: these two are tests, so "reports
      the same" means the same set of files reaches the assertions
- [ ] 1.8 Decide `scripts/file-size.test.ts`'s inline copy at line ~179 — the
      extension enumeration. Switch it, or leave it and write the reason on
      that line, naming what independence the copy buys. An undecided copy is
      how the count reached five
- [ ] 1.9 Delete the three "the shape `scripts/no-suppressions.ts` uses"
      comments left behind at the switched sites: the comment existed because
      the code could not be shared, and it now points at a file that no longer
      owns the sweep
- [ ] 1.10 Re-run `grep -l show-toplevel` and confirm the only tracked
      non-fixture hit is `scripts/tracked.ts`, or name each remaining hit with
      why it stands
- [ ] 1.11 Measure `scripts/tracked.ts` and every switched file against its cap
      and record the numbers
