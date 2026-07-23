/**
 * Dota 2 Pick Assistant — shared type contract.
 *
 * Covers the three data boundaries of the system:
 *   1. SnapshotBundle — what the pipeline publishes and the client consumes
 *      (data-model.md §5); src/fixtures/snapshot.json conforms to it.
 *   2. Session — client draft state persisted to localStorage
 *      (data-model.md §6).
 *   3. Model outputs — what the pure model module returns to the UI
 *      (model-spec.md §1, §3, §4).
 *
 * Conventions:
 *   - All JSON keys are camelCase.
 *   - All winrate-derived values are deltas in percentage points (pp)
 *     relative to 50%. Example: meta = 3.1 means 53.1%.
 *   - All rates/shares/probabilities are fractions in [0, 1].
 *   - Record keys that are hero ids are strings (JSON object keys),
 *     values of HeroId type are numbers.
 */

// ---------------------------------------------------------------------------
// Primitives

export type HeroId = number;

/** Position 1..5: carry, mid, offlane, semi-support, full-support. */
export type Role = 1 | 2 | 3 | 4 | 5;

export type Side = "radiant" | "dire";

/** Pick phase of ranked All Pick (model-spec.md §2). */
export type PickPhase = "p1" | "p2" | "last";

export const ROLES: readonly Role[] = [1, 2, 3, 4, 5] as const;

export const ROLE_LABELS: Record<Role, string> = {
	1: "Carry",
	2: "Mid",
	3: "Offlane",
	4: "Semi-support",
	5: "Full-support",
};

// ---------------------------------------------------------------------------
// 1. Snapshot bundle (published data, immutable)

export interface SnapshotPatch {
	/** e.g. "7.41d" */
	id: string;
	isMajor: boolean;
	/** ISO date the patch was first seen in data. */
	detectedAt: string;
}

export interface HeroPositionStats {
	/** Share of the hero's picks on this position; shares sum to 1 across positions. */
	share: number;
	/** Smoothed winrate delta on this position, pp. 0 when insufficient. */
	meta: number;
	sufficient: boolean;
}

export interface HeroEntry {
	id: HeroId;
	/** Canonical display name: "Clinkz". */
	name: string;
	/** Slug: "clinkz". */
	short: string;
	icon: string;
	/** Legacy names and abbreviations, lowercase: ["bone fletcher"], ["wk"]. */
	aliases: string[];
	/** False → hero excluded from suggestions & counter-risk; neutral in sums. */
	sufficient: boolean;
	/** Contest rate (picked or banned), 0..1. */
	contest: number;
	/** Side deltas relative to the hero's overall winrate, pp. */
	side: Record<Side, number>;
	/** Pick-phase deltas relative to the hero's overall winrate, pp. */
	phase: Record<PickPhase, number>;
	/** Only positions the hero is actually picked on. Keys are Role as string. */
	positions: Partial<Record<`${Role}`, HeroPositionStats>>;
}

/** adv[a][b] — smoothed advantage of hero a over hero b, pp. Antisymmetric, full matrix. */
export type MatchupMatrix = Record<string, Record<string, number>>;

/** syn[a][b] — smoothed ally synergy, pp. Symmetric, full matrix. */
export type SynergyMatrix = Record<string, Record<string, number>>;

export interface SnapshotBundle {
	snapshotId: number;
	/** ISO timestamp of the build. */
	createdAt: string;
	patch: SnapshotPatch;
	/** True during the first days after a major patch → UI banner. */
	stabilizing: boolean;
	heroes: HeroEntry[];
	matchups: MatchupMatrix;
	synergies: SynergyMatrix;
}

// ---------------------------------------------------------------------------
// 2. Session (localStorage, key "draft.session"; backup under "draft.backup")

export interface Session {
	/** Schema version for migrations. */
	v: 1;
	createdAt: string;
	side: Side | null;
	myRole: Role | null;
	bans: HeroId[];
	/** Fixed five slots; null = not picked yet. Keys are Role as string. */
	teamPicks: Record<`${Role}`, HeroId | null>;
	/** Enemy picks, no roles, length ≤ 5. */
	enemyPicks: HeroId[];
}

export const EMPTY_SESSION = (): Session => ({
	v: 1,
	createdAt: new Date().toISOString(),
	side: null,
	myRole: null,
	bans: [],
	teamPicks: { "1": null, "2": null, "3": null, "4": null, "5": null },
	enemyPicks: [],
});

// ---------------------------------------------------------------------------
// 3. Model outputs (pure function of SnapshotBundle + Session)

/** Marginal role probabilities for one enemy pick (model-spec.md §1). */
export interface EnemyRoleInference {
	hero: HeroId;
	/** P(hero plays role r); sums to 1 across roles. */
	probs: Record<`${Role}`, number>;
}

export interface SuggestionEntry {
	hero: HeroId;
	/** Total Score in pp; UI renders as "+2.1%". */
	score: number;
	/** Per-component breakdown in pp (weights already applied) — for debugging/tooltips. */
	components: {
		meta: number;
		side: number;
		phase: number;
		synergy: number;
		matchups: number;
		counterRisk: number;
	};
}

export interface SuggestionBlock {
	role: Role;
	/** True for the user's own role → emphasized, rendered first. */
	isMyRole: boolean;
	/** Top-N candidates, descending by score. */
	entries: SuggestionEntry[];
}

export interface WinEstimate {
	/** Total draft advantage Δ, pp. */
	advantage: number;
	/** σ(β·Δ), 0..1. */
	winProbability: number;
}

/** Everything the UI needs, recomputed synchronously on any session change. */
export interface ModelOutput {
	/** Current pick phase, derived from my team's pick count. */
	phase: PickPhase;
	enemyRoles: EnemyRoleInference[];
	/** P(enemy role r still open), used internally; exposed for debugging. */
	enemyOpenRoles: Record<`${Role}`, number>;
	/** One block per still-open role of my team. Empty when all five are picked. */
	suggestions: SuggestionBlock[];
	/** Present only when all 10 picks are entered. */
	winEstimate: WinEstimate | null;
}

// ---------------------------------------------------------------------------
// Model constants (model-spec.md §5) — single source of truth for the client

export const MODEL_CONSTANTS = {
	/** Floor for position shares in enemy-role enumeration (§1). */
	epsilon: 0.01,
	/** Component weights w1..w6 (§3.3). */
	weights: {
		meta: 1.0,
		side: 1.0,
		phase: 1.0,
		synergy: 1.0,
		matchups: 1.0,
		counterRisk: 0.5,
	},
	/** Lane weight matrix L[myRole][enemyRole] (§3.1). */
	laneWeights: {
		1: { 1: 1.0, 2: 1.0, 3: 1.5, 4: 1.5, 5: 1.0 },
		2: { 1: 1.0, 2: 1.75, 3: 1.0, 4: 1.0, 5: 1.0 },
		3: { 1: 1.5, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.5 },
		4: { 1: 1.5, 2: 1.0, 3: 1.0, 4: 1.0, 5: 1.5 },
		5: { 1: 1.0, 2: 1.0, 3: 1.5, 4: 1.5, 5: 1.0 },
	} as Record<Role, Record<Role, number>>,
	/** Suggestions per role block (§3.4). */
	suggestionsPerRole: 5,
	/** Logistic slope per pp of advantage (§4). */
	beta: 0.1,
} as const;
