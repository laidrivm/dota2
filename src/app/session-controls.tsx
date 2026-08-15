import { ROLES, type Role, type Session, type Side } from "../types.ts";
import { cx } from "./cx.ts";
import type { Action } from "./session.ts";
import s from "./session-controls.module.css";

export const SIDE_LABEL: Record<Side, string> = {
	radiant: "Radiant",
	dire: "Dire",
};

const SIDES: { side: Side; hotkey: string }[] = [
	{ side: "radiant", hotkey: "R" },
	{ side: "dire", hotkey: "D" },
];

export const ROLE_UI: Record<Role, { label: string; letter: string }> = {
	1: { label: "Carry", letter: "C" },
	2: { label: "Mid", letter: "M" },
	3: { label: "Offlane", letter: "O" },
	4: { label: "Semi-support", letter: "S" },
	5: { label: "Full-support", letter: "F" },
};

/**
 * Native radios, styled to the design's chips: the group semantics, the
 * selected state, arrow-key navigation and the label association all come
 * from the platform rather than from ARIA.
 */
export function SessionControls({
	session,
	apply,
}: {
	session: Session;
	apply: (action: Action) => void;
}) {
	return (
		<div class={s.sessionControls}>
			<fieldset class={s.controlGroup}>
				<legend>Side</legend>
				<div class={s.chips}>
					{SIDES.map(({ side, hotkey }) => (
						<label
							key={side}
							class={cx(
								s.chip,
								side === "radiant" ? s.chipRadiant : s.chipDire,
							)}
						>
							<input
								type="radio"
								name="side"
								value={side}
								checked={session.side === side}
								onChange={() => apply({ kind: "side", side })}
							/>
							<span class={s.kbd}>{hotkey}</span>
							{SIDE_LABEL[side]}
						</label>
					))}
				</div>
			</fieldset>

			<fieldset class={s.controlGroup}>
				<legend>Role</legend>
				<div class={s.chips}>
					{ROLES.map((role) => (
						<label key={role} class={s.chip}>
							<input
								type="radio"
								name="role"
								value={role}
								checked={session.myRole === role}
								onChange={() => apply({ kind: "role", role })}
							/>
							<span class={s.kbd}>{`${role} ${ROLE_UI[role].letter}`}</span>
							{ROLE_UI[role].label}
						</label>
					))}
				</div>
			</fieldset>
		</div>
	);
}
