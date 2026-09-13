# bun-version-sites — tasks

Three steps, so this change ships as three pull requests on
`feat/bun-version-sites-1`, `-2` and `-3`, in that order.

The `agent-permissions` delta modifies one requirement whole and so carries
eight criteria this change does not close — every scenario of that requirement
but *An alias outside the install family*, which step 3 closes. They describe
the gated surface, which no task here touches.

## 1. The three kinds of site, read and compared

Closes `toolchain-pins/a-workflow-input-left-behind`,
`toolchain-pins/the-manifest-raised-on-its-own`,
`toolchain-pins/the-image-raised-on-its-own`.

- [ ] 1.1 Write the three failing cases first, over a fabricated tree rather
      than this repository — every site here already reads `1.4.2`, so a case
      against the live files could never fail and would pin nothing. One
      workflow input behind; `@types/bun` ahead; the `oven/bun` tag ahead
      (*a-workflow-input-left-behind*, *the-manifest-raised-on-its-own*,
      *the-image-raised-on-its-own*)
- [ ] 1.2 Read each site through the parser its own tool uses: `Bun.YAML`
      for the workflow inputs, walked as `jobs.*.steps[*].with["bun-version"]`
      and not grepped; `JSON` for `@types/bun`; the `oven/bun:` prefix for the
      tag. Name in the code why the last is matched by prefix — it is the one
      site with no parser of its own
      (*a-workflow-input-left-behind*, *the-image-raised-on-its-own*)
- [ ] 1.3 Make the failure name every site and the version each carries, and
      assert that text rather than only the exit — a check reporting that
      thirteen sites disagree, without saying which, sends a reader to count
      them (*the-manifest-raised-on-its-own*)
- [ ] 1.4 Run it over this repository and record that it passes with every
      site at `1.4.2`, which is the control that 1.1's cases fail for the
      reason they name rather than because the check refuses everything

## 2. The edges the walk must not skip

Closes `toolchain-pins/a-job-added-without-a-version`,
`toolchain-pins/every-site-agreeing`.

- [ ] 2.1 Write the failing case first: a workflow job that uses
      `oven-sh/setup-bun` and states no `bun-version`
      (*a-job-added-without-a-version*)
- [ ] 2.2 Walk every workflow file, every job and every step, failing on a
      `setup-bun` step with no version rather than skipping it. Scope the walk
      by what it exempts, per `CLAUDE.md`, and name the exemption in the code
      — an enumeration of the jobs that matter is the count this change
      removes (*a-job-added-without-a-version*)
- [ ] 2.3 Assert the passing case says nothing about whether the agreed
      version is current, by fabricating a tree where every site reads a
      version years old and expecting a pass — a check that quietly demanded
      the newest would fail here and would be a different requirement
      (*every-site-agreeing*)
- [ ] 2.4 Confirm the count in `PLAN.md` is now read from nowhere: the check
      names no figure, and its cases assert sites rather than how many

## 3. Which pins have an updater, and the alias clause the check outgrew

Closes `toolchain-pins/the-workflow-inputs-are-the-pins-with-no-updater`,
`toolchain-pins/an-ecosystem-entry-removed`,
`agent-permissions/an-alias-outside-the-install-family`.

- [ ] 3.1 Write the failing case first: `.github/dependabot.yml` without its
      `bun` ecosystem entry, against a tree whose `@types/bun` is recorded as
      having an updater (*an-ecosystem-entry-removed*)
- [ ] 3.2 Read the ecosystems from `.github/dependabot.yml` rather than from a
      comment at each site, and assert the mapping: the image tag to `docker`,
      `@types/bun` to `bun`, and the workflow inputs to nothing
      (*the-workflow-inputs-are-the-pins-with-no-updater*,
      *an-ecosystem-entry-removed*)
- [ ] 3.3 Check this does not restate what `checks/container-image.test.ts`
      already asserts about the Dependabot entry that raises the digest; where
      it would, read the same thing from the same place rather than writing a
      second assertion of it
- [ ] 3.4 Widen the alias clause in the `agent-permissions` delta to every
      gated command, and confirm the policy already satisfies it —
      `Bash(bun up *)` is listed and
      `checks/agent-permissions-prompts.test.ts` already reads the alias of
      every gated command, so this step changes a description and not a
      boundary (*an-alias-outside-the-install-family*)
- [ ] 3.5 Delete the `PLAN.md` entry *Ten workflow pins nothing updates*: what
      it asked for is this check, and an entry whose work has shipped leaves
      the queue
- [ ] 3.6 Measure every capped file this change touched and record the
      numbers, whether or not any is over
      (*change-slicing/a-file-over-the-cap*)
- [ ] 3.7 Grep the four places that restate a decision — the change's sibling
      artefacts, `openspec/specs/**`, `PLAN.md` and the README ownership map —
      for a sentence naming the count of workflow pins, and reconcile each
