// Collision resolution.
//
// The whole problem collapses because horizontal velocity is never resolved: in
// this genre, running into a wall kills you rather than stopping you. So there
// is exactly one resolution axis (y), and the only question a solid ever has to
// answer is "did the player come down onto the top of this, come up into the
// bottom of it, or drive into its face?".
//
// THE FORGIVENESS MODEL, stated once and implemented literally:
//   landing  — judged on the player's FULL body against the surface top
//   killing  — judged on the player's small SOLID box against the face
// and that is all. Clipping a block's corner survives because the solid box is
// 30% of the body, so it takes several steps of horizontal travel before the
// centre reaches the block — by which time a falling player has passed. The
// forgiveness is a consequence of the box sizes, not a rule of its own.
//
// A previous version added the solid box's inset to the LANDING test as well,
// which quietly granted 10.5px of upward rescue on top of the 2px tolerance and
// meant driving 16px into a block's face teleported you onto its roof. Landing
// and killing use different boxes; they must not borrow each other's insets.

import { LAND_TOLERANCE, TILE } from "./constants.ts";
import { overlaps } from "./core/aabb.ts";
import type { Player } from "./player.ts";
import type { World } from "./world.ts";

export type SolidResult = "none" | "land" | "ceiling" | "death";

/**
 * Resolve the player against solid geometry for this step.
 *
 * `prevBottom` / `prevTop` are from BEFORE integration. Comparing against them
 * is what distinguishes "descended onto the top" from "drove into the face" —
 * position alone cannot tell those apart once you are already overlapping.
 */
export function resolveSolids(
  p: Player,
  world: World,
  prevBottom: number,
  prevTop: number,
): SolidResult {
  const [lo, hi] = world.span(p.box());
  let result: SolidResult = "none";

  for (let gx = lo; gx <= hi; gx++) {
    const col = world.columns[gx];
    if (!col) continue;

    for (const solid of col.solids) {
      const rect = solid.box;
      if (!overlaps(p.box(), rect)) continue;

      const rectTop = rect.y + rect.h;
      const rectBottom = rect.y;
      const hh = p.halfH();

      if (p.vy <= 0 && prevBottom >= rectTop - LAND_TOLERANCE) {
        // Came down onto it.
        p.y = rectTop + hh;
        p.vy = 0;
        p.onGround = true;
        result = "land";
      } else if (p.vy > 0 && prevTop <= rectBottom + LAND_TOLERANCE) {
        // Came up into the underside. Fatal, as in the real game — a block's
        // bottom face is as lethal as its side. This used to be a survivable
        // bonk that zeroed the climb, which let the player headbutt geometry
        // and carry on.
        //
        // Judged on the SOLID box, exactly like a wall: clipping the corner of
        // an overhang stays survivable, so the forgiveness model is unchanged.
        if (overlaps(p.box("solid"), rect)) return "death";
        p.y = rectBottom - hh;
        p.vy = 0;
        if (result === "none") result = "ceiling";
      } else if (overlaps(p.box("solid"), rect)) {
        // The small centre box is inside the block: genuinely into the face.
        return "death";
      }
      // Body overlaps but the solid box is clear — a corner brush. Doing
      // nothing here IS the forgiveness.
    }
  }

  return result;
}

/** True if the player's lethal box touches any hazard. */
export function hitsHazard(p: Player, world: World): boolean {
  const kill = p.box("lethal");
  const [lo, hi] = world.span(kill);

  for (let gx = lo; gx <= hi; gx++) {
    const col = world.columns[gx];
    if (!col) continue;
    for (const hazard of col.hazards) {
      if (overlaps(kill, hazard.box)) return true;
    }
  }
  return false;
}

/** Distance below the local ground at which a fall is unrecoverable. */
export const VOID_DEPTH = TILE * 4;
