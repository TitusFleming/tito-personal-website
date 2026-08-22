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
  CAM_K_CUBE,
  CAM_K_SHIP,
  BALL_ROLL_RATE,
  BALL_TERMINAL_VY,
  CUBE_GRAVITY,
  CUBE_JUMP_VY,
  CUBE_SPIN_RATE,
  CUBE_TERMINAL_VY,
  SHIP_GRAVITY,
  SHIP_MAX_VY,
  SHIP_ROT_K,
  SHIP_ROT_MAX,
  SHIP_THRUST,
  UFO_GRAVITY,
  UFO_TAP_VY,
  UFO_TERMINAL_VY,
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
   * "ground" — the view holds still until the player climbs past a threshold.
   *            Right for modes that live on a surface, where every jump would
   *            otherwise bob the screen.
   * "free"   — the view follows the player continuously. Right for modes that
   *            fly, where vertical position IS the gameplay and pinning the
   *            camera hides the route you are climbing for.
   *
   * Declared here so a new mode picks its camera the same way it picks its
   * body, rather than the renderer growing another `mode === "ship"` branch.
   */
  readonly camera: "ground" | "free";
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

const cube: ModeDef = {
  id: "cube",
  label: "Cube",
  body: shape(1, 1),
  cameraK: CAM_K_CUBE,
  camera: "ground",
  grounded: true,
  applyInput(p, input, dt, out) {
    // The jump condition is `held`, not a press edge. That is the actual rule,
    // not a simplification: holding makes the cube re-jump the instant it
    // lands, which is why the core loop needs no edge detection anywhere.
    if (input.held && p.onGround) {
      p.vy = CUBE_JUMP_VY * p.gravitySign;
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
  camera: "free",
  grounded: false,
  applyInput(p, input, dt) {
    p.vy += (input.held ? SHIP_THRUST : SHIP_GRAVITY) * p.gravitySign * dt;
    p.vy = clamp(p.vy, -SHIP_MAX_VY, SHIP_MAX_VY);
  },
  applyRotation(p, _input, speed, dt) {
    // Straight from the velocity vector, which is how the real game does it:
    // nose up while climbing, nose down while falling, and never lying about
    // which way the ship is actually going.
    const target = clamp(Math.atan2(p.vy, speed), -SHIP_ROT_MAX, SHIP_ROT_MAX);
    p.rot = expSmooth(p.rot, target, SHIP_ROT_K, dt);
  },
};

// ── Untuned modes ───────────────────────────────────────────────────────────
// Real implementations, but no level in this project reaches them yet and the
// numbers are not measured against the real game. They are here because a seam
// you have never put a second thing through is not yet known to be a seam.

const ball: ModeDef = {
  id: "ball",
  label: "Ball",
  body: shape(1, 1),
  cameraK: 12,
  camera: "ground",
  grounded: true,
  applyInput(p, input, dt, out) {
    // A tap flips gravity instead of launching. Edge-triggered: holding must
    // not flip every step.
    if (input.held && input.ringArmed && p.onGround) {
      input.ringArmed = false;
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
  grounded: true,
  applyInput(p, input, dt, out) {
    // Unlike the cube, a tap works in mid-air — but only on the press edge.
    if (input.held && input.ringArmed) {
      input.ringArmed = false;
      p.vy = UFO_TAP_VY * p.gravitySign;
      p.onGround = false;
      out.push({ type: "jump" });
    } else {
      p.vy += UFO_GRAVITY * p.gravitySign * dt;
    }
    capFall(p, UFO_TERMINAL_VY);
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
export const PLAYABLE_MODES: GameMode[] = ["cube", "ship"];
