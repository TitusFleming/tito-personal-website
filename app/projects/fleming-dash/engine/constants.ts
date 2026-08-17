// Every tunable number in the game, in one file.
//
// World space is y-up, in pixels, with the origin at the level's default ground
// surface. Gravity is therefore negative and jump velocity positive, which lets
// these read exactly as they were researched. The renderer flips y once, on the
// way to the screen, and nothing else in the engine has to think about it.
//
// A note on where these came from: they are the community-documented Geometry
// Dash values, converted from blocks/s^2 to px/s^2. They land within a pixel or
// two of the real game, not on it — real GD triggers a jump on the frame after
// landing and uses its own integration order. Tune these to feel, not to a
// reference video.

/** Grid cell size. Everything is authored in grid units; pixels appear here and in the renderer. */
export const TILE = 30;

// ── Speed ───────────────────────────────────────────────────────────────────
// Constant horizontal velocity — the player never accelerates sideways and
// never stops. Running into a wall kills you, it does not slow you down.

/** 1x speed: 10.386 tiles/s. */
export const SPEED_1X = 311.58;
/** 2x speed. Stereo Madness is entirely 1x (kA4 = 0), so this is unused for now. */
export const SPEED_2X = 387.42;

// ── Cube ────────────────────────────────────────────────────────────────────
// These three numbers are load-bearing and mutually consistent, which is good
// evidence they are the real ones:
//
//   apex     = CUBE_JUMP_VY^2 / (2 * |CUBE_GRAVITY|) = 509^2 / 4320 = 59.97 px = 2.00 tiles
//   airtime  = 2 * CUBE_JUMP_VY / |CUBE_GRAVITY|     = 1018 / 2160  = 0.4713 s
//   distance = airtime * SPEED_1X                    = 0.4713 * 311.58 = 146.9 px = 4.90 tiles
//
// Two tiles high and just under five long is exactly the documented cube jump.
// Change one of these and the other two stop matching, so change them together.

export const CUBE_GRAVITY = -2160; // -72 tiles/s^2
export const CUBE_JUMP_VY = 509;
export const CUBE_SIZE = 30;

/**
 * Downward speed cap.
 *
 * Also the number that keeps collision simple: at 1400 px/s a 1/240 s step moves
 * 5.83 px, well under one 30 px tile, so a discrete overlap test cannot tunnel
 * through a floor. See FIXED_DT.
 */
export const CUBE_TERMINAL_VY = -1400;

// ── Ship ────────────────────────────────────────────────────────────────────
// Held = thrust up, released = fall. The *ratio* of thrust to gravity is the
// feel here, and only the gravity figure is well-sourced, so expect to tune
// SHIP_THRUST first when the ship handles wrong.

export const SHIP_GRAVITY = -750; // -25 tiles/s^2, much gentler than the cube
/** Replaces gravity while held. Must exceed |SHIP_GRAVITY| or the ship cannot climb. */
export const SHIP_THRUST = 1050;
/** Symmetric clamp — the ship is as slow to climb as it is to fall. */
export const SHIP_MAX_VY = 345;
/** The ship is 30x20, not 30x30. Derived from mode every step, never stored. */
export const SHIP_H = 20;
export const SHIP_W = 30;

/** Nose follows the velocity vector, capped so it never points straight up. */
export const SHIP_ROT_MAX = (40 * Math.PI) / 180;
/** Exponential smoothing rate for ship rotation, per second. See expSmooth(). */
export const SHIP_ROT_K = 18;

/** One half-turn per jump, so the cube lands flat. Snaps to 90 degrees on landing. */
export const CUBE_SPIN_RATE = Math.PI / 0.4713;

// ── Boosts ──────────────────────────────────────────────────────────────────
// Derived from tile-height targets rather than measured, so these are estimates.

/** Yellow pad, targeting a 3.7-tile bounce: sqrt(2 * 2160 * 111). */
export const PAD_YELLOW_VY = 692;
/** Yellow ring gives exactly a normal jump, but in mid-air. */
export const RING_YELLOW_VY = 509;

// ── Collision forgiveness ───────────────────────────────────────────────────
// This block is what separates "hard" from "unfair". All four need tuning by
// feel, and they are the first thing to touch when a jump "should have worked".

/** How far below a tile's top the previous bottom may sit and still count as landing on it. */
export const LAND_TOLERANCE = 2;
/**
 * Embedded deeper than this into a tile's face means death; shallower is a
 * forgiving snap onto the top. Without this, clipping a corner by 3 px kills
 * you and the game feels broken. This is the single generosity knob.
 */
export const SIDE_KILL_DEPTH = 8;
/** The player's lethal box is inset this much per side: a 30x30 cube kills on 18x18. */
export const HAZARD_INSET = 6;
/**
 * A spike's lethal rect inside its 30x30 cell — deliberately much smaller than
 * the drawn triangle, which is how real GD lets you brush a spike's edge and live.
 */
export const SPIKE_BOX = { dx: 10, dy: 2, w: 10, h: 16 } as const;

// ── Loop ────────────────────────────────────────────────────────────────────

/**
 * Fixed timestep. Not negotiable, for two independent reasons:
 *
 * 1. A variable-dt jump reaches a different apex on a 60 Hz laptop than on a
 *    144 Hz monitor. In a game built on memorising exact arcs, that means a
 *    level that is possible on one machine and impossible on another.
 * 2. Step size bounds tunnelling. At terminal velocity, 1/240 s moves 5.83 px
 *    against a 30 px tile — about 5x margin, so simple overlap tests are safe
 *    and no swept AABB is needed. At 1/60 s it would be 23.3 px, which a
 *    thin platform would already slip through.
 */
export const FIXED_DT = 1 / 240;

/**
 * Above this, the frame is discarded and the run pauses instead of simulating.
 * A tab switch or a closed laptop lid otherwise replays seconds of physics with
 * no input, which is a guaranteed death the player never saw happen.
 */
export const MAX_FRAME_DT = 0.25;

/** Ceiling on catch-up steps per frame, so a slow frame cannot spiral. */
export const MAX_STEPS_PER_FRAME = 30;

/** Pause on the death frame before auto-restarting. */
export const DEATH_FREEZE = 0.5;

// ── Camera ──────────────────────────────────────────────────────────────────
// Purely presentational — lives in the renderer, not the sim, so it can never
// affect determinism or replay tapes.

/** The player sits this far from the left edge, so you can see what is coming. */
export const CAM_ANCHOR_FRAC = 0.32;
/** Half-height of the vertical dead band. In cube mode the player rarely leaves it, so the camera sits still. */
export const CAM_Y_DEADZONE_FRAC = 0.22;
export const CAM_K_CUBE = 6;
export const CAM_K_SHIP = 9;

/**
 * Frame-rate-independent exponential smoothing.
 *
 * The naive `v += (target - v) * 0.1` is a different filter at 60 Hz than at
 * 240 Hz, which would make the camera and the ship's nose behave differently on
 * different machines. This form does not.
 */
export function expSmooth(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-k * dt));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
