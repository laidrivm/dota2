# tracked-file-sweep — tasks

Two groups, so this change ships one pull request per group in the order below:
`feat/tracked-file-sweep-1`, then `-2`. Split because the capability carries
four acceptance criteria and a step takes one to three. The seam is real rather
than arithmetic: group 1 leaves a module with tests and no callers, which
breaks nothing, and group 2 is where the tree stops holding six listings.

## 1. The sweep and its three behaviours

Closes *A check run from a subdirectory*, *A tracked file absent from the work
tree* and *A repository path ending in a space*.

- [ ] 1.1 Recount the copies before writing any of them. This change's own
      prose says five plus an inline sixth, and `PLAN.md` said three before
      that; take the count from `grep -l 'show-toplevel\|ls-files'` over
      tracked `.ts`/`.tsx` and reconcile it against both. A seventh that
      arrived since is the case this task exists for (*all three*)
- [ ] 1.2 Write the sweep in `scripts/tracked.ts`, exporting the root and two
      views over one listing — git's paths, and the regular files among them —
      with the three reasons carried as comments: the listing taken at the root
      and not `cwd`, only git's terminator stripped and not `trim()`, and why a
      caller that opens what it reads takes the filtered view (*all three*)
- [ ] 1.3 Test it in `scripts/tracked.test.ts`, one case per criterion, each
      with its `// spec:` citation: run from a subdirectory it still lists the
      whole repository with root-relative paths (*A check run from a
      subdirectory*); a tracked path deleted from the work tree is absent from
      the filtered view and present in the unfiltered one (*A tracked file
      absent from the work tree*); a repository whose path ends in a space
      keeps the space (*A repository path ending in a space*). Fabricate the
      repository — the last case cannot be observed in this one
- [ ] 1.4 Measure `scripts/tracked.ts` and `scripts/tracked.test.ts` against
      the 300-line cap and record the numbers (*none — infrastructure*)

## 2. Six call sites and no seventh

Closes *A second listing is introduced*.

- [ ] 2.1 Switch `scripts/no-suppressions.ts`. Run the gate before and after
      and record that it reports the same findings on today's tree. Its comment
      says "an ignored or untracked file cannot fail a clone that does not have
      it", which conflates the two — an ignored file that is tracked is in
      every clone; correct it to name untracked files while the line is open
      (*A second listing is introduced*)
- [ ] 2.2 Switch `scripts/spec-coverage.ts` — `check()`'s root and `tests()`'s
      listing are the same sweep. Record the uncited count before and after; it
      does not move (*A second listing is introduced*)
- [ ] 2.3 Switch `scripts/file-size.ts`. Record the file count it measures
      before and after (*A second listing is introduced*)
- [ ] 2.4 Switch `src/app/module-classes.test.ts` and
      `src/app/styles/styles.test.ts`, which is where `trim()` leaves. Record
      the assertion counts before and after: these two are tests, so "reports
      the same" means the same set of files reaches the assertions (*A second
      listing is introduced*)
- [ ] 2.5 Switch `scripts/file-size.test.ts`'s inline copy at line ~179 to the
      unfiltered view. It applies no `lstatSync` filter on purpose — a tracked
      path deleted from the work tree still carries an extension somebody has
      to rule on — so confirm the extension set it asserts is unchanged, which
      is what proves the view is the right one (*A second listing is
      introduced*)
- [ ] 2.6 Write the check the criterion names: a test failing when any tracked
      source file other than `scripts/tracked.ts` and its own test invokes
      `git ls-files` or `git rev-parse --show-toplevel`. Scope it by what it
      exempts, per `CLAUDE.md`, and cite the criterion. Break-check it by
      reintroducing one listing and watching it fail (*A second listing is
      introduced*)
- [ ] 2.7 Delete the three "the shape `scripts/no-suppressions.ts` uses"
      comments left behind at the switched sites: the comment existed because
      the code could not be shared, and it now points at a file that no longer
      owns the sweep (*A second listing is introduced*)
- [ ] 2.8 Measure every switched file against its cap and record the numbers
      (*none — infrastructure*)
