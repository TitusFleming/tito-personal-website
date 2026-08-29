import { TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { TriggerObject, type TouchContext } from "./object.ts";
import type { Rgb } from "../types.ts";

/**
 * A colour change, taken from the level's own colour triggers.
 *
 * Presentation only: it mutates the simulation's palette and never touches
 * physics, so it cannot affect a replay's outcome. It lives in the simulation
 * rather than the renderer so the palette is deterministic and travels with
 * checkpoints — resuming mid-level restores the colours of that section rather
 * than the colours of the start.
 *
 * The volume is deliberately far taller than the level: a colour trigger fires
 * on CROSSING ITS X, whatever height the player happens to be at.
 */
export class ColorTrigger extends TriggerObject {
  readonly kind = "color";
  readonly box: Aabb;
  readonly cell: Aabb;
  readonly target: "bg" | "ground";
  readonly rgb: Rgb;
  /** Seconds to fade. Zero snaps. */
  readonly fade: number;

  constructor(gx: number, target: "bg" | "ground", rgb: Rgb, fade = 0) {
    super();
    this.target = target;
    this.rgb = rgb;
    this.fade = fade;
    this.box = aabb(gx * TILE, -60 * TILE, TILE, 120 * TILE);
    // Nothing is drawn for a colour trigger, so its cell is a single column —
    // enough to be filed in the right place and never seen.
    this.cell = aabb(gx * TILE, 0, TILE, TILE);
  }

  onEnter(ctx: TouchContext): boolean {
    ctx.palette.fadeTo(this.target, this.rgb, this.fade);
    ctx.events.push({ type: "color", target: this.target });
    return true;
  }
}
