// One canonical hitbox unit, and one rule that derives every hitbox from it.
//
// THE RULE
//   every box = HITBOX_UNIT x shape.sx/sy x sizeScale, anchored per `shape`
//
// Nothing in the game builds a rect any other way. That single constraint is
// what makes the things we know are coming cheap:
//
//   mini portal      -> player.sizeScale = 0.5, and every box the player owns
//                       shrinks together. No collision code is touched.
//   a new gamemode   -> one `body` entry in the MODES table.
//   a new hazard     -> one `shape` on the class.
//
// WHY NOT LITERALLY ONE SIZE FOR EVERYTHING
// A single size for cube and ship would make the ship a 30x30 box, which
// changes every ship-corridor clearance in the imported level and contradicts
// the real game. So the *rule* is uniform and the *scales* are declared data:
// each mode states its body once, here-adjacent, instead of collision code
// asking "am I a ship?". Making cube and ship literally identical is now a
// one-line edit in MODES rather than a refactor — which was the point.

import { SOLID_HITBOX_SCALE, TILE } from "../constants.ts";
import { aabb, type Aabb } from "./aabb.ts";

/** The canonical hitbox unit. One grid cell. Everything is a multiple of this. */
export const HITBOX_UNIT = TILE;

/**
 * Which box is being asked for.
 *
 * The two-hitbox model is the real game's, and it is why the game feels fair
 * while being brutal: hazards test the full body, while only a small centre box
 * decides whether driving into a block's face kills you. Expressed as a role
 * scale so it composes with size the same way everything else does, instead of
 * living as a special case inside collision.
 */
export type HitboxRole = "body" | "solid" | "lethal";

/** Role multipliers applied on top of the body scale. */
export const ROLE_SCALE: Record<HitboxRole, number> = {
  /** The full body. What lands on things. */
  body: 1,
  /**
   * The "blue" box. Much smaller than the body, so clipping a block's corner is
   * survivable without any special-case grace rule. The community documents it
   * as "much smaller" but publishes no exact figure, so this is a tunable:
   * raise it to make wall deaths harsher, lower it to be kinder.
   */
  solid: SOLID_HITBOX_SCALE,
  /** Hazards test the full body — forgiveness lives in the spike, not the player. */
  lethal: 1,
};

/**
 * A hitbox as a declaration rather than a rect: scales of HITBOX_UNIT plus an
 * offset, resolved against an anchor at the last possible moment.
 */
export type Shape = {
  /** Width and height, in units. */
  readonly sx: number;
  readonly sy: number;
  /** Offset from the anchor, in units. */
  readonly ox: number;
  readonly oy: number;
};

export function shape(sx: number, sy: number, ox = 0, oy = 0): Shape {
  return { sx, sy, ox, oy };
}

/** The unit square — the default body, and the shape a plain block occupies. */
export const UNIT_SHAPE = shape(1, 1);

/**
 * Resolve a shape around a CENTRE point. Used for the player, whose position is
 * its centre so that a size change stays put instead of sinking or lifting.
 */
export function centeredAt(s: Shape, cx: number, cy: number, scale = 1): Aabb {
  const w = s.sx * HITBOX_UNIT * scale;
  const h = s.sy * HITBOX_UNIT * scale;
  return aabb(
    cx - w / 2 + s.ox * HITBOX_UNIT * scale,
    cy - h / 2 + s.oy * HITBOX_UNIT * scale,
    w,
    h,
  );
}

/**
 * Resolve a shape inside a grid CELL, anchored at the cell's bottom-left.
 *
 * No implicit centring: a shape states its own offset. Centring a shape only
 * looks right while it is upright, and silently puts every rotated hazard in
 * the wrong place — which is exactly the bug class this file exists to remove.
 */
export function inCell(s: Shape, gx: number, gy: number, gw = 1, gh = 1): Aabb {
  // Fractions are of the CELL, which is not always one tile — half-size hazards
  // exist and must scale rather than be clipped.
  return aabb(
    gx * TILE + s.ox * HITBOX_UNIT * gw,
    gy * TILE + s.oy * HITBOX_UNIT * gh,
    s.sx * HITBOX_UNIT * gw,
    s.sy * HITBOX_UNIT * gh,
  );
}

/** Centre a shape's width within its cell. The usual authoring convenience. */
export function centeredInCell(sx: number, sy: number, oy: number): Shape {
  return shape(sx, sy, (1 - sx) / 2, oy);
}

/**
 * Rotate a shape 90 degrees clockwise within its unit cell.
 *
 * One rule, applied repeatedly, instead of a switch with four hand-written
 * rects. Derivation: the cell is 1x1, so a point at (ox, oy) with extent
 * (sx, sy) maps to (oy, 1 - ox - sx) with extent (sy, sx).
 */
function rot90(s: Shape): Shape {
  return shape(s.sy, s.sx, s.oy, 1 - s.ox - s.sx);
}

/** Rotate by a cardinal angle, clockwise. Non-cardinal input is snapped. */
export function rotateShape(s: Shape, deg: number): Shape {
  const turns = ((Math.round(deg / 90) % 4) + 4) % 4;
  let out = s;
  for (let i = 0; i < turns; i++) out = rot90(out);
  return out;
}
