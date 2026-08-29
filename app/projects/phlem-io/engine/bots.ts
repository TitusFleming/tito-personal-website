// The bot brain: twenty demons pretending to be people.
//
// The design bar is "human-like", not "optimal". Concretely that means:
//
//   - Reactions are on a timer (thinkIn), staggered per bot, so nobody
//     responds frame-perfectly to anything.
//   - Target choice is scored, and the scoring HAS NO isPlayer TERM. The
//     player is chased exactly as often as a bot of the same size at the
//     same distance would be — that is asserted by a test, because it is a
//     design requirement, not an accident.
//   - Personality: each identity rolls aggression, caution and split-lust
//     once, so one demon plays coward and the next plays feeder.
//
// A bot decides ONE steering target per think and optionally a split. All
// the world-changing rules live in sim.ts; this file only ever writes
// aimX / aimY / wantSplit / thinkIn.

import {
  BOT_FLEE_RADII,
  BOT_THINK_MAX_S,
  BOT_THINK_MIN_S,
  BOT_VIEW_MIN,
  BOT_VIEW_RADII,
  EAT_MASS_RATIO,
  MIN_SPLIT_MASS,
  SPLIT_FRICTION,
  SPLIT_LAUNCH,
  WORLD_SIZE,
  clamp,
  radiusOf,
} from "./constants.ts";
import { range, type Rng } from "./rng.ts";
import type { Actor, PhlemSim } from "./sim.ts";

export type Persona = {
  /** Willingness to hunt when hunting and grazing are both on offer. */
  aggression: number;
  /** Multiplier on how early threats trigger fleeing. */
  caution: number;
  /** Probability per think of taking an available split-kill. */
  splitLust: number;
  /** Wander direction state, drifted a little every think. */
  wanderAngle: number;
};

export function makePersona(rng: Rng): Persona {
  return {
    aggression: range(rng, 0.25, 0.95),
    caution: range(rng, 0.65, 1.6),
    splitLust: range(rng, 0.05, 0.85),
    wanderAngle: range(rng, 0, Math.PI * 2),
  };
}

/** Centre of mass and the biggest piece, the two anchors of every decision. */
function anchors(a: Actor) {
  let x = 0;
  let y = 0;
  let m = 0;
  let biggest = a.pieces[0];
  for (const p of a.pieces) {
    x += p.x * p.mass;
    y += p.y * p.mass;
    m += p.mass;
    if (p.mass > biggest.mass) biggest = p;
  }
  return { cx: x / m, cy: y / m, mass: m, biggest };
}

export function thinkBot(bot: Actor, sim: PhlemSim): void {
  bot.thinkIn = range(sim.rng, BOT_THINK_MIN_S, BOT_THINK_MAX_S);
  const me = anchors(bot);
  const myR = radiusOf(me.biggest.mass);
  const view = Math.max(BOT_VIEW_MIN, myR * BOT_VIEW_RADII);

  // ── survey the room ───────────────────────────────────────────────────
  let fleeX = 0;
  let fleeY = 0;
  let fleeing = false;

  type Prey = { x: number; y: number; mass: number; dist: number };
  let prey: Prey | null = null;
  let preyScore = 0;

  for (const other of sim.actors) {
    if (other === bot || other.pieces.length === 0) continue;
    const them = anchors(other);
    const d = Math.hypot(them.cx - me.cx, them.cy - me.cy);
    if (d > view) continue;

    if (them.biggest.mass > me.biggest.mass * EAT_MASS_RATIO) {
      // A piece that could eat my biggest: run when it is close, "close"
      // scaled by how twitchy this personality is.
      const reach = radiusOf(them.biggest.mass) + myR * BOT_FLEE_RADII * bot.persona.caution;
      if (d < reach) {
        const w = 1 / Math.max(1, d * d);
        fleeX += (me.cx - them.cx) * w;
        fleeY += (me.cy - them.cy) * w;
        fleeing = true;
      }
      continue;
    }

    if (me.biggest.mass > them.biggest.mass * EAT_MASS_RATIO) {
      // Eatable. Score by meal size over distance — and by NOTHING else:
      // no isPlayer term, no grudges. The player is just another blob.
      const score = them.mass / (d + 150);
      if (score > preyScore) {
        preyScore = score;
        prey = { x: them.cx, y: them.cy, mass: them.biggest.mass, dist: d };
      }
    }
  }

  // ── choose ────────────────────────────────────────────────────────────
  if (fleeing) {
    const len = Math.hypot(fleeX, fleeY) || 1;
    bot.desiredX = me.cx + (fleeX / len) * 600;
    bot.desiredY = me.cy + (fleeY / len) * 600;
    bot.graze = null;
    bot.wantSplit = false;
    steerInsideWalls(bot, me.cx, me.cy);
    avoidViruses(bot, sim, me.biggest.mass, me.cx, me.cy);
    return;
  }

  if (prey && sim.rng() < bot.persona.aggression) {
    bot.desiredX = prey.x;
    bot.desiredY = prey.y;
    bot.graze = null;
    // Split-kill: only when the launched half still out-masses the target
    // and the lunge can actually reach them. Impulse travels roughly
    // launch/friction before dying out.
    const lunge = SPLIT_LAUNCH / SPLIT_FRICTION + myR;
    if (
      me.biggest.mass >= MIN_SPLIT_MASS &&
      me.biggest.mass / 2 > prey.mass * EAT_MASS_RATIO &&
      prey.dist < lunge &&
      sim.rng() < bot.persona.splitLust
    ) {
      bot.wantSplit = true;
    }
    avoidViruses(bot, sim, me.biggest.mass, me.cx, me.cy);
    return;
  }

  // ── graze ─────────────────────────────────────────────────────────────
  // Commit to ONE pellet and finish the trip. Re-choosing every think made
  // bots zig between equally good pellets, which read as jitter, not
  // indecision. A committed target is dropped only when reached (the pellet
  // is gone by then) or when it has left the view.
  if (bot.graze) {
    const d = Math.hypot(bot.graze.x - me.cx, bot.graze.y - me.cy);
    if (d < myR || d > view) bot.graze = null;
  }
  if (!bot.graze && sim.pellets.length > 0) {
    // Sample a handful and take the best value. Sampling (not a full scan)
    // keeps pathing a little sloppy, which reads as human.
    let best: { x: number; y: number } | null = null;
    let bestScore = 0;
    for (let i = 0; i < 14; i++) {
      const pe = sim.pellets[Math.floor(sim.rng() * sim.pellets.length)];
      const d = Math.hypot(pe.x - me.cx, pe.y - me.cy);
      if (d > view) continue;
      const score = 1 / (d + 60);
      if (score > bestScore) {
        bestScore = score;
        best = { x: pe.x, y: pe.y };
      }
    }
    bot.graze = best;
  }
  if (bot.graze) {
    bot.desiredX = bot.graze.x;
    bot.desiredY = bot.graze.y;
  } else {
    // Nothing in view: wander on a gently drifting heading.
    bot.persona.wanderAngle += range(sim.rng, -0.35, 0.35);
    bot.desiredX = me.cx + Math.cos(bot.persona.wanderAngle) * 500;
    bot.desiredY = me.cy + Math.sin(bot.persona.wanderAngle) * 500;
  }
  bot.wantSplit = false;
  steerInsideWalls(bot, me.cx, me.cy);
  avoidViruses(bot, sim, me.biggest.mass, me.cx, me.cy);
}

/** Corners are where blobs die; drift the wanted point back toward open water. */
function steerInsideWalls(bot: Actor, cx: number, cy: number): void {
  const margin = 350;
  if (cx < margin) bot.desiredX = Math.max(bot.desiredX, cx + 400);
  if (cx > WORLD_SIZE - margin) bot.desiredX = Math.min(bot.desiredX, cx - 400);
  if (cy < margin) bot.desiredY = Math.max(bot.desiredY, cy + 400);
  if (cy > WORLD_SIZE - margin) bot.desiredY = Math.min(bot.desiredY, cy - 400);
  bot.desiredX = clamp(bot.desiredX, 0, WORLD_SIZE);
  bot.desiredY = clamp(bot.desiredY, 0, WORLD_SIZE);
}

/**
 * A blob big enough to pop steers around viruses; a small one ignores them
 * entirely (in the real game small cells hide under viruses, and letting the
 * small bots wander through them reproduces that for free).
 */
function avoidViruses(bot: Actor, sim: PhlemSim, biggestMass: number, cx: number, cy: number): void {
  for (const v of sim.viruses) {
    if (biggestMass < v.mass * EAT_MASS_RATIO) continue;
    const d = Math.hypot(v.x - cx, v.y - cy);
    const danger = radiusOf(biggestMass) + radiusOf(v.mass) + 90;
    if (d > danger) continue;
    // Push the aim away, perpendicular-ish: keep going, just not through it.
    const awayX = cx - v.x;
    const awayY = cy - v.y;
    const len = Math.hypot(awayX, awayY) || 1;
    bot.desiredX += (awayX / len) * 500;
    bot.desiredY += (awayY / len) * 500;
  }
}
