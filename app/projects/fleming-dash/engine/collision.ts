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
  SOLID_HITBOX_SCALE,
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
export function playerSolidBox(s: SimState): Aabb {
  const b = playerBox(s);
  const w = b.w * SOLID_HITBOX_SCALE;
  const h = b.h * SOLID_HITBOX_SCALE;
  return { x: b.x + (b.w - w) / 2, y: b.y + (b.h - h) / 2, w, h };
}

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

      // How far the small centre box sits inside the full one. Landing is judged
      // on the SOLID box's edge rather than the sprite's, which is what makes a
      // late or corner-clipped landing survivable without a special grace rule.
      const inset = (box.h - box.h * SOLID_HITBOX_SCALE) / 2;

      if (s.vy <= 0 && prevBottom + inset >= rectTop - LAND_TOLERANCE) {
        // Came down onto it.
        s.y = rectTop + hh;
        s.vy = 0;
        s.onGround = true;
        result = "land";
      } else if (s.vy > 0 && prevTop - inset <= rectBottom + LAND_TOLERANCE) {
        // Came up into it. A bonk, not a death — you lose your climb and fall.
        s.y = rectBottom - hh;
        s.vy = 0;
        if (result === "none") result = "ceiling";
      } else {
        const sb = playerSolidBox(s);
        if (overlaps(sb, rect)) {
          // The solid box is inside the block — but overlapping is not the same
          // as running into a wall. Compare how deep the overlap is on each
          // axis: whichever is shallower is the side the player actually came
          // from. A landing has a tiny vertical overlap and a wide horizontal
          // one; a wall hit is the reverse, because x advances only ~1.3px per
          // step while y can move ~5.8px.
          //
          // Without this a fast fall onto a block's corner reads as a wall and
          // kills you, which is exactly the unfair death the real game avoids.
          const overlapX =
            Math.min(sb.x + sb.w, rect.x + rect.w) - Math.max(sb.x, rect.x);
          const overlapY =
            Math.min(sb.y + sb.h, rect.y + rect.h) - Math.max(sb.y, rect.y);

          if (overlapX < overlapY) return "death"; // genuinely into the face

          // Shallower vertically: treat it as the landing it really is.
          s.y = rectTop + hh;
          s.vy = 0;
          s.onGround = true;
          result = "land";
        }
        // Solid box clear of the block entirely — a harmless corner brush.
        // Doing nothing here IS the forgiveness.
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
      if (overlaps(kill, hz.box)) return true;
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
