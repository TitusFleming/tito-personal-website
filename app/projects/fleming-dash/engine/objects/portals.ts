// Portals: discrete, composable mutations of player state.
//
// Every portal in the game changes exactly one field on the Player and reports
// it. They are separate classes rather than a switch because they compose — a
// level can put a mini portal, a gravity portal and a speed portal in the same
// three tiles, and each one applies without knowing the others exist.
//
// THE SIZE CASE
// A size portal is the reason Player.box() exists. Because every box the player
// owns is `body x sizeScale`, SizePortal writes one number and the body, the
// solid box and the lethal box all change together. No collision code, no
// camera code and no renderer code knows that minis exist.

import { SIZE_MINI, SIZE_NORMAL, TILE } from "../constants.ts";
import { aabb, type Aabb } from "../core/aabb.ts";
import { TriggerObject, type TouchContext } from "./object.ts";
import { MODES, type GameMode } from "../modes/mode.ts";
import type { Player } from "../player.ts";
import type { SpeedIndex } from "../types.ts";

export abstract class Portal extends TriggerObject {
  readonly kind = "portal";
  readonly box: Aabb;
  readonly cell: Aabb;

  /** Distinguishes portals for the renderer only. */
  abstract readonly portalKind: string;

  constructor(gx: number, gy: number, gw = 1, gh = 3) {
    super();
    // Three tiles tall, so you cannot miss one at any speed — and anchored at
    // the authored y, which for a gh=3 object IS the cell bottom. A previous
    // version subtracted another tile here and sat every portal one tile low.
    this.box = aabb(gx * TILE, gy * TILE, TILE * gw, TILE * gh);
    this.cell = this.box;
  }

  /**
   * Apply a change that alters the player's body height without moving the
   * surface it is resting on.
   *
   * The player's position is its CENTRE, so changing body height in place
   * leaves a grounded player floating above the floor (or embedded in it). This
   * pins whichever edge gravity currently makes "the feet", which is why it
   * composes correctly with a gravity portal rather than fighting it.
   */
  protected resize(p: Player, mutate: () => void): void {
    const feet = p.gravitySign === 1 ? p.y - p.halfH() : p.y + p.halfH();
    mutate();
    p.y = p.gravitySign === 1 ? feet + p.halfH() : feet - p.halfH();
  }
}

/** Cube, ship, ball, UFO, wave. Velocity carries through; only the body changes. */
export class ModePortal extends Portal {
  readonly portalKind = "mode";
  readonly mode: GameMode;

  constructor(gx: number, gy: number, mode: GameMode, gw = 1, gh = 3) {
    super(gx, gy, gw, gh);
    this.mode = mode;
  }

  onEnter(ctx: TouchContext): void {
    const p = ctx.player;
    if (p.mode === this.mode) return;
    this.resize(p, () => {
      p.mode = this.mode;
    });
    p.rot = 0;
    p.onGround = false;
    // A mode with a locked camera is framed by the portal that started it.
    // Modes that do not lock clear the anchor, so walking out of a ship section
    // hands the view back to the ground camera.
    // Both the framing and the bounds come from THIS portal's own position.
    const centre = this.box.y + this.box.h / 2;
    const def = MODES[this.mode];
    p.sectionAnchorY = def.camera === "anchored" ? centre : null;
    p.section =
      def.sectionTiles === null
        ? null
        : {
            floor: centre - (def.sectionTiles * TILE) / 2,
            ceiling: centre + (def.sectionTiles * TILE) / 2,
          };
    ctx.events.push({ type: "portal", mode: this.mode });
  }
}

/** Inverts gravity. The physics already multiplies every branch by this sign. */
export class GravityPortal extends Portal {
  readonly portalKind = "gravity";
  readonly sign: 1 | -1;
  constructor(gx: number, gy: number, dir: "down" | "up", gw = 1, gh = 3) {
    super(gx, gy, gw, gh);
    this.sign = dir === "down" ? 1 : -1;
  }

  onEnter(ctx: TouchContext): void {
    const p = ctx.player;
    if (p.gravitySign === this.sign) return;
    p.gravitySign = this.sign;
    p.onGround = false;
    ctx.events.push({ type: "gravity", sign: this.sign });
  }
}

/**
 * Mini and back.
 *
 * The entire feature is the one assignment below. That is the payoff of routing
 * every hitbox through a single rule.
 */
export class SizePortal extends Portal {
  readonly portalKind = "size";
  readonly scale: number;
  constructor(gx: number, gy: number, size: "mini" | "normal", gw = 1, gh = 3) {
    super(gx, gy, gw, gh);
    this.scale = size === "mini" ? SIZE_MINI : SIZE_NORMAL;
  }

  onEnter(ctx: TouchContext): void {
    const p = ctx.player;
    if (p.sizeScale === this.scale) return;
    this.resize(p, () => {
      p.sizeScale = this.scale;
    });
    ctx.events.push({ type: "size", scale: this.scale });
  }
}

/** Changes horizontal speed mid-level. Speed is player state, not a level constant. */
export class SpeedPortal extends Portal {
  readonly portalKind = "speed";
  readonly index: SpeedIndex;

  constructor(gx: number, gy: number, index: SpeedIndex, gw = 1, gh = 3) {
    super(gx, gy, gw, gh);
    this.index = index;
  }

  onEnter(ctx: TouchContext): void {
    const p = ctx.player;
    if (p.speedIndex === this.index) return;
    p.speedIndex = this.index;
    ctx.events.push({ type: "speed", index: this.index });
  }
}
