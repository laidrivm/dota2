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
	"cross-origin": {
		status: 403,
		title: "Cross-origin request",
		detail: "The CM API answers its own origin only.",
		action: null,
	},
	"too-many-attempts": {
		status: 429,
		title: "Too many sign-in attempts",
		detail:
			"Ten wrong passwords arrived within fifteen minutes, so sign-in is paused.",
		action: "Wait the seconds Retry-After names, then sign in again.",
	},
	"not-found": {
		status: 404,
		title: "Not found",
		detail: "No CM API route answers this path and method.",
		action: null,
	},
	internal: {
		status: 500,
		title: "Internal error",
		detail: "The CM API failed while answering this request.",
		action: "Try again; if it repeats, the server log names the failure.",
	},
	"too-large": {
		status: 413,
		title: "Request body too large",
		detail: "The request body is larger than this route accepts.",
		action: null,
	},
	"invalid-body": {
		status: 422,
		title: "Invalid request body",
		detail: 'The body must be JSON of the form {"password": string}.',
		action: null,
	},
	"not-d2pt-meta": {
		status: 422,
		title: "Not a d2pt meta file",
		detail:
			"The body is not dota2protracker's meta data file for one position: at least 50 rated heroes the snapshot knows, ratings 0–100 and not all equal.",
		action:
			"Save the position's data file from the link the CM page gives, and upload that file.",
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
	"report-not-configured": {
		status: 503,
		title: "The draft report is not configured",
		detail:
			"The deployment sets no ANTHROPIC_API_KEY, so no report can be written.",
		action:
			"Set ANTHROPIC_API_KEY in the deployment's environment and restart the application.",
	},
	"report-failed": {
		status: 502,
		title: "The draft report failed",
		detail: "The model did not answer this request.",
		action: "Try again shortly.",
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
