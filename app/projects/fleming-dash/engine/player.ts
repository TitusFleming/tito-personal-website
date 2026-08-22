// The player, as an object that owns its own boxes.
//
// This class is the answer to "where does a hitbox come from": exactly one
// method, box(), for every box the player has in every mode at every size. The
// three things that vary are all fields on this object —
//
//   mode       -> which body shape (MODES table)
//   sizeScale  -> mini portals, one number
//   role       -> body / solid / lethal, the two-hitbox fairness model
//
// so a size portal is `p.sizeScale = SIZE_MINI` and nothing in collision,
// rendering, or the camera needs to learn that minis exist.

import { HITBOX_UNIT, ROLE_SCALE, centeredAt, type HitboxRole } from "./core/hitbox.ts";
import { SIZE_NORMAL, SPEEDS, SPEED_NORMAL } from "./constants.ts";
import { MODES, type GameMode, type ModeDef } from "./modes/mode.ts";
import type { Aabb } from "./core/aabb.ts";
import type { SpeedIndex } from "./types.ts";

export class Player {
  /** World px, the player's CENTRE. Boxes are derived, never stored. */
  x = 0;
  y = 0;
  vy = 0;

  mode: GameMode = "cube";
  /** 1 = normal, -1 = inverted. Every gravity branch multiplies by this. */
  gravitySign: 1 | -1 = 1;
  /** 1 = normal, 0.5 = mini. Scales every box this player owns, together. */
  sizeScale: number = SIZE_NORMAL;
  /** Index into SPEEDS, set by speed portals. */
  speedIndex: SpeedIndex = SPEED_NORMAL;

  onGround = true;
  /**
   * Rotation in WORLD space: radians, counter-clockwise positive, y-up.
   *
   * One convention for every mode. It used to be two — the cube's spin was
   * authored in screen space (clockwise positive) while the ship's came from
   * atan2(vy, speed), which is world space. The renderer applied the field
   * directly to a y-down canvas, so whichever mode disagreed came out
   * mirrored: the ship pitched nose-DOWN while climbing.
   *
   * The renderer negates once, on the way to the screen, exactly as it already
   * flips y. Nothing in the engine thinks about screen handedness.
   */
  rot = 0;

  get def(): ModeDef {
    return MODES[this.mode];
  }

  /** Horizontal px/s. Constant while no speed portal is crossed. */
  speed(): number {
    return SPEEDS[this.speedIndex];
  }

  /**
   * THE hitbox accessor. Every player rect in the game comes through here.
   *
   * body   — the full body; what lands on surfaces.
   * solid  — the small centre box; only decides whether a block's FACE kills.
   * lethal — what hazards test against.
   */
  box(role: HitboxRole = "body"): Aabb {
    return centeredAt(this.def.body, this.x, this.y, this.sizeScale * ROLE_SCALE[role]);
  }

  halfW(): number {
    return (this.def.body.sx * HITBOX_UNIT * this.sizeScale) / 2;
  }

  halfH(): number {
    return (this.def.body.sy * HITBOX_UNIT * this.sizeScale) / 2;
  }

  /** Visual size for the renderer, in px. */
  size(): { w: number; h: number } {
    return { w: this.halfW() * 2, h: this.halfH() * 2 };
  }

  /** Reset to a level's starting condition, reusing the object. */
  resetTo(x: number, y: number, mode: GameMode, speed: SpeedIndex): void {
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.mode = mode;
    this.gravitySign = 1;
    this.sizeScale = SIZE_NORMAL;
    this.speedIndex = speed;
    this.onGround = true;
    this.rot = 0;
  }
}
