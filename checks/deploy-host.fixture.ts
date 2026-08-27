/**
 * A deploy workflow with steps that reach the host, for the cases about what
 * those steps do and what they are given.
 *
 * Written out rather than serialised, as the tag fixtures are: these cases
 * read the file's lines, and `Bun.YAML.stringify` emits the whole document on
 * one flow-style line.
 */
import { REFERENCE, SHA } from "./deploy-tags.fixture.ts";

/**
 * A secret as the workflow reads it. Assembled rather than written plain:
 * `${{` in a quoted string is a template placeholder to the linter, and the
 * warning would be about this file's own text.
 */
export const secret = (name: string) => `\${{ secrets.${name} }}`;

/**
 * How a GitHub expression reaches into a context, in both spellings it accepts.
 *
 * `github.event` and `github['event']` are the same lookup, and so are
 * `secrets.SSH_KEY` and `secrets['SSH_KEY']`. A pattern written for the dotted
 * form alone reads a workflow using the indexed one as a workflow doing
 * neither, which is the direction that matters: the indexed form is what a
 * name the dotted syntax cannot spell has to be written in.
 *
 * Single quotes only. An expression string is single-quoted in this language
 * and `secrets["SSH_KEY"]` is a parse error, so accepting it would approve an
 * input that fails the run rather than the check.
 */
const lookup = (context: string, name: string) =>
	`${context}\\s*(?:\\.\\s*(${name})|\\[\\s*'(${name})'\\s*\\])`;

/** A context member's name, in the characters GitHub allows one. */
const MEMBER = "[A-Za-z_][A-Za-z0-9_-]*";

/** An expression reaching a value an outsider can choose the text of. */
export const EVENT = new RegExp(`\\$\\{\\{[^}]*${lookup("github", "event")}`);

/** Every secret a text reads, however each reference is spelled. */
export const secretsIn = (text: string) =>
	[...text.matchAll(new RegExp(lookup("secrets", MEMBER), "g"))].map(
		([, dotted, indexed]) => (dotted ?? indexed) as string,
	);

/** Whether a value is one secret and nothing else beside it. */
export const isSecret = (value: string) =>
	new RegExp(`^\\$\\{\\{\\s*${lookup("secrets", MEMBER)}\\s*\\}\\}$`).test(
		value,
	);

/** The action that opens the connection, named without its pin. */
export const SSH = "appleboy/ssh-action";

/** The five values that grant something, and so are the ones held as secrets. */
export const SECRETS = [
	"DOCKERHUB_TOKEN",
	"SSH_KEY",
	"SSH_HOST",
	"SSH_PORT",
	"SSH_USER",
];

/** The host script the deploy runs, in the order the requirement fixes. */
export const SCRIPT = [
	"set -eu",
	"cd /root/d2ass",
	"docker compose pull",
	"docker compose up -d",
];

type Host = {
	script?: string[];
	/** What the step's `with:` names each input, so a case can open one up. */
	inputs?: Record<string, string>;
	permissions?: string;
	concurrency?: string;
	environment?: string;
	pin?: string;
	run?: string;
};

/**
 * A deploy this group's checks have nothing to say about.
 *
 * Every part a case needs to vary is a parameter, and the default of each is
 * what the repository's own file carries — so a fixture differs from the real
 * workflow in exactly the one thing the case is about.
 */
export const hosted = ({
	script = SCRIPT,
	inputs = Object.fromEntries(
		[
			["host", "SSH_HOST"],
			["port", "SSH_PORT"],
			["username", "SSH_USER"],
			["key", "SSH_KEY"],
		].map(([input, name]) => [input, secret(name as string)]),
	),
	permissions = "  contents: read",
	concurrency = `  group: deploy-\${{ github.ref }}\n  cancel-in-progress: false`,
	environment = "    environment: production",
	pin = `${SSH}@${"b".repeat(40)} # v1.2.5`,
	run = "",
}: Host = {}) =>
	`name: Deploy

on:
  push:
    branches: [main]

permissions:
${permissions}

concurrency:
${concurrency}

env:
  REGISTRY: docker.io
  REGISTRY_USER: laidrivm
  IMAGE: laidrivm/d2ass

jobs:
  image:
    runs-on: ubuntu-latest
${environment}
    steps:
      - uses: docker/login-action@${"a".repeat(40)} # v4.6.0
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ env.REGISTRY_USER }}
          password: \${{ secrets.DOCKERHUB_TOKEN }}
      - uses: docker/build-push-action@${"c".repeat(40)} # v7.3.0
        with:
          push: true
          tags: |
            \${{ env.IMAGE }}:latest
            \${{ env.IMAGE }}:${SHA}
${run ? `      - run: ${run}\n` : ""}
  host:
    needs: image
    runs-on: ubuntu-latest
${environment}
    steps:
      - uses: ${pin}
        env:
          ${REFERENCE}: \${{ env.IMAGE }}:${SHA}
        with:
${Object.entries(inputs)
	.map(([name, value]) => `          ${name}: ${value}`)
	.join("\n")}
          envs: ${REFERENCE}
          script: |
${script.map((line) => `            ${line}`).join("\n")}
`;
