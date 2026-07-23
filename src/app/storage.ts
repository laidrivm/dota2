/**
 * The app's only door to localStorage.
 *
 * Storage can be absent (server-side, tests), disabled (private mode,
 * blocked cookies) or full (quota). None of that is worth interrupting a
 * draft for: reads degrade to "nothing stored", writes degrade to
 * in-memory-only, and the caller carries on.
 */

const storage = () => (globalThis as { localStorage?: Storage }).localStorage;

export function read(key: string): string | null {
	try {
		return storage()?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

export function write(key: string, value: string): void {
	try {
		storage()?.setItem(key, value);
	} catch {
		// Quota exceeded or storage disabled — the session stays in memory.
	}
}
