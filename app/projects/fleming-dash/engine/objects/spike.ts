import { SPIKE_BOX, TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { HITBOX_UNIT, centeredInCell, inCell, rotateShape, type Shape } from "../core/hitbox.ts";
import { HazardObject } from "./object.ts";

/**
 * A spike, whose lethal rect is deliberately much smaller than its triangle.
 *
 * That gap is the game's forgiveness and the reason brushing a spike's edge
 * survives. The size is per-object rather than one global constant because the
 * importer reads it from the game's own object table — a full spike, a half
 * spike and a small thorn are all differently forgiving.
 */
export class Spike extends HazardObject {
  readonly kind = "spike";
  box: Aabb;
  cell: Aabb;
  override readonly rot: number;

  constructor(
    gx: number,
    gy: number,
    rot: 0 | 90 | 180 | 270 = 0,
    hwPx?: number,
    hhPx?: number,
    gw = 1,
    gh = 1,
  ) {
    super();
    this.rot = rot;

    // Upright shape in canonical units, then rotated by the single rule in
    // hitbox.ts. Four hand-written rects is how ceiling spikes ended up drawn
    // under the floor last time.
    const w = (hwPx ?? SPIKE_BOX.w) / HITBOX_UNIT;
    const h = (hhPx ?? SPIKE_BOX.h) / HITBOX_UNIT;
    const upright: Shape = centeredInCell(w, h, SPIKE_BOX.dy / HITBOX_UNIT);

    // Shape fractions are of THIS object's cell, not of a whole tile, so a
    // half-size spike is the same spike at half scale rather than a full-size
    // one crammed into a smaller footprint.
    this.box = inCell(rotateShape(upright, rot), gx, gy, gw, gh);
    // The cell at the object's real size and position, so a spike sitting on a
    // slab is drawn attached to that slab and at the right scale.
    this.cell = aabb(gx * TILE, gy * TILE, TILE * gw, TILE * gh);
  }

  seatAt(surfaceY: number): void {
    const dy = surfaceY - this.cell.y;
    if (dy === 0) return;
    this.cell = aabb(this.cell.x, this.cell.y + dy, this.cell.w, this.cell.h);
    this.box = aabb(this.box.x, this.box.y + dy, this.box.w, this.box.h);
  }
}
