import { ROLES, type Role, type Session, type Side } from "../types.ts";
import type { Hotkey } from "./session.ts";

const SIDES: { side: Side; label: string; hotkey: string }[] = [
	{ side: "radiant", label: "Radiant", hotkey: "R" },
	{ side: "dire", label: "Dire", hotkey: "D" },
];

const ROLE_UI: Record<Role, { label: string; letter: string }> = {
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
	apply: (hotkey: Hotkey) => void;
}) {
	return (
		<div class="session-controls">
			<fieldset class="control-group">
				<legend>Side</legend>
				<div class="chips">
					{SIDES.map(({ side, label, hotkey }) => (
						<label key={side} class={`chip chip-${side}`}>
							<input
								type="radio"
								name="side"
								value={side}
								checked={session.side === side}
								onChange={() => apply({ kind: "side", side })}
							/>
							<span class="kbd">{hotkey}</span>
							{label}
						</label>
					))}
				</div>
			</fieldset>

			<fieldset class="control-group">
				<legend>Role</legend>
				<div class="chips">
					{ROLES.map((role) => (
						<label key={role} class="chip">
							<input
								type="radio"
								name="role"
								value={role}
								checked={session.myRole === role}
								onChange={() => apply({ kind: "role", role })}
							/>
							<span class="kbd">{`${role} ${ROLE_UI[role].letter}`}</span>
							{ROLE_UI[role].label}
						</label>
					))}
				</div>
			</fieldset>
		</div>
	);
}
