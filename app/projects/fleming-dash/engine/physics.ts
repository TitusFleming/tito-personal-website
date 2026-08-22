// Integration.
//
// Vertical acceleration used to live here as an if-chain over gamemode; it now
// lives in the MODES table, one entry per mode. What is left is the part that
// is genuinely mode-independent: advancing position from velocity.
//
// Horizontal motion has no decisions in it — x advances at a constant rate
// forever, and hitting a wall is handled by collision as a death rather than as
// a velocity change.

import type { Player } from "./player.ts";

/**
 * Semi-implicit Euler: velocity is already updated by the mode's applyInput,
 * then position uses the NEW velocity. It is the stable choice here, and it is
 * why applyInput must run first.
 */
export function integrate(p: Player, dt: number): void {
  p.y += p.vy * dt;
  p.x += p.speed() * dt;
}
