import { aabb, type Aabb } from "../core/aabb.ts";
import { TILE } from "../constants.ts";
import { SolidObject } from "./object.ts";

/**
 * A rectangle of solid geometry.
 *
 * Carries its own span rather than being expanded into one object per cell:
 * a 40-tile floor is one Block, registered in 40 columns. That keeps both the
 * level file and the collision list small.
 */
export class Block extends SolidObject {
  readonly kind = "block";
  readonly box: Aabb;
  readonly cell: Aabb;

  constructor(gx: number, gy: number, w = 1, h = 1) {
    super();
    this.box = aabb(gx * TILE, gy * TILE, w * TILE, h * TILE);
    // A block's drawn footprint IS its hitbox — the one object where that is true.
    this.cell = this.box;
  }
}
