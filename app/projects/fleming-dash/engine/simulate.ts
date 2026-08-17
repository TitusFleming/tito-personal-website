// The state machine: one fixed step of the whole game.
//
// stepSim is pure in the sense that matters for testing — it mutates only the
// state handed to it, reads only the level and input, and *reports* side
// effects by pushing into `out` rather than calling audio, particles or React
// itself. That is what lets the entire game run headlessly under `node --test`,
// which in turn is what makes replay tapes possible.

import {
  CUBE_SIZE,
  DEATH_FREEZE,
  SHIP_H,
  TILE,
} from "./constants.ts";
import { ceilingAt, groundAt, hitsHazard, playerBox, overlaps, resolveSolids } from "./collision.ts";
import { applyRotation, applyVertical, integrate, playerHalfH } from "./physics.ts";
import type { CompiledLevel, InputState, SimEvent, SimState } from "./types.ts";

export function createSim(level: CompiledLevel, attempt = 1): SimState {
  return {
    status: "running",
    t: 0,
    mode: level.startMode,
    x: level.spawn.x,
    y: level.spawn.y,
    vy: 0,
    onGround: true,
    rot: 0,
    gravitySign: 1,
    attempt,
    maxX: 0,
    triggerTouch: new Uint8Array(level.triggerCount),
    deathTimer: 0,
  };
}

/** Reuse the state object so a restart allocates nothing. */
export function resetSim(s: SimState, level: CompiledLevel): void {
  s.status = "running";
  s.t = 0;
  s.mode = level.startMode;
  s.x = level.spawn.x;
  s.y = level.spawn.y;
  s.vy = 0;
  s.onGround = true;
  s.rot = 0;
  s.gravitySign = 1;
  s.attempt += 1;
  s.maxX = 0;
  s.triggerTouch.fill(0);
  s.deathTimer = 0;
}

function die(
  s: SimState,
  out: SimEvent[],
  cause: "hazard" | "wall" | "void",
): void {
  s.status = "dead";
  s.deathTimer = DEATH_FREEZE;
  out.push({ type: "death", x: s.x, y: s.y, cause });
}

/** Progress through the level, 0–100. Based on furthest reached, not current x. */
export function progressPercent(s: SimState, level: CompiledLevel): number {
  if (level.lengthPx <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((s.maxX / level.lengthPx) * 100)));
}

export function stepSim(
  s: SimState,
  level: CompiledLevel,
  input: InputState,
  dt: number,
  out: SimEvent[],
): void {
  if (s.status !== "running") {
    if (s.deathTimer > 0) s.deathTimer = Math.max(0, s.deathTimer - dt);
    return;
  }

  const hhBefore = playerHalfH(s);
  const prevBottom = s.y - hhBefore;
  const prevTop = s.y + hhBefore;

  applyVertical(s, input, dt, out);
  integrate(s, level.speed, dt);

  // Solids before hazards, deliberately. Landing on a block next to a spike
  // lifts the player out of the block, which may lift them clear of the spike
  // too — and erring toward survival is the whole design goal here.
  const wasOnGround = s.onGround;
  const solid = resolveSolids(s, level, prevBottom, prevTop);
  if (solid === "death") {
    die(s, out, "wall");
    return;
  }
  if (solid === "land" && !wasOnGround) out.push({ type: "land" });

  // Ground and ceiling are scalars, so these are single comparisons.
  const hh = playerHalfH(s);
  const ground = groundAt(level, s.x);
  if (s.y - hh <= ground) {
    s.y = ground + hh;
    if (s.vy < 0) s.vy = 0;
    s.onGround = true;
  }

  const ceiling = ceilingAt(level, s.x);
  if (Number.isFinite(ceiling) && s.y + hh >= ceiling) {
    if (s.mode === "ship") {
      s.y = ceiling - hh;
      if (s.vy > 0) s.vy = 0;
    } else {
      die(s, out, "void");
      return;
    }
  }

  // Triggers after movement, so a pad fires where the player actually ended up.
  const box = playerBox(s);
  const lo = Math.max(0, Math.floor(box.x / TILE) - 1);
  const hi = Math.min(level.columns.length - 1, Math.floor((box.x + box.w) / TILE) + 1);

  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;

    for (const trig of col.triggers) {
      const touching = overlaps(box, trig.box);
      if (!touching) {
        s.triggerTouch[trig.id] = 0;
        continue;
      }
      if (s.triggerTouch[trig.id]) continue; // already fired while inside it
      s.triggerTouch[trig.id] = 1;

      switch (trig.kind) {
        case "ship":
        case "cube": {
          if (s.mode === trig.kind) break;
          s.mode = trig.kind;
          // Velocity carries through a portal; only the box height changes.
          s.rot = 0;
          s.onGround = false;
          out.push({ type: "portal", mode: trig.kind });
          break;
        }
        case "pad": {
          s.vy = trig.vy * s.gravitySign;
          s.onGround = false;
          out.push({ type: "pad", vy: trig.vy });
          break;
        }
        case "ring": {
          // The one place an edge matters: one click, one ring. Holding through
          // two rings must only fire the first.
          if (!input.ringArmed) break;
          input.ringArmed = false;
          s.vy = trig.vy * s.gravitySign;
          s.onGround = false;
          out.push({ type: "ring", vy: trig.vy });
          break;
        }
      }
    }
  }

  if (hitsHazard(s, level)) {
    die(s, out, "hazard");
    return;
  }

  if (s.y + hh < ground - TILE * 4) {
    die(s, out, "void");
    return;
  }

  if (s.x > s.maxX) s.maxX = s.x;

  if (s.x >= level.lengthPx) {
    s.status = "complete";
    out.push({ type: "complete", timeSec: s.t });
    return;
  }

  applyRotation(s, level.speed, dt);
}

/** Visual height of the player in the current mode, for the renderer. */
export function playerSize(s: SimState): { w: number; h: number } {
  return s.mode === "ship" ? { w: CUBE_SIZE, h: SHIP_H } : { w: CUBE_SIZE, h: CUBE_SIZE };
}
