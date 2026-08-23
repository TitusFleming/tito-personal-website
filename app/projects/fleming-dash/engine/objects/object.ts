// The object base classes.
//
// Four categories, because the simulation genuinely treats them differently and
// the hot loop should not be asking `instanceof` about it:
//
//   SolidObject    resolved against every step; can kill on its face
//   HazardObject   kills on lethal-box overlap
//   TriggerObject  fires once on entry, then re-arms when the player leaves
//   DecorObject    the simulation never sees it at all
//
// world.ts buckets instances into typed arrays by category, so each phase of a
// step iterates only the objects it cares about. Adding a mechanic means
// picking a category and writing one class — no existing file learns about it
// except the registry, which is the single composition seam.

import type { Aabb } from "../core/aabb.ts";
import type { InputState, SimEvent } from "../types.ts";
import type { Player } from "../player.ts";
import type { Palette } from "../palette.ts";

/** Everything a trigger is allowed to touch when it fires. */
export type TouchContext = {
  readonly player: Player;
  /** Presentation state a trigger may change. Never read by physics. */
  readonly palette: Palette;
  /** Coin indices taken so far this attempt. Never read by physics either. */
  readonly coins: Set<number>;
  /** Mutable: rings and taps CONSUME the press edge so one click fires one thing. */
  readonly input: InputState;
  readonly events: SimEvent[];
};

export abstract class GameObject {
  /**
   * Dense index, assigned by the world at compile time.
   *
   * Triggers use it to index a flat Uint8Array of "was overlapping last step"
   * bits — no Set, no allocation, at 240 Hz.
   */
  id = -1;

  /** Short tag for the renderer to switch on. Never used by the simulation. */
  abstract readonly kind: string;

  /**
   * The DRAWN footprint, which is not the hitbox.
   *
   * A spike's kill rect is 6x12 while its drawn triangle fills a 30x30 cell,
   * and the gap between them is the game's forgiveness. Column bucketing uses
   * this one so a wide sprite is never clipped away by a narrow hitbox.
   */
  abstract readonly cell: Aabb;

  /** Degrees clockwise, for the renderer. 180 is a ceiling-mounted object. */
  readonly rot: number = 0;
}

/** Geometry the player stands on, and dies against the side of. */
export abstract class SolidObject extends GameObject {
  abstract readonly box: Aabb;
}

/** Anything that kills on contact with the player's lethal box. */
export abstract class HazardObject extends GameObject {
  abstract readonly box: Aabb;

  /**
   * Move so the cell's bottom edge rests on `surfaceY`, taking the kill box
   * with it. Called once at compile time; see World.seatHazards.
   */
  abstract seatAt(surfaceY: number): void;
}

/**
 * Fires once when the player enters its volume.
 *
 * Entry rather than overlap: a portal that re-applied every step would fire
 * dozens of times crossing it, and a pad would pin the player's velocity
 * instead of launching them once.
 */
export abstract class TriggerObject extends GameObject {
  abstract readonly box: Aabb;

  /**
   * Fire on entering this volume. Returns whether the touch was CONSUMED.
   *
   * Returning false means "not this time, ask again next step". That is what
   * an orb needs: you fly into it with the button up and press once you are
   * inside, which is how every orb in the game is used. Marking the trigger
   * spent the moment the boxes overlapped meant an orb entered without holding
   * could never fire at all.
   */
  abstract onEnter(ctx: TouchContext): boolean;
}

/** Drawn, never simulated. */
export abstract class DecorObject extends GameObject {}
