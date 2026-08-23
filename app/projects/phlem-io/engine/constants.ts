// Every tunable number in Phlem.io, in one file.
//
// WHERE THE NUMBERS COME FROM
// The core cell mechanics are the vanilla agar.io values as documented by the
// open-source Ogar server family, which reimplemented the original game's
// behaviour and ships them as config:
//
//   github.com/OgarProject/Ogar        src/gameserver.ini
//   github.com/Barbosik/MultiOgar      src/gameserver.ini (annotates "vanilla")
//
// Those give: food mass 1, player start mass 10, minimum split at size 60
// (mass 36), recombine base 30 s, decay 0.002/s, virus size 100-140
// (mass 100-196), and the size<->mass rule size = sqrt(mass * 100).
// The speed-falls-with-size exponent (0.449 on radius) is the community-
// measured curve for the original client.
//
// Everything else is a judgement call for a single-player arena and is
// marked as such. World units are pixels; masses are agar.io masses.

/** size = sqrt(mass * 100), i.e. radius = 10 * sqrt(mass). Vanilla rule. */
export const radiusOf = (mass: number): number => 10 * Math.sqrt(mass);

// ── Cells (vanilla, via Ogar) ───────────────────────────────────────────────
export const START_MASS = 10;
export const PELLET_MASS = 1;
/** A piece must be at least this massive to split (vanilla size 60). */
export const MIN_SPLIT_MASS = 36;
/** An actor never has more pieces than this. */
export const MAX_PIECES = 16;
/** Seconds before two pieces of one actor may recombine. */
export const RECOMBINE_BASE_S = 30;
/**
 * Larger cells wait longer to merge. The base 30 s is Ogar's; the per-mass
 * term is the community-documented 2.33% of mass in seconds. Judgement only
 * in trusting the community figure for the coefficient.
 */
export const RECOMBINE_PER_MASS_S = 0.0233;
/** Fraction of mass lost per second. Vanilla playerMassDecayRate. */
export const DECAY_PER_S = 0.002;
/** Below this mass nothing decays (Ogar playerMinMassDecay). */
export const DECAY_MIN_MASS = 9;

// ── Eating ──────────────────────────────────────────────────────────────────
/** Predator must be at least 25% more massive than prey. Vanilla rule. */
export const EAT_MASS_RATIO = 1.25;
/**
 * And must genuinely cover it: the centre distance has to be inside the
 * predator's radius minus 40% of the prey's, which is Ogar's eating range.
 */
export const EAT_DEPTH_FRAC = 0.4;

// ── Speed ───────────────────────────────────────────────────────────────────
/**
 * v = SPEED_COEF / r^0.449 px/s. The exponent is the community-measured
 * vanilla curve; the coefficient is a judgement call scaled so a fresh
 * mass-10 blob moves ~250 px/s on our map, which reads like the original.
 */
export const SPEED_EXP = 0.449;
export const SPEED_COEF = 1180;

// ── Splitting ───────────────────────────────────────────────────────────────
/** Launch speed of a split half, px/s. Judgement: tuned to overshoot about
 *  four radii of a start-size blob, which is roughly the vanilla reach. */
export const SPLIT_LAUNCH = 760;
/** Exponential decay rate of the launch impulse, per second. Judgement. */
export const SPLIT_FRICTION = 4.4;

// ── Viruses ─────────────────────────────────────────────────────────────────
/** Vanilla virus size range 100-140 -> mass 100-196. */
export const VIRUS_MIN_MASS = 100;
export const VIRUS_MAX_MASS = 196;
/**
 * How many viruses the arena holds. Judgement: vanilla runs dozens on a much
 * larger map; this keeps a comparable density on ours.
 */
export const VIRUS_COUNT = 14;
/**
 * Popping on a virus bursts the piece into this many shards at most (fewer
 * when the 16-piece cap is close). Judgement within the vanilla behaviour of
 * "explodes into many small cells".
 */
export const VIRUS_POP_SHARDS = 7;

// ── Arena (all judgement, sized for 1 player + ~20 bots) ────────────────────
export const WORLD_SIZE = 6000;
export const PELLET_TARGET = 900;
/** Pellets respawned per second while under target. */
export const PELLET_RESPAWN_PER_S = 30;
export const BOT_COUNT = 20;

// ── Bot identities ──────────────────────────────────────────────────────────
/**
 * A bot "player" leaves after being fully eaten this many times, then a new
 * name joins — deaths alone should not empty the lobby, per the design.
 * Uniform in [min, max]; expect to tune.
 */
export const BOT_DEATHS_MIN = 10;
export const BOT_DEATHS_MAX = 15;
/** Seconds a dead bot waits before rejoining under the same name. */
export const RESPAWN_DELAY_S = 2.5;
/**
 * Rich players ragequit: past this total mass a bot starts a quit timer,
 * because a blob this size on this map can otherwise never die. Judgement.
 */
export const BIG_QUIT_MASS = 9000;
/** The quit timer, seconds. Randomised per bot in [min, max]. Judgement. */
export const BIG_QUIT_MIN_S = 50;
export const BIG_QUIT_MAX_S = 110;

// ── Bot behaviour (all judgement — "human-like", not optimal) ───────────────
/** Seconds between decisions; randomised per bot so reactions are staggered. */
export const BOT_THINK_MIN_S = 0.15;
export const BOT_THINK_MAX_S = 0.35;
/** How far a bot notices things, as a multiple of its biggest radius. */
export const BOT_VIEW_RADII = 11;
/** Minimum absolute view so tiny bots are not blind. */
export const BOT_VIEW_MIN = 900;
/** Threats inside this many of MY radii trigger fleeing. */
export const BOT_FLEE_RADII = 5.5;

// ── Loop ────────────────────────────────────────────────────────────────────
export const FIXED_DT = 1 / 60;
export const MAX_STEPS_PER_FRAME = 8;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;
