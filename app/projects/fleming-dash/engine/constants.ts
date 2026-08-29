// Every tunable number in the game, in one file.
//
// World space is y-up, in pixels, with the origin at the level's default ground
// surface. Gravity is therefore negative and jump velocity positive. The
// renderer flips y once, on the way to the screen, and nothing else in the
// engine has to think about it.
//
// ── WHERE THE PHYSICS NUMBERS COME FROM ─────────────────────────────────────
//
// Real GD integrates per 60 Hz frame, in "units" (30 units = one grid block =
// one of our tiles), and multiplies every velocity step by 0.9 before use
// (`dtSlow = dt * 0.9` — the game's own timescale). Sources, in order of
// authority:
//
//   1. github.com/camila314/gdp — decompilations of the live 2.2 binary
//      (PlayerObject::updateJump, ::boostPlayer). Gravity 0.9582, flying
//      clamps 8.0 / -6.4, UFO tap 7.0 (mini 8.0 * 0.85), ball and UFO gravity
//      multipliers, terminal fall 15, mini jump scale 0.8.
//   2. github.com/Open-GD/OpenGD — reverse-engineered recreation. Exact
//      constants m_dGravity = 0.958199, m_dJumpHeight = 11.180032, the
//      0.9 timescale, ship accel states, pad force 16, orb multipliers.
//   3. GD Docs (boomlings.dev/reference/player_physics/hitboxes) — hitboxes:
//      every mode's outer box 30 units (18 mini), inner box 9, wave 10/3.
//
// Converting per-frame units to this engine's continuous px/s:
//
//   velocity: 1 unit/frame  = 0.9 * 60           = 54 px/s
//   accel:    1 unit/frame^2 = 0.9^2 * 60^2      = 2916 px/s^2
//
// (One 0.9 lands on the velocity update, the second on the position update —
// both integrations pass through dtSlow.) The proof the model is right is the
// speed table: GD's 1x horizontal speed is 5.77 units/frame * 54 = 311.58 px/s,
// exactly the long-established community figure in SPEEDS below.

/** Grid cell size. Everything is authored in grid units; pixels appear here and in the renderer. */
export const TILE = 30;

/** px/s per (GD unit per frame). The 0.9 is GD's own timescale. See header. */
export const GD_VEL = 0.9 * 60;
/** px/s^2 per (GD unit per frame^2). 0.9 applies to both integrations. */
export const GD_ACC = 0.9 * 0.9 * 60 * 60;

/** The decompiled base gravity, GD units/frame^2. Shared by every mode. */
const GD_GRAVITY = 0.958199;

// Horizontal speed lives in the SPEEDS table further down: it is player state
// set by speed portals, not a level-wide constant.

// ── Cube ────────────────────────────────────────────────────────────────────
// Straight conversions of the decompiled constants. Derived behaviour:
//
//   apex     = 603.72^2 / (2 * 2794.11) = 65.22 px = 2.174 tiles
//   airtime  = 2 * 603.72 / 2794.11     = 0.4321 s
//   distance = 0.4321 * SPEEDS[1]       = 134.6 px = 4.49 tiles at 1x
//
// all of which match the community-measured figures for the real game (jump
// height "2.17 blocks", jump length "about 4.5 blocks at 1x").

export const CUBE_GRAVITY = -GD_GRAVITY * GD_ACC; // -2794.108 px/s^2
export const CUBE_JUMP_VY = 11.180032 * GD_VEL; // 603.72 px/s

/**
 * Downward speed cap: the decompiled -15 units/frame clamp, applied in every
 * non-flying mode.
 *
 * Also the number that keeps collision simple: at 810 px/s a 1/240 s step moves
 * 3.4 px, well under one 30 px tile, so a discrete overlap test cannot tunnel
 * through a floor. See FIXED_DT.
 */
export const CUBE_TERMINAL_VY = -15 * GD_VEL; // -810 px/s

// ── Mini ────────────────────────────────────────────────────────────────────
/**
 * Mini velocity scales, decompiled: jumps scale by 0.8 (`v16` in updateJump),
 * and flying modes divide accel and clamps by 0.85 instead. Distinct from
 * SIZE_MINI, which is the HITBOX scale (18/30 per GD Docs).
 */
export const MINI_JUMP_SCALE = 0.8;
export const MINI_FLY_SCALE = 0.85;

// ── Ship ────────────────────────────────────────────────────────────────────
/**
 * The ship is gravity with a state-dependent multiplier — there is no separate
 * "thrust" constant in the real game. Decompiled (camila314/gdp, OpenGD):
 *
 *   holding, moving up    ->  0.4 * g upward
 *   holding, still diving ->  0.5 * g upward   (catches a dive faster)
 *   released, moving up   -> 0.48 * g downward (1.2 * 0.4)
 *   released, falling     -> 0.32 * g downward (0.8 * 0.4)
 *
 * "up/down" here are relative to current gravity. The stronger catch on a dive
 * and the gentler pull once already falling are what make the real ship feel
 * eager without a fake thrust figure.
 */
export const SHIP_ACCEL = {
  holdRising: 0.4 * GD_GRAVITY * GD_ACC,
  holdDiving: 0.5 * GD_GRAVITY * GD_ACC,
  releaseRising: 1.2 * 0.4 * GD_GRAVITY * GD_ACC,
  releaseFalling: 0.8 * 0.4 * GD_GRAVITY * GD_ACC,
} as const;

/**
 * Flying-mode velocity clamps, decompiled: rise capped at 8 units/frame, fall
 * at 6.4 (the 0.8 * 8 in updateJump). Asymmetric — the real ship dives slower
 * than it climbs. Mini divides both by MINI_FLY_SCALE (decomp: 9.4118/7.5294).
 */
export const FLY_RISE_MAX = 8 * GD_VEL; // 432 px/s
export const FLY_FALL_MAX = 6.4 * GD_VEL; // 345.6 px/s
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
 * DERIVED from the jump constants, never set by hand: a full uninterrupted
 * jump lasts 2 * CUBE_JUMP_VY / |CUBE_GRAVITY| seconds and accumulates exactly
 * PI, so a hop between two same-height surfaces lands the cube 180 degrees
 * flipped and the landing snap to a quarter turn is exact. When the jump arc
 * changes, this follows automatically.
 */
export const CUBE_AIRTIME = (2 * CUBE_JUMP_VY) / -CUBE_GRAVITY; // 0.4321 s
export const CUBE_SPIN_RATE = Math.PI / CUBE_AIRTIME;


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
/**
 * Convert a documented Y-speed into px/s, KEEPING ITS SIGN.
 *
 * The table's unit is now pinned exactly: the game's displayed "Y speed" is in
 * multiples of the 1x horizontal speed, 5.77 units/frame — so one Y-speed unit
 * is precisely SPEEDS[1] = 311.58 px/s. The figures cross-check against the
 * decompilation: yellow pad 2.77 * 5.77 = 15.98 ~ OpenGD's propellPlayer force
 * of 16, and a normal jump is 11.18 / 5.77 = 1.94, the table's own jump row.
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
const ratio = (units: number) => units * 311.58;

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
 * No longer a guess: the GD Docs hitbox table gives the inner box as exactly
 * 9 units against a 30 unit body — 0.3. (Their table also says the MINI inner
 * box grows to 10 units rather than shrinking with the body; that quirk is
 * deliberately not modelled, which makes mini wall deaths here very slightly
 * kinder than the real game.)
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
 * Mini portal HITBOX scale: 18 / 30 units, straight from the GD Docs hitbox
 * table (boomlings.dev/reference/player_physics/hitboxes).
 *
 * The entire implementation of "mini" is this number reaching Player.sizeScale
 * (every box the player owns comes from one rule, so they all shrink together)
 * plus the MINI_JUMP_SCALE / MINI_FLY_SCALE velocity factors above — hitbox
 * scale and velocity scale are different numbers in the real game.
 */
export const SIZE_MINI = 0.6;
export const SIZE_NORMAL = 1;

// ── Ball and UFO ────────────────────────────────────────────────────────────
// Sourced from the same decompilations as the cube and ship (see header).
// Clubstep contains one ball and two UFO portals, so these are live.

/** Ball gravity is the base gravity at the decompiled 0.6 multiplier. */
export const BALL_GRAVITY = 0.6 * CUBE_GRAVITY; // -1676.46 px/s^2
export const BALL_TERMINAL_VY = CUBE_TERMINAL_VY; // the shared -15 clamp
/**
 * A ball tap flips gravity AND launches at 0.6 of the jump velocity toward the
 * old "up" (decomp: setYVelocity(jump) then flipGravity + vy *= 0.6). The
 * launch keeps the flip readable — the ball visibly leaves the surface rather
 * than merely beginning to fall away from it.
 */
export const BALL_TAP_VY = 0.6 * CUBE_JUMP_VY; // 362.2 px/s
/** Roll rate is presentation only: radians per px of travel, not sourced. */
export const BALL_ROLL_RATE = Math.PI / 45;

/**
 * UFO gravity is asymmetric in the decompilation: 0.6 * g while moving up
 * (the hop dies quickly), 0.4 * g while falling (the descent is gentle).
 */
export const UFO_GRAVITY_RISING = 0.6 * CUBE_GRAVITY; // -1676.46 px/s^2
export const UFO_GRAVITY_FALLING = 0.4 * CUBE_GRAVITY; // -1117.64 px/s^2
/** A tap SETS velocity to 7 units/frame (8 * 0.85 when mini), never adds. */
export const UFO_TAP_VY = 7 * GD_VEL; // 378 px/s
export const UFO_TAP_VY_MINI = 8 * MINI_FLY_SCALE * GD_VEL; // 367.2 px/s

/**
 * Wave moves on an exact 45-degree diagonal: the decompiled updateJump sets
 * vertical speed to the horizontal speed. No level here reaches it yet.
 */
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
