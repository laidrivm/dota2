/**
 * The deploy workflow as the tag, host-reference and rollback cases read it.
 *
 * Written out rather than serialised: those cases read the file's lines, and
 * `Bun.YAML.stringify` emits the whole document on one flow-style line. Split
 * from `deploy-workflow.fixture.ts`, which carries what the gate cases read,
 * because one file holding both is over the line cap.
 */

/** The action that builds and pushes, named without its pin. */
export const BUILDER = "docker/build-push-action";

/** What the compose project resolves the image from, on the host and here. */
export const REFERENCE = "D2ASS_IMAGE";

/**
 * The commit the run is for, as GitHub spells it inside a tag.
 *
 * Escaped in a template literal rather than written plain: `${{` in a quoted
 * string is a template placeholder the linter warns about, and the warning is
 * about this file's own text rather than about anything it checks.
 */
export const SHA = `\${{ github.sha }}`;

/**
 * Whether `text` names `image` as a whole reference rather than as the start
 * of another one.
 *
 * `laidrivm/d2ass-old` contains `laidrivm/d2ass`, and a substring test would
 * read a README left behind by a rename as one that had followed it. Bounded
 * on both sides by the characters a repository name is made of, so the `:`
 * before a tag still counts as the end of one.
 */
export const names = (text: string, image: string) =>
	new RegExp(
		`(?<![\\w./-])${image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w./-])`,
	).test(text);

/**
 * The repository the workflow pushes to, read from it rather than written
 * anywhere a check could restate it: two copies of a name drift the moment
 * either is a value a file states itself.
 */
export const envOf = (deploy: string) =>
	((Bun.YAML.parse(deploy) ?? {}) as { env?: Record<string, string> }).env ??
	{};

export const imageOf = (deploy: string) => envOf(deploy).IMAGE;

/**
 * A tag with the workflow's own `env:` values put in.
 *
 * The real file writes `${{ env.IMAGE }}:latest`, so a tag compared as text
 * against the image would never match the one thing it must. Resolved from
 * what the workflow declares, not from anything restated here.
 */
export const resolve = (tag: string, env: Record<string, string>) =>
	tag.replace(
		/\$\{\{\s*env\.(\w+)\s*\}\}/g,
		(whole, name) => env[name] ?? whole,
	);

/** The two tags a build is meant to push. */
export const TAGS = ["laidrivm/d2ass:latest", `laidrivm/d2ass:${SHA}`];

/**
 * A deploy workflow, written out rather than serialised: the tag cases read
 * `D2ASS_IMAGE` line by line, and `Bun.YAML.stringify` emits one flow-style
 * line for the whole document, which would put every value on the same line as
 * every other.
 */
export const built = ({
	builder = BUILDER,
	push = "true",
	tags = TAGS,
	copies = 1,
	reference = `\${{ env.IMAGE }}:${SHA}`,
} = {}) =>
	`env:
  IMAGE: laidrivm/d2ass
jobs:
  deploy:
    steps:
${Array.from(
	{ length: copies },
	() => `      - uses: ${builder}@${"a".repeat(40)} # v6.20.0
        with:
          push: ${push}
          tags: |
${tags.map((tag) => `            ${tag}`).join("\n")}`,
).join("\n")}
      - uses: appleboy/ssh-action@${"b".repeat(40)} # v1.2.5
        env:
          ${REFERENCE}: ${reference}
        with:
          envs: ${REFERENCE}
          script: |
            set -eu
            docker compose pull
            docker compose up -d
`;

/** A README the rollback cases have nothing to say about. */
export const ROLLBACK = `# d2ass

Some other section.

Roll back by setting ${REFERENCE} to laidrivm/d2ass at the previous commit's
SHA tag, then docker compose pull && docker compose up -d.
`;
