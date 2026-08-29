// Seeded randomness, so the whole simulation is deterministic under test.
//
// mulberry32: tiny, fast, good enough distribution for a game. Every random
// decision in the engine — spawns, personas, bot dice — draws from ONE stream
// owned by the simulation, which is what makes "same seed, same session"
// true and lets tests assert on behaviour instead of mocking chance.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = <T>(rng: Rng, arr: readonly T[]): T =>
  arr[Math.floor(rng() * arr.length)];

export const range = (rng: Rng, lo: number, hi: number): number =>
  lo + rng() * (hi - lo);

/** Integer in [lo, hi], inclusive on both ends. */
export const rangeInt = (rng: Rng, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));
