// Vertical motion, per gamemode. Pure: mutates only the state passed in.
//
// Horizontal motion is not here because there isn't any decision to make about
// it — x advances at a constant rate forever, and hitting a wall is handled by
// collision as a death rather than as a velocity change.

import {
  CUBE_GRAVITY,
  CUBE_JUMP_VY,
  CUBE_SIZE,
  CUBE_SPIN_RATE,
  CUBE_TERMINAL_VY,
  SHIP_GRAVITY,
  SHIP_H,
  SHIP_MAX_VY,
  SHIP_ROT_K,
  SHIP_ROT_MAX,
  SHIP_THRUST,
  clamp,
  expSmooth,
} from "./constants.ts";
import type { InputState, SimEvent, SimState } from "./types.ts";

/** Player box height for the current mode. Derived every step so a portal can't leave a stale size behind. */
export function playerHalfH(s: SimState): number {
  return (s.mode === "ship" ? SHIP_H : CUBE_SIZE) / 2;
}

/** Both modes are 30 wide; only the height changes. Kept as a function so a future mode can vary it. */
export function playerHalfW(): number {
  return CUBE_SIZE / 2;
}

/**
 * Acceleration and the velocity clamp, for one step.
 *
 * The cube's jump condition is `held`, not a press edge — that is not a
 * simplification, it is the actual rule. Holding the button makes the cube
 * re-jump the instant it lands, which is how the real game plays, and it means
 * the core loop needs no edge detection at all. (Rings are the one exception;
 * they use InputState.ringArmed.)
 */
export function applyVertical(
  s: SimState,
  input: InputState,
  dt: number,
  out: SimEvent[],
): void {
  const g = s.gravitySign;

  if (s.mode === "cube") {
    if (input.held && s.onGround) {
      s.vy = CUBE_JUMP_VY * g;
      s.onGround = false;
      out.push({ type: "jump" });
    } else {
      s.vy += CUBE_GRAVITY * g * dt;
    }
    // Cap falling speed only, in whichever direction "falling" currently means.
    s.vy = g === 1 ? Math.max(s.vy, CUBE_TERMINAL_VY) : Math.min(s.vy, -CUBE_TERMINAL_VY);
  } else {
    s.vy += (input.held ? SHIP_THRUST : SHIP_GRAVITY) * g * dt;
    s.vy = clamp(s.vy, -SHIP_MAX_VY, SHIP_MAX_VY);
  }
}

/**
 * Semi-implicit Euler: velocity is already updated by applyVertical, then
 * position uses the new velocity. It is the stable choice here, and it is why
 * applyVertical must run first.
 */
export function integrate(s: SimState, speed: number, dt: number): void {
  s.y += s.vy * dt;
  s.x += speed * dt;
  s.t += dt;
}

/**
 * Rotation is cosmetic but lives in the sim because it is gameplay-visible in
 * ship mode — you read the nose angle to judge your climb.
 */
export function applyRotation(s: SimState, speed: number, dt: number): void {
  if (s.mode === "ship") {
    const target = clamp(Math.atan2(s.vy, speed), -SHIP_ROT_MAX, SHIP_ROT_MAX);
    s.rot = expSmooth(s.rot, target, SHIP_ROT_K, dt);
    return;
  }

  if (s.onGround) {
    // Snap to the nearest quarter turn on landing rather than easing, so the
    // cube reads as settled. A full uninterrupted jump accumulates exactly PI,
    // which is why a hop between two surfaces at the same height lands the cube
    // 180 degrees flipped instead of at some arbitrary angle.
    const quarter = Math.PI / 2;
    s.rot = Math.round(s.rot / quarter) * quarter;
    // Keep it bounded. Rotation is never reset, so over a long session this
    // would otherwise grow without limit and start losing float precision.
    s.rot %= Math.PI * 2;
  } else {
    // Increasing rot is clockwise on screen: the renderer applies it directly
    // to a canvas whose y axis points down.
    s.rot += CUBE_SPIN_RATE * s.gravitySign * dt;
  }
}
