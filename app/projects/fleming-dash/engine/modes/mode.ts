// Gamemodes as data.
//
// This replaces eleven scattered `s.mode === "ship"` branches across physics,
// simulation and rendering. A mode is now one entry in MODES, and adding one
// touches exactly this file: the body it collides with, how it reads input, how
// it rotates, and how closely the camera tracks it.
//
// The type is a Record over GameMode, so adding a mode to the union and
// forgetting to define it is a compile error rather than a runtime surprise
// halfway through a level.

import {
  BALL_GRAVITY,
  BALL_ROLL_RATE,
  BALL_TAP_VY,
  BALL_TERMINAL_VY,
  CAM_K_CUBE,
  CAM_K_SHIP,
  CUBE_GRAVITY,
  CUBE_JUMP_VY,
  CUBE_SPIN_RATE,
  CUBE_TERMINAL_VY,
  FLY_FALL_MAX,
  FLY_RISE_MAX,
  MINI_FLY_SCALE,
  MINI_JUMP_SCALE,
  SHIP_ACCEL,
  SHIP_ROT_K,
  SHIP_ROT_MAX,
  UFO_GRAVITY_FALLING,
  UFO_GRAVITY_RISING,
  UFO_TAP_VY,
  UFO_TAP_VY_MINI,
  WAVE_SLOPE,
  clamp,
  expSmooth,
} from "../constants.ts";
import { shape, type Shape } from "../core/hitbox.ts";
import type { InputState, SimEvent } from "../types.ts";
// Type-only, so this does not create a runtime cycle with player.ts.
import type { Player } from "../player.ts";

export type GameMode = "cube" | "ship" | "ball" | "ufo" | "wave";

export type ModeDef = {
  readonly id: GameMode;
  readonly label: string;
  /**
   * The body, in canonical hitbox units. THE one place a mode's size is stated.
   * Every box the player collides with is derived from this by the single rule
   * in core/hitbox.ts, so a size portal scales all of them at once.
   */
  readonly body: Shape;
  /** How hard the camera chases this mode. Flying modes need a tighter follow. */
  readonly cameraK: number;
  /**
   * How the camera tracks this mode.
   *
   * "ground"   — the view holds still until the player climbs past a threshold.
   *              Right for modes that live on a surface, where every jump
   *              would otherwise bob the screen.
   * "anchored" — the view locks to the portal that started the section. This is
   *              how the real game frames ship and ball: the window is fixed by
   *              where the portal put you, so the whole section is composed
   *              around a known viewport rather than chasing the player.
   * "free"     — the view follows the player continuously.
   *
   * Declared here so a new mode picks its camera the same way it picks its
   * body, rather than the renderer growing another `mode === "ship"` branch.
   */
  readonly camera: "ground" | "anchored" | "free";
  /**
   * The play area a portal for this mode establishes, in tiles, centred on the
   * portal it came from.
   *
   * null means the mode has no section of its own and plays against the level's
   * ground — that is the cube. A flying mode MUST declare one: a ship with no
   * bound is a ship that can leave the level, and the section is what the
   * designer composed the passage inside.
   *
   * Per mode rather than one global corridor height, because the modes are not
   * the same shape: a wave needs a tighter channel than a ship, and a UFO sits
   * between them.
   */
  readonly sectionTiles: number | null;
  /** Whether this mode rests on surfaces. Flying modes never report onGround. */
  readonly grounded: boolean;
  /** Vertical acceleration and clamp for one step. Mutates the player. */
  readonly applyInput: (p: Player, input: InputState, dt: number, out: SimEvent[]) => void;
  /**
   * Rotation for one step. Cosmetic, but gameplay-visible in flying modes —
   * you read the nose angle to judge a climb, so it takes the input too and can
   * respond on the press rather than waiting for velocity to build.
   */
  readonly applyRotation: (p: Player, input: InputState, speed: number, dt: number) => void;
};

/** Cap "falling" speed in whichever direction gravity currently points. */
function capFall(p: Player, terminal: number): void {
  p.vy = p.gravitySign === 1 ? Math.max(p.vy, terminal) : Math.min(p.vy, -terminal);
}

/** Velocity relative to gravity: positive while moving toward current "up". */
function riseVel(p: Player): number {
  return p.vy * p.gravitySign;
}

/**
 * The flying clamp, decompiled: rise capped harder than fall, both divided by
 * MINI_FLY_SCALE when mini (a mini ship is FASTER vertically, which is why
 * mini ship corridors feel so twitchy in the real game).
 */
function capFlying(p: Player): void {
  const s = p.isMini() ? MINI_FLY_SCALE : 1;
  const rise = FLY_RISE_MAX / s;
  const fall = -FLY_FALL_MAX / s;
  const v = clamp(riseVel(p), fall, rise);
  p.vy = v * p.gravitySign;
}

const cube: ModeDef = {
  id: "cube",
  label: "Cube",
  body: shape(1, 1),
  cameraK: CAM_K_CUBE,
  camera: "ground",
  sectionTiles: null,
  grounded: true,
  applyInput(p, input, dt, out) {
    // The jump condition is `held`, not a press edge. That is the actual rule,
    // not a simplification: holding makes the cube re-jump the instant it
    // lands, which is why the core loop needs no edge detection anywhere.
    if (input.held && p.onGround) {
      // Mini jumps at 0.8x, the decompiled v16 factor — velocity, not hitbox.
      p.vy = CUBE_JUMP_VY * (p.isMini() ? MINI_JUMP_SCALE : 1) * p.gravitySign;
      p.onGround = false;
      out.push({ type: "jump" });
    } else {
      p.vy += CUBE_GRAVITY * p.gravitySign * dt;
    }
    capFall(p, CUBE_TERMINAL_VY);
  },
  applyRotation(p, _input, _speed, dt) {
    if (p.onGround) {
      // Snap to the nearest quarter turn on landing so the cube reads as
      // settled. A full uninterrupted jump accumulates exactly PI, which is why
      // a hop between two same-height surfaces lands it 180 degrees flipped.
      const quarter = Math.PI / 2;
      p.rot = Math.round(p.rot / quarter) * quarter;
      // Rotation is never reset, so bound it or a long session loses precision.
      p.rot %= Math.PI * 2;
    } else {
      // Negative because world space is counter-clockwise positive and a cube
      // travelling right rolls forward, i.e. clockwise on screen.
      p.rot -= CUBE_SPIN_RATE * p.gravitySign * dt;
    }
  },
};

const ship: ModeDef = {
  id: "ship",
  label: "Ship",
  // 30x20. Declared here rather than inferred by collision code asking the mode
  // its name; see core/hitbox.ts for why this is a scale and not a fixed size.
  body: shape(1, 2 / 3),
  cameraK: CAM_K_SHIP,
  camera: "anchored",
  sectionTiles: 10,
  grounded: false,
  applyInput(p, input, dt) {
    // The real ship is gravity with a state-dependent multiplier, four states
    // in total (see SHIP_ACCEL — positive magnitudes). Everything is relative
    // to current gravity: "rising" means moving toward current up, holding
    // accelerates toward up, releasing toward down.
    const rising = riseVel(p) >= 0;
    const a = input.held
      ? rising
        ? SHIP_ACCEL.holdRising
        : SHIP_ACCEL.holdDiving
      : rising
        ? -SHIP_ACCEL.releaseRising
        : -SHIP_ACCEL.releaseFalling;
    const mini = p.isMini() ? 1 / MINI_FLY_SCALE : 1;
    p.vy += a * mini * p.gravitySign * dt;
    capFlying(p);
  },
  applyRotation(p, _input, speed, dt) {
    // Straight from the velocity vector, which is how the real game does it:
    // nose up while climbing, nose down while falling, and never lying about
    // which way the ship is actually going.
    const target = clamp(Math.atan2(p.vy, speed), -SHIP_ROT_MAX, SHIP_ROT_MAX);
    p.rot = expSmooth(p.rot, target, SHIP_ROT_K, dt);
  },
};

const ball: ModeDef = {
  id: "ball",
  label: "Ball",
  body: shape(1, 1),
  cameraK: 12,
  camera: "anchored",
  sectionTiles: 10,
  grounded: true,
  applyInput(p, input, dt, out) {
    // A tap on a surface flips gravity AND launches at 0.6x jump velocity
    // toward the old up (decompiled: the jump fires, then the flip, then
    // vy *= 0.6). Edge-triggered: holding must not flip every step.
    if (input.held && input.ringArmed && p.onGround) {
      input.ringArmed = false;
      p.vy = BALL_TAP_VY * (p.isMini() ? MINI_JUMP_SCALE : 1) * p.gravitySign;
      p.gravitySign = p.gravitySign === 1 ? -1 : 1;
      p.onGround = false;
      out.push({ type: "gravity", sign: p.gravitySign });
    }
    p.vy += BALL_GRAVITY * p.gravitySign * dt;
    capFall(p, BALL_TERMINAL_VY);
  },
  applyRotation(p, _input, speed, dt) {
    // Rolls with distance travelled, so it looks right at any speed.
    p.rot -= BALL_ROLL_RATE * speed * dt * p.gravitySign;
  },
};

const ufo: ModeDef = {
  id: "ufo",
  label: "UFO",
  body: shape(1, 1),
  cameraK: 16,
  camera: "free",
  sectionTiles: 10,
  grounded: true,
  applyInput(p, input, dt, out) {
    // Unlike the cube, a tap works in mid-air — but only on the press edge,
    // and it SETS velocity rather than adding (decompiled setYVelocity).
    // The real game only applies the hop when it would not slow an existing
    // climb; a chained tap mid-rise therefore cannot brake the UFO.
    if (input.held && input.ringArmed) {
      input.ringArmed = false;
      const tap = p.isMini() ? UFO_TAP_VY_MINI : UFO_TAP_VY;
      if (riseVel(p) < tap) {
        p.vy = tap * p.gravitySign;
        p.onGround = false;
        out.push({ type: "jump" });
      }
    }
    // Gravity is asymmetric: stronger while the hop is rising than in the
    // fall that follows. See UFO_GRAVITY_* for the decompiled multipliers.
    const g = riseVel(p) >= 0 ? UFO_GRAVITY_RISING : UFO_GRAVITY_FALLING;
    const mini = p.isMini() ? 1 / MINI_FLY_SCALE : 1;
    p.vy += g * mini * p.gravitySign * dt;
    capFlying(p);
  },
  applyRotation(p) {
    p.rot = 0;
  },
};

const wave: ModeDef = {
  id: "wave",
  label: "Wave",
  body: shape(1 / 2, 1 / 2),
  cameraK: 26,
  camera: "free",
  sectionTiles: 8,
  grounded: false,
  applyInput(p, input) {
    // No gravity and no acceleration: a constant diagonal that reverses on tap.
    p.vy = (input.held ? WAVE_SLOPE : -WAVE_SLOPE) * p.speed() * p.gravitySign;
  },
  applyRotation(p, _input, speed) {
    p.rot = Math.atan2(p.vy, speed);
  },
};

export const MODES: Record<GameMode, ModeDef> = { cube, ship, ball, ufo, wave };

/** Modes a level file is currently allowed to reference. */
export const PLAYABLE_MODES: GameMode[] = ["cube", "ship", "ball", "ufo"];
