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

/**
 * The stored value at `key` when it parses and `is` recognises it, and `null`
 * for every way it may not: nothing stored, storage unreachable, a truncated
 * or hand-edited payload. Three callers wanted the same four-way answer and
 * each spelled out its own `try`; the guard stays theirs because only they
 * know what they are reading back.
 */
export function readJson<T>(
	key: string,
	is: (value: unknown) => value is T,
): T | null {
	const raw = read(key);
	if (raw === null) return null;
	try {
		const parsed: unknown = JSON.parse(raw);
		return is(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function remove(key: string): void {
	try {
		storage()?.removeItem(key);
	} catch {
		// Nothing to do: an unreachable key is already as gone as we need.
	}
}
