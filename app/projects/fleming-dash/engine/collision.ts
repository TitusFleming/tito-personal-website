// Collision resolution.
//
// The whole problem collapses because horizontal velocity is never resolved: in
// this genre, running into a wall kills you rather than stopping you. So there
// is exactly one resolution axis (y), and the only question a solid rect ever
// has to answer is "did the player come down onto the top of this, come up into
// the bottom of it, or drive into its face?".
//
// Broadphase is free too. The player spans at most two columns, so we look at
// three or four of them, each holding a handful of rects. That is ~10 AABB
// tests per step, which is nothing even at 240 Hz.

import {
  HAZARD_INSET,
  LAND_TOLERANCE,
  SIDE_KILL_DEPTH,
  TILE,
} from "./constants.ts";
import { playerHalfH, playerHalfW } from "./physics.ts";
import type { Aabb, CompiledLevel, SimState } from "./types.ts";

export function overlaps(a: Aabb, b: Aabb): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

/** The player's solid box — what lands on things and dies against faces. */
export function playerBox(s: SimState): Aabb {
  const hw = playerHalfW();
  const hh = playerHalfH(s);
  return { x: s.x - hw, y: s.y - hh, w: hw * 2, h: hh * 2 };
}

/**
 * The player's *lethal* box, inset on every side.
 *
 * Together with the spike's own shrunken rect, this is where the game's
 * fairness lives: a 30x30 cube only dies on its middle 18x18, so brushing the
 * outer edge of a spike survives, exactly as it does in the real game.
 */
export function playerHazardBox(s: SimState): Aabb {
  const b = playerBox(s);
  return {
    x: b.x + HAZARD_INSET,
    y: b.y + HAZARD_INSET,
    w: b.w - HAZARD_INSET * 2,
    h: b.h - HAZARD_INSET * 2,
  };
}

/** Columns the player currently overlaps, padded by one on each side. */
function columnRange(level: CompiledLevel, box: Aabb): [number, number] {
  const lo = Math.max(0, Math.floor(box.x / TILE) - 1);
  const hi = Math.min(level.columns.length - 1, Math.floor((box.x + box.w) / TILE) + 1);
  return [lo, hi];
}

export type SolidResult = "none" | "land" | "ceiling" | "death";

/**
 * Resolve the player against solid geometry for this step.
 *
 * `prevBottom` / `prevTop` are from *before* integration. Comparing against
 * them is what distinguishes "descended onto the top" from "drove into the
 * face" — position alone cannot tell those apart once you are overlapping.
 */
export function resolveSolids(
  s: SimState,
  level: CompiledLevel,
  prevBottom: number,
  prevTop: number,
): SolidResult {
  const box = playerBox(s);
  const hh = playerHalfH(s);
  const [lo, hi] = columnRange(level, box);
  let result: SolidResult = "none";

  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;

    for (const rect of col.solids) {
      if (!overlaps(playerBox(s), rect)) continue;

      const rectTop = rect.y + rect.h;
      const rectBottom = rect.y;

      if (s.vy <= 0 && prevBottom >= rectTop - LAND_TOLERANCE) {
        // Came down onto it.
        s.y = rectTop + hh;
        s.vy = 0;
        s.onGround = true;
        result = "land";
      } else if (s.vy > 0 && prevTop <= rectBottom + LAND_TOLERANCE) {
        // Came up into it. A bonk, not a death — you lose your climb and fall.
        s.y = rectBottom - hh;
        s.vy = 0;
        if (result === "none") result = "ceiling";
      } else if (s.vy <= 0 && prevBottom >= rectTop - SIDE_KILL_DEPTH) {
        // Shallow corner clip: descending, and the previous position was only
        // just below the top. Snap up as if it were a clean landing.
        //
        // Without this, catching a block's corner by three pixels is fatal and
        // the game reads as broken rather than hard. SIDE_KILL_DEPTH is the
        // single knob controlling how generous that is.
        //
        // Note this requires having *come from above*. Forgiving on position
        // alone would let the player walk up onto any ground-level block, which
        // deletes most of the difficulty in the game.
        s.y = rectTop + hh;
        s.vy = 0;
        s.onGround = true;
        result = "land";
      } else {
        // Ran into the face.
        return "death";
      }
    }
  }

  return result;
}

/** True if the player's lethal box touches any hazard. */
export function hitsHazard(s: SimState, level: CompiledLevel): boolean {
  const kill = playerHazardBox(s);
  const [lo, hi] = columnRange(level, kill);

  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;
    for (const hz of col.hazards) {
      if (overlaps(kill, hz)) return true;
    }
  }
  return false;
}

/**
 * Ground and ceiling are scalars per column rather than rects — one comparison,
 * exact at any level length, and a zone can vary them for free.
 */
export function groundAt(level: CompiledLevel, x: number): number {
  const col = level.columns[Math.floor(x / TILE)];
  return col ? col.groundY : 0;
}

export function ceilingAt(level: CompiledLevel, x: number): number {
  const col = level.columns[Math.floor(x / TILE)];
  return col ? col.ceilingY : Infinity;
}
