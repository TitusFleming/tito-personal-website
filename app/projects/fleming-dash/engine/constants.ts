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
// Apex height and horizontal reach are set independently, and only one of them
// is safe to change:
//
//   apex     = CUBE_JUMP_VY^2 / (2 * |CUBE_GRAVITY|) = 559^2 / 5200 = 60.09 px = 2.00 tiles
//   airtime  = 2 * CUBE_JUMP_VY / |CUBE_GRAVITY|     = 1118 / 2600  = 0.4300 s
//   distance = airtime * SPEED_1X                    = 0.4300 * 311.58 = 134.0 px = 4.47 tiles
//
// The apex MUST stay at two tiles: Stereo Madness contains two-tile steps, and
// dropping below that makes parts of the real level impossible. So the fix for
// "the jump goes too far" is to raise gravity and jump velocity together, which
// keeps the height and shortens the arc — a snappier jump, not a smaller one.
//
// This moved from 2160/509 (4.90 tiles of reach, which read as floaty and
// overshot landings) to 2600/559 (4.47 tiles). If it still feels long, scale
// both numbers up again keeping v^2 / 2g = 60, e.g. 3000 / 600.

export const CUBE_GRAVITY = -2600;
export const CUBE_JUMP_VY = 559;
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

/**
 * Exactly one half-turn per jump.
 *
 * This is why a jump between two surfaces at the same height lands the cube
 * 180 degrees flipped rather than at some arbitrary angle: airtime is 0.43 s
 * and the rate is PI per 0.43 s, so a full uninterrupted jump accumulates
 * exactly PI. Landing then snaps to the nearest quarter turn, which that lands
 * on exactly. Keep this tied to the airtime above — if the jump arc changes,
 * this has to change with it or cubes start landing crooked.
 */
export const CUBE_SPIN_RATE = Math.PI / 0.43;

// ── Boosts ──────────────────────────────────────────────────────────────────
// Derived from tile-height targets rather than measured, so these are estimates.

/** Yellow pad, targeting a 3.7-tile bounce: sqrt(2 * 2600 * 111) = 760. */
export const PAD_YELLOW_VY = 760;
/** A ring gives exactly a normal jump, but in mid-air — so it tracks CUBE_JUMP_VY. */
export const RING_YELLOW_VY = 559;

// ── Collision forgiveness ───────────────────────────────────────────────────
// This block is what separates "hard" from "unfair". All four need tuning by
// feel, and they are the first thing to touch when a jump "should have worked".

/** How far below a tile's top the previous bottom may sit and still count as landing on it. */
export const LAND_TOLERANCE = 2;

/**
 * The player has two hitboxes, which is how the real game works and why it
 * feels fair despite being brutal:
 *
 *   Main hitbox  — the full 30x30 AABB. Used against HAZARDS. A spike's own
 *                  lethal rect is tiny (6x12 for id 8), so the forgiveness
 *                  lives in the spike, not in shrinking the player.
 *   Solid hitbox — a much smaller box at the player's centre, sometimes called
 *                  the "blue" hitbox. Used only to decide whether running into
 *                  a block's FACE kills you. Landing on top still uses the full
 *                  box, so platforms behave normally.
 *
 * The consequence is that clipping a block's corner is survivable — the corner
 * has to reach the middle of the cube to count — without any special-case
 * grace rule. This replaced an earlier single SIDE_KILL_DEPTH fudge.
 *
 * The community documents the main box as exactly 30 units and the solid box as
 * "much smaller" but publishes no exact figure I could find, so this ratio is a
 * tunable: raise it to make wall deaths harsher, lower it to be kinder.
 */
export const SOLID_HITBOX_SCALE = 0.3;

/** Main hitbox is the full player box, so hazards get no extra inset. */
export const HAZARD_INSET = 0;
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

/**
 * How many tiles of world height fill the viewport.
 *
 * The game zooms to show this many rows whatever the window size, the way the
 * real one does. Without it the world draws 1:1 and a tall browser window is
 * mostly empty sky with a tiny player, while a short one crops the ship
 * sections — the visible playfield would depend on the reader's window, which
 * changes the difficulty.
 */
export const VIEW_TILES = 11;

/**
 * Hard ceiling on how high the camera may look, in tiles above the ground.
 *
 * Ship corridors are capped at 10 tiles, so without this the camera happily
 * followed the ship into empty sky above the level and showed a blank blue
 * field with nothing in it. The player can't get up there; the camera shouldn't
 * either.
 */
export const WORLD_TOP_TILES = 13;

/** The player sits this far from the left edge, so you can see what is coming. */
export const CAM_ANCHOR_FRAC = 0.32;

/**
 * How far above the player the camera sits, as a fraction of view height.
 *
 * Pushes the player down into the lower third so most of the screen shows what
 * is ahead and above rather than the solid ground band below.
 */
export const CAM_Y_OFFSET_FRAC = 0.16;

/** Half-height of the vertical dead band. In cube mode the player rarely leaves it, so the camera sits still. */
export const CAM_Y_DEADZONE_FRAC = 0.08;

/**
 * Seconds of vertical velocity the camera looks ahead by.
 *
 * Without it the camera only reacts once the player has already moved, which is
 * worst on the way down: you fall into screen space you cannot see yet. Leading
 * by a fraction of a second means a descent reveals what is underneath before
 * you arrive, and it costs nothing on the way up because the same lead pushes
 * the view upward there.
 */
export const CAM_LOOKAHEAD_S = 0.16;
// Raised sharply: at 6/9 with a wide dead band the camera lagged behind the
// player badly enough to lose them off the top of the frame in ship sections.
export const CAM_K_CUBE = 11;
export const CAM_K_SHIP = 20;

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
