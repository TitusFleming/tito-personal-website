// Progress lives here, not in a database.
//
// This is the store of record, and that is a deliberate architectural choice
// rather than a shortcut: a run generates a death every few seconds, and
// writing each one over the network would add latency to a restart (which must
// feel instant) and burn a metered database quota to record something nobody
// will ever read. A server sync, if it arrives, is a leaderboard layer on top —
// it can be absent and the game is completely unaffected.
//
// The version lives in the key prefix rather than inside the value, so a future
// migration reads the old key, writes the new one, and deletes the old, instead
// of trying to mutate a blob in place.

const PLAYER_KEY = "fdash.v1.player";
const PROGRESS_KEY = "fdash.v1.progress";
const COINS_KEY = "fdash.v1.coins";

export type Player = {
  id: string;
  name: string | null;
  createdAt: string;
};

export type LevelProgress = {
  bestPercent: number;
  /** The level revision this best was set on — a level edit makes old bests incomparable. */
  rev: number;
  completed: boolean;
  attempts: number;
  bestTimeSec: number | null;
};

export type ProgressMap = Record<string, LevelProgress>;

/**
 * Safari in private mode throws on setItem, and a full quota throws too. Losing
 * a best percentage is a nuisance; taking the whole game down over it is not
 * acceptable, so every access is wrapped and failure is silent after one warning.
 */
let warned = false;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    if (!warned) {
      warned = true;
      console.warn("Fleming Dash: local storage unavailable, progress won't persist.");
    }
  }
}

/**
 * The identity is the UUID, not the name.
 *
 * The name is only a label — two visitors called "tito" are different players,
 * and changing your name doesn't lose your progress. That keeps the "simplest
 * login in the world" honest: there is nothing to guess, nothing to leak, and
 * no password to store.
 */
export function loadPlayer(): Player {
  const existing = readJson<Player | null>(PLAYER_KEY, null);
  if (existing?.id) return existing;

  const created: Player = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
    name: null,
    createdAt: new Date().toISOString(),
  };
  writeJson(PLAYER_KEY, created);
  return created;
}

export function saveName(player: Player, name: string): Player {
  // Strip control characters, not punctuation — names with spaces are fine.
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 24);
  const next = { ...player, name: cleaned || null };
  writeJson(PLAYER_KEY, next);
  return next;
}

export function loadProgress(): ProgressMap {
  return readJson<ProgressMap>(PROGRESS_KEY, {});
}

export function blankProgress(rev: number): LevelProgress {
  return { bestPercent: 0, rev, completed: false, attempts: 0, bestTimeSec: null };
}

/**
 * Fold one attempt into the stored record.
 *
 * Pure, so the merge rules are testable without a browser: bests only ever go
 * up, completion is sticky, and a level revision bump resets the comparison
 * rather than silently comparing against different geometry.
 */
export function mergeAttempt(
  current: LevelProgress | undefined,
  rev: number,
  percent: number,
  completed: boolean,
  timeSec: number | null,
): LevelProgress {
  const base = current && current.rev === rev ? current : blankProgress(rev);
  return {
    rev,
    attempts: base.attempts + 1,
    bestPercent: Math.max(base.bestPercent, percent),
    completed: base.completed || completed,
    bestTimeSec:
      completed && timeSec !== null
        ? base.bestTimeSec === null
          ? timeSec
          : Math.min(base.bestTimeSec, timeSec)
        : base.bestTimeSec,
  };
}

/**
 * Coins, keyed by the name typed on the start screen.
 *
 * Deliberately NOT keyed by the player UUID like the rest of progress. Coins
 * are the one thing here worth showing off, and a shared machine should let two
 * people each own their own set — typing a different name gives you a different
 * record rather than inheriting somebody else's.
 *
 * Shape: { [name]: { [levelId]: number[] } }. A name is trimmed and lowercased
 * for the key so "Tito" and "tito " are the same collector, while the display
 * name keeps whatever casing was typed.
 */
export type CoinBook = Record<string, Record<string, number[]>>;

/** The key a display name maps to. Exported so tests can state the rule. */
export function coinKey(name: string | null): string {
  return (name ?? "").trim().toLowerCase() || "anonymous";
}

export function loadCoins(): CoinBook {
  return readJson<CoinBook>(COINS_KEY, {});
}

/** Coins this name has collected on this level, ascending. */
export function coinsFor(name: string | null, levelId: string): number[] {
  return [...(loadCoins()[coinKey(name)]?.[levelId] ?? [])].sort((a, b) => a - b);
}

/**
 * Fold a finished run's coins into the record.
 *
 * A union, never a replacement: clearing the level again without detouring for
 * a coin must not take one away.
 */
export function saveCoins(name: string | null, levelId: string, taken: Iterable<number>): number[] {
  const book = loadCoins();
  const key = coinKey(name);
  const forName = book[key] ?? (book[key] = {});
  const merged = new Set([...(forName[levelId] ?? []), ...taken]);
  forName[levelId] = [...merged].sort((a, b) => a - b);
  writeJson(COINS_KEY, book);
  return forName[levelId];
}

export function saveProgress(levelId: string, entry: LevelProgress): void {
  const all = loadProgress();
  all[levelId] = entry;
  writeJson(PROGRESS_KEY, all);
}
