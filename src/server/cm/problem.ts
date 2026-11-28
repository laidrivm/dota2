/**
 * The CM API's one error shape: RFC 9457 problem details with the two
 * extension fields `harness/api-design.md` asks for, a machine-readable
 * `code` and an `action` the caller can take, `null` when there is none.
 */
import { z } from "zod";

export const Problem = z.object({
	type: z.literal("about:blank"),
	title: z.string(),
	status: z.number().int(),
	detail: z.string(),
	code: z.string(),
	action: z.string().nullable(),
});

export type Problem = z.infer<typeof Problem>;

/** Every problem the CM API answers with, by its `code`. */
const PROBLEMS = {
	"invalid-body": {
		status: 422,
		title: "Invalid request body",
		detail: 'The body must be JSON of the form {"password": string}.',
		action: null,
	},
	"wrong-password": {
		status: 401,
		title: "Wrong password",
		detail: "The password does not match the one this deployment set.",
		action: "Check the password and sign in again.",
	},
	"not-signed-in": {
		status: 401,
		title: "Not signed in",
		detail: "This request carries no valid CM session.",
		action: "Sign in on /cm with the CM password.",
	},
	"cm-not-configured": {
		status: 503,
		title: "CM is not configured",
		detail:
			"The deployment sets no usable CM password, so the CM API stays closed.",
		action:
			"Set CM_PASSWORD, 12 characters or more, in the deployment's environment and restart the application.",
	},
} as const satisfies Record<string, Omit<Problem, "type" | "code">>;

export type ProblemCode = keyof typeof PROBLEMS;

/** The response for `code`, validated against the schema it promises. */
export function problem(code: ProblemCode): Response {
	const { status, ...rest } = PROBLEMS[code];
	const body = Problem.parse({ type: "about:blank", status, code, ...rest });
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/problem+json" },
	});
}
