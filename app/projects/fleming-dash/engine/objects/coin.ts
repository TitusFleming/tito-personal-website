import { TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { TriggerObject, type TouchContext } from "./object.ts";

/**
 * A secret coin.
 *
 * Three per official level, each sitting off the obvious route. Collecting one
 * changes nothing about the run — it is recorded and drawn differently, and the
 * physics never learns it happened. That is deliberate: a coin must never be
 * able to alter a trajectory, or routes would play differently depending on
 * whether you had already taken one.
 *
 * The index is assigned by the world in x order, so "the second coin" means the
 * same thing to the level, the save file and the player.
 */
export class Coin extends TriggerObject {
  readonly kind = "coin";
  readonly box: Aabb;
  readonly cell: Aabb;
  /** 0-based, in x order. Set by the world at compile time. */
  index = 0;

  constructor(gx: number, gy: number) {
    super();
    // Slightly generous, because a coin is a reward for taking the hard route
    // and should not be missed by two pixels after you got there.
    this.cell = aabb(gx * TILE, gy * TILE, TILE, TILE);
    this.box = aabb(gx * TILE - TILE * 0.1, gy * TILE - TILE * 0.1, TILE * 1.2, TILE * 1.2);
  }

  onEnter(ctx: TouchContext): boolean {
    if (ctx.coins.has(this.index)) return true;
    ctx.coins.add(this.index);
    ctx.events.push({ type: "coin", index: this.index });
    return true;
  }
}
