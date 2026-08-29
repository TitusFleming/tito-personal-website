import { TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { HazardObject } from "./object.ts";

/**
 * A rotating blade. The one hazard whose kill area is a CIRCLE, not a rect.
 *
 * That is not a styling choice: the game's own hitbox data gives every
 * sawblade a radius (via GameObject's object radius), and a spinning disc
 * genuinely kills the same distance in every direction. Modelling it as the
 * bounding rect would make the diagonals lethal 41% further out than the real
 * game; as the inscribed rect, the cardinal directions would be too kind.
 * Collision does one circle-vs-rect test instead (see hitsHazard).
 *
 * The radius comes from the imported object table per id — Clubstep's blades
 * (ids 183-187) and the classic sawblades (88/89/98) all differ.
 */
export class Saw extends HazardObject {
  readonly kind = "saw";
  box: Aabb;
  cell: Aabb;

  /** Kill circle: centre in world px, radius in px. */
  cx: number;
  cy: number;
  readonly radius: number;

  constructor(gx: number, gy: number, radiusPx: number, gw = 1, gh = 1) {
    super();
    this.radius = radiusPx;
    // The authored cell, like every other object — the sprite's footprint.
    this.cell = aabb(gx * TILE, gy * TILE, TILE * gw, TILE * gh);
    this.cx = this.cell.x + this.cell.w / 2;
    this.cy = this.cell.y + this.cell.h / 2;
    // The circle's bounding square. Column bucketing and the broad-phase rect
    // test both use it; the exact circle test runs only after this passes.
    this.box = aabb(this.cx - radiusPx, this.cy - radiusPx, radiusPx * 2, radiusPx * 2);
  }

  /**
   * Deliberately immobile. Seating exists to rescue floor spikes from the
   * importer's quarter-tile rounding, but a blade is authored at an exact
   * centre — often half-buried in the floor by design — and "sitting it up"
   * onto the surface would move the kill circle away from where the level
   * put it.
   */
  seatAt(): void {}
}

/** Circle-vs-rect: clamp the centre into the rect, then compare distances. */
export function circleHitsRect(cx: number, cy: number, r: number, rect: Aabb): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}
