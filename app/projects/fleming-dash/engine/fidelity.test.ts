// The decompiled behaviours, tested as behaviours.
//
// physics.test.ts pins the cube's arc; this file pins the mechanics that were
// re-sourced from the decompilation for Clubstep: ball taps, UFO taps, mini
// scaling, the gravity-flip velocity rule, inverted landings, and circular
// saw hitboxes. Each test uses the pattern the mechanic is actually used
// with — a UFO tap arrives released and presses mid-air, a ball tap presses
// while rolling — because a held-from-frame-one test proves nothing (that
// mistake once hid every dead orb in the game).

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BALL_TAP_VY,
  CUBE_JUMP_VY,
  FIXED_DT,
  MINI_JUMP_SCALE,
  SIZE_MINI,
  TILE,
  UFO_TAP_VY,
  UFO_TAP_VY_MINI,
} from "./constants.ts";
import { hitsHazard } from "./collision.ts";
import { Simulation } from "./simulate.ts";
import { Player } from "./player.ts";
import { HELD, RELEASED, runUntil, stepChecked, world } from "./test-support.ts";
import type { SimEvent } from "./types.ts";

const press = () => ({ held: true, ringArmed: true });

function makePlayer(over: Partial<Player> = {}): Player {
  return Object.assign(new Player(), over);
}

// ── ball ────────────────────────────────────────────────────────────────────

test("a ball tap on the floor flips gravity and launches at 0.6x jump", () => {
  const p = makePlayer({ mode: "ball", onGround: true });
  const out: SimEvent[] = [];
  p.def.applyInput(p, press(), FIXED_DT, out);

  assert.equal(p.gravitySign, -1, "gravity must flip");
  // Launched toward the OLD up: the decompiled order is jump, then flip. One
  // step of the (now inverted) gravity follows inside the same call.
  assert.ok(
    Math.abs(p.vy - BALL_TAP_VY) < 20,
    `vy ${p.vy.toFixed(1)} should be ~${BALL_TAP_VY.toFixed(1)}`,
  );
  assert.deepEqual(out, [{ type: "gravity", sign: -1 }]);
});

test("a ball in the air cannot flip, however armed the press", () => {
  const p = makePlayer({ mode: "ball", onGround: false });
  const out: SimEvent[] = [];
  p.def.applyInput(p, press(), FIXED_DT, out);
  assert.equal(p.gravitySign, 1);
  assert.deepEqual(out, []);
});

// ── ufo ─────────────────────────────────────────────────────────────────────

test("a UFO tap SETS the hop velocity — it never adds", () => {
  const p = makePlayer({ mode: "ufo", onGround: false, vy: -300 });
  const out: SimEvent[] = [];
  p.def.applyInput(p, press(), FIXED_DT, out);
  // One step of gravity follows the tap inside the same applyInput call.
  assert.ok(Math.abs(p.vy - UFO_TAP_VY) < 10, `vy ${p.vy.toFixed(1)} should be ~${UFO_TAP_VY}`);
});

test("a UFO tap cannot brake a faster climb", () => {
  // The decompiled hop applies only when it would not slow the player.
  const p = makePlayer({ mode: "ufo", onGround: false, vy: UFO_TAP_VY + 50 });
  const out: SimEvent[] = [];
  p.def.applyInput(p, press(), FIXED_DT, out);
  assert.ok(p.vy > UFO_TAP_VY, `vy ${p.vy.toFixed(1)} must keep the climb`);
  assert.deepEqual(out, [], "no jump event when the hop is skipped");
});

test("the mini UFO hop uses the mini figure", () => {
  const p = makePlayer({ mode: "ufo", onGround: false, sizeScale: SIZE_MINI });
  const out: SimEvent[] = [];
  p.def.applyInput(p, press(), FIXED_DT, out);
  assert.ok(
    Math.abs(p.vy - UFO_TAP_VY_MINI) < 10,
    `vy ${p.vy.toFixed(1)} should be ~${UFO_TAP_VY_MINI}`,
  );
});

// ── mini ────────────────────────────────────────────────────────────────────

test("a mini cube jumps at 0.8x velocity but keeps full gravity", () => {
  const p = makePlayer({ sizeScale: SIZE_MINI, onGround: true });
  const out: SimEvent[] = [];
  p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  assert.equal(p.vy, CUBE_JUMP_VY * MINI_JUMP_SCALE);
});

// ── gravity portals ─────────────────────────────────────────────────────────

test("a gravity portal halves vertical velocity as it flips", () => {
  // Fly a ship upward into a flip portal placed where the climb tops out —
  // the ship rides its section ceiling around y=5.5 tiles, so the portal
  // spans tiles 4-7.
  const w = world([{ t: "ship", x: 2, y: 0 }, { t: "grav", x: 6, y: 4, dir: "up" }]);
  const sim = new Simulation(w);
  const out: SimEvent[] = [];
  let before = 0;
  while (sim.status === "running" && sim.player.x < 8 * TILE) {
    before = sim.player.vy;
    stepChecked(sim, HELD, out);
    if (out.some((e) => e.type === "gravity" && e.sign === -1)) {
      // One step of ship acceleration lands before the portal fires, so the
      // comparison is against before-with-one-step slack, not exact.
      assert.ok(
        Math.abs(sim.player.vy - before / 2) < 6,
        `vy ${before.toFixed(1)} should roughly halve, got ${sim.player.vy.toFixed(1)}`,
      );
      return;
    }
  }
  assert.fail("never crossed the gravity portal");
});

// ── inverted landings ───────────────────────────────────────────────────────

test("an inverted cube lands on a block's underside and can jump from it", () => {
  // A flip portal, then a long block overhead: the underside is the floor
  // now. Before collision was gravity-aware this player never grounded and
  // Clubstep's inverted section was an unplayable fall.
  const w = world([
    { t: "grav", x: 3, y: 0, dir: "up" },
    { t: "block", x: 4, y: 6, w: 20 },
  ]);
  const sim = new Simulation(w);
  runUntil(sim, (s) => s.player.gravitySign === -1, RELEASED);
  const out = runUntil(sim, (s) => s.player.onGround, RELEASED);
  assert.ok(out.some((e) => e.type === "land"), "must report the landing");
  const p = sim.player;
  assert.ok(
    Math.abs(p.y + p.halfH() - 6 * TILE) < 1,
    `feet should rest on the underside at ${6 * TILE}, centre is ${p.y.toFixed(1)}`,
  );

  // And a held jump fires downward-which-is-up.
  const jumpOut: SimEvent[] = [];
  stepChecked(sim, HELD, jumpOut);
  assert.ok(jumpOut.some((e) => e.type === "jump"), "inverted jump must fire");
  assert.ok(sim.player.vy < 0, "inverted jump accelerates toward the ground below");
});

// ── saws ────────────────────────────────────────────────────────────────────

test("a saw kills on its circle, not its bounding square", () => {
  const w = world([{ t: "saw", x: 10, y: 0, cr: 15 }]);
  const sim = new Simulation(w);
  const p = sim.player;

  // Corner of the bounding square: the rect test overlaps, the circle misses.
  // The saw's centre is at (315, 15); the player's lethal box is 30x30, so a
  // centre at (315-15-14, 15+15+14) puts the box corner 8.6px outside r=15.
  p.x = 315 - 29;
  p.y = 15 + 29;
  assert.equal(hitsHazard(p, w), false, "outside the circle must survive");

  p.x = 315;
  p.y = 15;
  assert.equal(hitsHazard(p, w), true, "the centre must kill");
});
