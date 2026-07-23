import type { SnapshotBundle } from "../types.ts";
import { formatProvenance } from "./snapshot.ts";

/** No logo asset exists yet, so the product name is set in plain type. */
export function Header({ bundle }: { bundle: SnapshotBundle }) {
	return (
		<header class="header">
			<span class="brand">Dota 2 Pick Assistant</span>
			<span class="provenance">{formatProvenance(bundle)}</span>
			{bundle.stabilizing && (
				<p class="banner">new patch — stats are still stabilizing</p>
			)}
		</header>
	);
}
