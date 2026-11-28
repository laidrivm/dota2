import { useEffect, useRef, useState } from "preact/hooks";
import { type SignInResult, signIn } from "./api.ts";
import s from "./cm.module.css";

/**
 * The password form the page shows until `/api/cm/session` answers 200.
 * A failure is announced through `role="alert"` and focus is put back in the
 * field — a click on the button would otherwise leave it on the button.
 */
export function SignIn({
	onResult,
}: {
	onResult: (result: Exclude<SignInResult, { kind: "error" }>) => void;
}) {
	const field = useRef<HTMLInputElement>(null);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	// The form is the whole page, so the field is where a visit starts.
	useEffect(() => field.current?.focus(), []);

	const submit = async (event: Event) => {
		event.preventDefault();
		if (busy) return;
		setBusy(true);
		const result = await signIn(password);
		setBusy(false);
		if (result.kind === "error") {
			setError(result.message);
			field.current?.focus();
			field.current?.select();
			return;
		}
		onResult(result);
	};

	return (
		<form class={s.panel} onSubmit={submit}>
			<label class={s.label} for="cm-password">
				CM password
			</label>
			<input
				id="cm-password"
				ref={field}
				class={s.input}
				type="password"
				autocomplete="current-password"
				required
				value={password}
				onInput={(event) => {
					setPassword(event.currentTarget.value);
					// A message about the previous attempt says nothing about this one.
					setError(null);
				}}
				aria-describedby={error === null ? undefined : "cm-sign-in-error"}
			/>
			<button class={s.button} type="submit" disabled={busy}>
				Sign in
			</button>
			{error !== null && (
				<p id="cm-sign-in-error" class={s.error} role="alert">
					{error}
				</p>
			)}
		</form>
	);
}
