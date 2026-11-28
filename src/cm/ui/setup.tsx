import { SIDE_LABEL } from "../../app/session-controls.tsx";
import type { Side } from "../../types.ts";
import s from "./cm.module.css";
import type { CmAction, CmSession, PickOrder } from "./session.ts";

const ORDER_LABEL: Record<PickOrder, string> = {
	first: "First pick",
	second: "Second pick",
};

/**
 * The two choices the board waits for: the side, and whether the captain's
 * team picks first. Independent of each other (cm-draft, *Setup takes the
 * side and the pick order*).
 */
export function Setup({
	session,
	apply,
}: {
	session: CmSession;
	apply: (action: CmAction) => void;
}) {
	return (
		<div class={s.setup}>
			<fieldset class={s.choice}>
				<legend class={s.label}>Side</legend>
				{(["radiant", "dire"] as const satisfies Side[]).map((side) => (
					<label key={side} class={s.option}>
						<input
							type="radio"
							name="cm-side"
							checked={session.side === side}
							onChange={() => apply({ type: "side", side })}
						/>
						{SIDE_LABEL[side]}
					</label>
				))}
			</fieldset>
			<fieldset class={s.choice}>
				<legend class={s.label}>Pick order</legend>
				{(["first", "second"] as const).map((pickOrder) => (
					<label key={pickOrder} class={s.option}>
						<input
							type="radio"
							name="cm-pick-order"
							checked={session.pickOrder === pickOrder}
							onChange={() => apply({ type: "pickOrder", pickOrder })}
						/>
						{ORDER_LABEL[pickOrder]}
					</label>
				))}
			</fieldset>
		</div>
	);
}
