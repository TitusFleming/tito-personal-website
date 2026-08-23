import { PAD_TABLE, RING_TABLE, TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { TriggerObject, type TouchContext } from "./object.ts";
import type { PadColor, RingColor } from "../types.ts";

/** Flip gravity and launch, in that order, so the impulse follows the new down. */
function launch(ctx: TouchContext, vy: number, flipsGravity: boolean): void {
  const p = ctx.player;
  if (flipsGravity) {
    p.gravitySign = p.gravitySign === 1 ? -1 : 1;
    ctx.events.push({ type: "gravity", sign: p.gravitySign });
  }
  if (vy !== 0) p.vy = vy * p.gravitySign;
  p.onGround = false;
}

/**
 * Sits flat on the cell floor; you hit it by walking or falling over it.
 *
 * No input required — that is the whole difference between a pad and a ring.
 */
export class Pad extends TriggerObject {
  readonly kind = "pad";
  readonly box: Aabb;
  readonly cell: Aabb;

  readonly color: PadColor;

  constructor(gx: number, gy: number, color: PadColor = "yellow") {
    super();
    this.color = color;
    this.box = aabb(gx * TILE, gy * TILE, TILE, TILE * 0.35);
    this.cell = this.box;
  }

  onEnter(ctx: TouchContext): boolean {
    const { vy, flipsGravity } = PAD_TABLE[this.color];
    launch(ctx, vy, flipsGravity);
    ctx.events.push({ type: "pad", vy, color: this.color });
    return true;
  }
}

/**
 * Fires only on a fresh press, and consumes it.
 *
 * This is the one place in the game where a press EDGE matters rather than the
 * held state: holding through two rings must fire the first and not the second.
 */
export class Ring extends TriggerObject {
  readonly kind = "ring";
  readonly box: Aabb;
  readonly cell: Aabb;

  readonly color: RingColor;

  constructor(gx: number, gy: number, color: RingColor = "yellow") {
    super();
    this.color = color;
    this.box = aabb(gx * TILE, gy * TILE, TILE, TILE);
    this.cell = this.box;
  }

  onEnter(ctx: TouchContext): boolean {
    // Not armed yet — stay live so a press later in the overlap still works.
    if (!ctx.input.ringArmed) return false;
    ctx.input.ringArmed = false;
    const { vy, flipsGravity } = RING_TABLE[this.color];
    launch(ctx, vy, flipsGravity);
    ctx.events.push({ type: "ring", vy, color: this.color });
    return true;
  }
}
