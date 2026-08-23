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

// Horizontal speed lives in the SPEEDS table further down: it is player state
// set by speed portals, not a level-wide constant.

// ── Cube ────────────────────────────────────────────────────────────────────
// Apex height and horizontal reach are set independently, and only one of them
// is safe to change:
//
//   apex     = CUBE_JUMP_VY^2 / (2 * |CUBE_GRAVITY|) = 559^2 / 5200 = 60.09 px = 2.00 tiles
//   airtime  = 2 * CUBE_JUMP_VY / |CUBE_GRAVITY|     = 1118 / 2600  = 0.4300 s
//   distance = airtime * SPEEDS[1]                   = 0.4300 * 311.58 = 134.0 px = 4.47 tiles
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

/**
 * SHIP FEEL. Three numbers, and only the first is documented.
 *
 * -25 b/s^2 (= -750 px/s^2 at 30 px per block) is the community-documented
 * ship gravity. Thrust is NOT documented anywhere I could find, and making it
 * equal and opposite — which an earlier version did, reasoning about "centred
 * controls" — is what made the ship feel heavy: with equal accelerations,
 * reversing from full dive to full climb takes 2 * MAX_VY / ACCEL, over a
 * second, which reads as flying a brick.
 *
 * Thrust therefore exceeds gravity, which is also how the real thing behaves:
 * holding climbs decisively rather than merely arresting a fall. Raise
 * SHIP_THRUST to make the ship lighter and more eager, lower it toward
 * |SHIP_GRAVITY| to make it heavier.
 *
 * Gravity is pulled slightly below the documented figure for the same reason.
 * Set it back to -750 for strict fidelity at the cost of feel.
 */
export const SHIP_GRAVITY = -760;
/** Replaces gravity while held. Deliberately stronger than gravity. */
export const SHIP_THRUST = 1180;
/**
 * Clamp on vertical speed, symmetric. Not documented; derived from the
 * corridor, which is ten tiles: this crosses one in roughly 0.9 s, fast enough
 * to feel responsive and slow enough to still be steerable.
 *
 * Lowering this makes the ship feel lighter and more twitchy; raising it lets
 * the ship build real momentum and feel heavier.
 */
export const SHIP_MAX_VY = 455;
// The ship's 30x20 body is declared as a scale in the MODES table, not as a
// pixel size here — see engine/core/hitbox.ts for why sizes are scales.

/**
 * Nose angle comes from the VELOCITY VECTOR and nothing else.
 *
 * That is how the real game does it — the ship's rotation correlates with its
 * vertical velocity, nose up while climbing, nose down while falling. A
 * previous version added a bias from the held button so the tip would flick up
 * the instant you pressed; that is not in the game and made the nose lie about
 * where the ship was actually going.
 *
 * The tip now reads correctly because the ship ACCELERATES properly, not
 * because the sprite is faked ahead of the physics.
 */
export const SHIP_ROT_MAX = (35 * Math.PI) / 180;
/** Exponential smoothing rate for ship rotation, per second. See expSmooth(). */
export const SHIP_ROT_K = 22;

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
/**
 * Pad and orb strengths, as documented multiples of the cube's jump.
 *
 * The game's own figures, in its Y-speed units, with a normal cube jump at
 * 1.94: yellow pad 2.77, pink 1.79, red 3.65, blue -1.37; yellow orb 1.91,
 * pink 1.37, red 2.68, blue -1.37, green -1.91, black -2.6. A negative value
 * means the boost also reverses gravity — black is the exception, slamming you
 * along the CURRENT down without flipping.
 *
 * Ratios rather than pixel velocities, so they stay correct if the jump is
 * ever retuned and a new colour is one row. An earlier version guessed these.
 */
const JUMP_UNITS = 1.94;

/**
 * Convert a documented Y-speed into px/s, KEEPING ITS SIGN.
 *
 * The sign is not decoration. In the game's own figures a negative Y-speed on a
 * boost means it launches you toward what will be "up" AFTER the gravity flip
 * that accompanies it. Taking the absolute value — which this used to do —
 * threw that away, and then launch() re-derived a direction from gravitySign
 * and got the opposite one. Every blue and green boost fired the player into
 * the surface they were standing on and killed them instantly.
 *
 * The rule, stated once: the table holds the game's signed value, launch()
 * flips gravity first and then applies `value * gravitySign`. A non-flipping
 * boost therefore pushes away from the current floor, and a flipping one pushes
 * away from the floor it just left.
 */
const ratio = (units: number) => (units / JUMP_UNITS) * CUBE_JUMP_VY;

export const PAD_TABLE = {
  yellow: { vy: ratio(2.77), flipsGravity: false },
  pink: { vy: ratio(1.79), flipsGravity: false },
  red: { vy: ratio(3.65), flipsGravity: false },
  blue: { vy: ratio(-1.37), flipsGravity: true },
} as const;

export const RING_TABLE = {
  yellow: { vy: ratio(1.91), flipsGravity: false },
  pink: { vy: ratio(1.37), flipsGravity: false },
  red: { vy: ratio(2.68), flipsGravity: false },
  blue: { vy: ratio(-1.37), flipsGravity: true },
  green: { vy: ratio(-1.91), flipsGravity: true },
  /** Slams you along the current down. Negative, and no flip. */
  black: { vy: ratio(-2.6), flipsGravity: false },
} as const;

// ── Collision forgiveness ───────────────────────────────────────────────────
// This block is what separates "hard" from "unfair", and it is the first thing
// to touch when a jump "should have worked".

/** How far below a surface's top the previous bottom may sit and still land on it. */
export const LAND_TOLERANCE = 2;

/**
 * The small centre box, as a fraction of the body.
 *
 * The player has two hitboxes, which is how the real game works and why it
 * feels fair despite being brutal: hazards test the FULL body, while only this
 * much smaller centre box decides whether running into a block's face kills
 * you. Clipping a corner is therefore survivable without any special-case rule.
 *
 * The community documents the main box as exactly 30 units and this one as
 * "much smaller" but publishes no figure, so it is a tunable: raise it to make
 * wall deaths harsher, lower it to be kinder.
 */
export const SOLID_HITBOX_SCALE = 0.3;

/**
 * A spike's lethal rect inside its 30x30 cell — deliberately much smaller than
 * the drawn triangle, which is how brushing a spike's edge survives.
 */
export const SPIKE_BOX = { dx: 12, dy: 2, w: 6, h: 12 } as const;

/**
 * How far a hazard may be from a surface and still be treated as resting on it.
 *
 * A quarter tile, matching the importer's quantisation: closer than this and
 * the gap is rounding, further and it is level design. See World.seatHazards.
 */
export const HAZARD_SEAT_SNAP = TILE * 0.26;

// ── Speeds ──────────────────────────────────────────────────────────────────
/**
 * The five speed-portal settings, px/s. Indexed by SpeedIndex.
 *
 * Speed is player state set by a portal, not a level-wide scalar: official
 * levels change speed mid-run from level 2 onward.
 */
export const SPEEDS = [251.16, 311.58, 387.42, 468.0, 576.0] as const;
/** Index into SPEEDS. 1 is the 1x default. */
export const SPEED_NORMAL = 1;

// ── Size ────────────────────────────────────────────────────────────────────
/**
 * Mini portal scale.
 *
 * The entire implementation of "mini" is this number reaching Player.sizeScale:
 * every box the player owns comes from one rule, so they all shrink together.
 */
export const SIZE_MINI = 0.5;
export const SIZE_NORMAL = 1;

// ── Modes beyond cube and ship ──────────────────────────────────────────────
// UNTUNED, AND NOW REACHABLE. Clubstep contains one ball and two UFO portals,
// so these numbers are live rather than theoretical.
//
// Their BEHAVIOUR is sourced: the ball reverses gravity on a tap and keeps its
// momentum, and the UFO gives a fixed mid-air hop per tap. Both match what is
// implemented. Their NUMBERS are not sourced — the community physics
// documentation covers only the cube (-72 b/s^2) and the ship (-25 b/s^2), and
// nothing published gives ball, UFO or wave figures.
//
// I attempted to tune the UFO by sweeping tap velocity and gravity against
// Clubstep's own two UFO sections. The sweep was inconclusive: every
// combination scored identically because the scripted driver dies on the same
// obstacle regardless, so the measurement could not tell good values from bad.
// These therefore remain judgement calls, and the ball and UFO sections will
// not feel like the real game until someone plays them and adjusts by hand.

export const BALL_GRAVITY = -2600;
export const BALL_TERMINAL_VY = -1000;
export const BALL_ROLL_RATE = Math.PI / 45;

export const UFO_GRAVITY = -1600;
export const UFO_TAP_VY = 400;
export const UFO_TERMINAL_VY = -1000;

export const WAVE_SLOPE = 1;

// ── Loop ────────────────────────────────────────────────────────────────────

/**
 * Fixed timestep. Not negotiable, for two independent reasons:
 *
 * 1. A variable-dt jump reaches a different apex on a 60 Hz laptop than on a
 *    144 Hz monitor. In a game built on memorising exact arcs, that means a
 *    level possible on one machine and impossible on another.
 * 2. Step size bounds tunnelling. At terminal velocity, 1/240 s moves 5.83 px
 *    against a 30 px tile — about 5x margin, so simple overlap tests are safe.
 */
export const FIXED_DT = 1 / 240;

/**
 * Above this, the frame is discarded and the run pauses instead of simulating.
 * A tab switch otherwise replays seconds of physics with no input.
 */
export const MAX_FRAME_DT = 0.25;

/** Ceiling on catch-up steps per frame, so a slow frame cannot spiral. */
export const MAX_STEPS_PER_FRAME = 30;

/** Pause on the death frame before auto-restarting. */
export const DEATH_FREEZE = 0.5;

// ── Camera ──────────────────────────────────────────────────────────────────
// Purely presentational — lives in the renderer, not the sim, so it can never
// affect determinism or replay tapes.
//
// The camera's target comes from the PLAYER and nothing else. The only thing it
// clamps against is a border the level itself declares (see World.playBounds).

/**
 * How many tiles of world height fill the viewport.
 *
 * The game zooms to show this many rows whatever the window size. Without it a
 * tall browser window is mostly empty sky and a short one crops the ship
 * sections, so the visible playfield — and the difficulty — would depend on the
 * reader's window.
 *
 * Twelve is load bearing, and it is GROUND_BAND_TILES that makes it so: a GD
 * ship corridor is ten tiles, so corridor plus the two-tile ground band is
 * exactly the viewport and a corridor view sits still.
 *
 * This was briefly eleven with a one-tile band, which squeezed the ground band
 * to half its height and shoved the player and everything standing on the floor
 * down against the bottom edge of the canvas — spikes read as half-buried.
 */
export const VIEW_TILES = 12;

/**
 * How much ground is visible below the floor line.
 *
 * Not decoration: it is the difference between the floor reading as ground and
 * reading as the bottom of the screen. Anything standing on the floor needs
 * room beneath it or it looks sunk.
 */
export const GROUND_BAND_TILES = 2;

/** The player sits this far from the left edge, so you can see what is coming. */
export const CAM_ANCHOR_FRAC = 0.32;

/**
 * How far above the player the camera sits, as a fraction of view height.
 * Pushes the player into the lower third so most of the screen shows what is
 * ahead and above rather than the solid ground band below.
 */
export const CAM_Y_OFFSET_FRAC = 0.16;

/**
 * How far above the floor the player must climb before the camera moves AT ALL.
 *
 * Five tiles is roughly two and a half cube jumps stacked, so ordinary
 * play — jumping, landing, hopping a one or two tile step — moves the view by
 * exactly nothing. The camera only starts to travel once the player is
 * genuinely ascending through the level.
 *
 * This replaced a scheme that anchored the view to the last surface landed on
 * and eased toward it. That anchor jumped on every single landing, so the
 * camera was permanently chasing a target that kept teleporting — which is
 * what made the movement jerky. The rule here has no discontinuities: the
 * camera's target is a continuous function of the player's height, flat inside
 * the band and 1:1 outside it.
 */
export const CAM_RISE_TILES = 5;

/**
 * Seconds of vertical velocity the camera looks ahead by.
 *
 * Without it the camera only reacts once the player has already moved, which is
 * worst on the way down: you fall into screen space you cannot see yet.
 */
export const CAM_LOOKAHEAD_S = 0.16;
export const CAM_K_CUBE = 11;
export const CAM_K_SHIP = 20;

/**
 * Frame-rate-independent exponential smoothing.
 *
 * The naive `v += (target - v) * 0.1` is a different filter at 60 Hz than at
 * 240 Hz, which would make the camera behave differently on different machines.
 */
export function expSmooth(current: number, target: number, k: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-k * dt));
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
