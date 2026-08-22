import { TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { DecorObject } from "./object.ts";

/**
 * The dark notch cut into the ground and ceiling lines.
 *
 * The game's object table calls these hazards (ids 9, 61 — "pit_01") and in the
 * real game they mark a hole. This engine models the ground as continuous, so
 * treating them as lethal killed the cube on stretches you plainly run straight
 * across. Drawn, never simulated — which is exactly what DecorObject means.
 */
export class Pit extends DecorObject {
  readonly kind = "pit";
  readonly cell: Aabb;

  constructor(gx: number, gy: number) {
    super();
    this.cell = aabb(gx * TILE, gy * TILE, TILE, TILE * 0.45);
  }
}
