// The point of these tests is to pin the jump arc.
//
// Apex, airtime and horizontal reach all fall out of the same three constants,
// so if someone changes CUBE_JUMP_VY without changing CUBE_GRAVITY, all three
// assertions move at once and say so. That is the whole reason to test numbers
// that "obviously" work.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CUBE_AIRTIME,
  CUBE_GRAVITY,
  CUBE_JUMP_VY,
  CUBE_TERMINAL_VY,
  FIXED_DT,
  FLY_FALL_MAX,
  FLY_RISE_MAX,
  SPEEDS,
  TILE,
} from "./constants.ts";
import { MODES } from "./modes/mode.ts";
import { integrate } from "./physics.ts";
import { Player } from "./player.ts";
import { HELD, RELEASED } from "./test-support.ts";
import type { SimEvent, SpeedIndex } from "./types.ts";

function makePlayer(over: Partial<Player> = {}): Player {
  return Object.assign(new Player(), over);
}

/** Run a free jump from flat ground until the cube comes back down to y = 0. */
function simulateJump(speedIndex: SpeedIndex = 1) {
  const p = makePlayer({ speedIndex });
  const out: SimEvent[] = [];
  let apex = 0;
  let steps = 0;

  const stepOnce = (input: typeof HELD) => {
    p.def.applyInput(p, { ...input }, FIXED_DT, out);
    integrate(p, FIXED_DT);
    p.def.applyRotation(p, { ...input }, p.speed(), FIXED_DT);
    steps++;
  };

  stepOnce(HELD); // first step triggers the jump
  while (p.y > 0 && steps < 10_000) {
    stepOnce(RELEASED); // released, so it is a single jump
    apex = Math.max(apex, p.y);
  }

  return { apex, airtime: steps * FIXED_DT, distance: p.x, rotation: p.rot, events: out };
}

test("a cube jump peaks at the real game's 2.174 tiles", () => {
  const { apex } = simulateJump();
  // The real figure, derived from the decompiled constants (see constants.ts
  // header): vy^2 / 2g = 65.22 px = 2.174 tiles — the community-measured
  // "2.17 blocks". A discrete integrator lands slightly above the analytical
  // apex: the step that sets the jump velocity moves a full vy*dt with no
  // gravity applied yet, so the arc starts about vy*dt/2 high. That is
  // inherent to semi-implicit Euler, so the tolerance is derived from it.
  const analytic = (CUBE_JUMP_VY * CUBE_JUMP_VY) / (2 * -CUBE_GRAVITY);
  assert.ok(Math.abs(analytic - 2.174 * TILE) < 0.1, `analytic apex ${analytic.toFixed(2)}`);
  const overshoot = (CUBE_JUMP_VY * FIXED_DT) / 2;
  assert.ok(
    Math.abs(apex - analytic) < overshoot + 0.5,
    `apex was ${apex.toFixed(2)} px, expected ${analytic.toFixed(2)} px + ~${overshoot.toFixed(2)} px overshoot`,
  );
});

test("a cube jump lasts the real game's 0.432 s", () => {
  const { airtime } = simulateJump();
  assert.ok(Math.abs(CUBE_AIRTIME - 0.4321) < 0.001, `derived airtime ${CUBE_AIRTIME}`);
  assert.ok(
    Math.abs(airtime - CUBE_AIRTIME) < FIXED_DT * 3,
    `airtime was ${airtime.toFixed(4)} s, expected ~${CUBE_AIRTIME.toFixed(4)} s`,
  );
});

test("jump APEX is speed-independent but REACH scales with it", () => {
  // Speed is player state now, set by portals, so reach is no longer one
  // number. What must hold at every speed is that the apex does not move —
  // that is the property the level's two-tile steps depend on.
  const base = simulateJump(1);
  for (let i = 0; i < SPEEDS.length; i++) {
    const jump = simulateJump(i as SpeedIndex);
    assert.ok(
      Math.abs(jump.apex - base.apex) < 1e-6,
      `apex changed at speed index ${i}: ${jump.apex.toFixed(3)} vs ${base.apex.toFixed(3)}`,
    );
    const expected = base.distance * (SPEEDS[i] / SPEEDS[1]);
    assert.ok(
      Math.abs(jump.distance - expected) < 0.01,
      `reach at speed ${i} was ${jump.distance.toFixed(1)}, expected ${expected.toFixed(1)}`,
    );
  }
});

test("a cube jump travels about four and a half tiles at 1x", () => {
  // Reach is the tunable half of the jump; apex is not (see constants.ts).
  const tiles = simulateJump(1).distance / TILE;
  assert.ok(tiles > 4.3 && tiles < 4.7, `jump covered ${tiles.toFixed(2)} tiles, expected ~4.47`);
});

test("one full jump rotates the cube exactly half a turn", () => {
  const { rotation } = simulateJump();
  assert.ok(
    Math.abs(Math.abs(rotation) - Math.PI) < 0.08,
    `rotated ${rotation.toFixed(3)} rad, expected ~${Math.PI.toFixed(3)}`,
  );
});

test("holding the button emits exactly one jump from the ground", () => {
  const p = makePlayer();
  const out: SimEvent[] = [];
  p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  p.def.applyInput(p, { ...HELD }, FIXED_DT, out); // still held, but airborne now
  assert.equal(out.filter((e) => e.type === "jump").length, 1);
  assert.equal(p.onGround, false);
});

test("a held button re-jumps the instant the cube lands", () => {
  // This is the auto-rejump rule, and it is why the loop needs no edge detection.
  const p = makePlayer({ onGround: false, vy: -100 });
  const out: SimEvent[] = [];
  p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  assert.equal(out.length, 0, "must not jump while airborne");

  p.onGround = true;
  p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  assert.deepEqual(out, [{ type: "jump" }]);
});

test("falling speed is capped, and the cap keeps a step under one tile", () => {
  const p = makePlayer({ onGround: false });
  const out: SimEvent[] = [];
  for (let i = 0; i < 2000; i++) p.def.applyInput(p, { ...RELEASED }, FIXED_DT, out);
  assert.equal(p.vy, CUBE_TERMINAL_VY);

  // The reason the cap matters: no discrete overlap test can tunnel a 30px tile.
  const perStep = Math.abs(CUBE_TERMINAL_VY) * FIXED_DT;
  assert.ok(perStep < TILE, `${perStep.toFixed(2)} px/step must stay under ${TILE}`);
});

test("terminal velocity holds under inverted gravity too", () => {
  const p = makePlayer({ onGround: false, gravitySign: -1 });
  const out: SimEvent[] = [];
  for (let i = 0; i < 2000; i++) p.def.applyInput(p, { ...RELEASED }, FIXED_DT, out);
  assert.equal(p.vy, -CUBE_TERMINAL_VY, "cap must follow the flipped down");
});

test("the ship climbs while held and falls when released", () => {
  const p = makePlayer({ mode: "ship", onGround: false });
  const out: SimEvent[] = [];
  for (let i = 0; i < 30; i++) p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  assert.ok(p.vy > 0, "ship should be climbing while held");
  for (let i = 0; i < 120; i++) p.def.applyInput(p, { ...RELEASED }, FIXED_DT, out);
  assert.ok(p.vy < 0, "ship should be falling once released");
});

test("ship vertical speed clamps at the decompiled asymmetric limits", () => {
  // The real ship climbs faster than it dives: rise caps at 8 units/frame
  // (432 px/s), fall at 6.4 (345.6 px/s). See FLY_RISE_MAX / FLY_FALL_MAX.
  const out: SimEvent[] = [];
  const up = makePlayer({ mode: "ship", onGround: false });
  for (let i = 0; i < 2000; i++) up.def.applyInput(up, { ...HELD }, FIXED_DT, out);
  assert.equal(up.vy, FLY_RISE_MAX);

  const down = makePlayer({ mode: "ship", onGround: false });
  for (let i = 0; i < 2000; i++) down.def.applyInput(down, { ...RELEASED }, FIXED_DT, out);
  assert.equal(down.vy, -FLY_FALL_MAX);
});

test("the ship never jumps, however hard you hold", () => {
  const p = makePlayer({ mode: "ship", onGround: true });
  const out: SimEvent[] = [];
  for (let i = 0; i < 10; i++) p.def.applyInput(p, { ...HELD }, FIXED_DT, out);
  assert.equal(out.filter((e) => e.type === "jump").length, 0);
});

test("every mode in the table is complete and self-consistent", () => {
  // The seam test: a mode added to the union but half-wired should fail here
  // rather than halfway through a level.
  for (const [id, def] of Object.entries(MODES)) {
    assert.equal(def.id, id, `${id} has a mismatched id`);
    assert.ok(def.body.sx > 0 && def.body.sy > 0, `${id} has an empty body`);
    assert.ok(def.cameraK > 0, `${id} needs a camera rate`);

    const p = makePlayer({ mode: def.id, onGround: false });
    const out: SimEvent[] = [];
    for (let i = 0; i < 240; i++) {
      const input = { ...HELD, ringArmed: i % 20 === 0 };
      p.def.applyInput(p, input, FIXED_DT, out);
      integrate(p, FIXED_DT);
      p.def.applyRotation(p, input, p.speed(), FIXED_DT);
    }
    assert.ok(Number.isFinite(p.y), `${id} produced a non-finite position`);
    assert.ok(Number.isFinite(p.vy), `${id} produced a non-finite velocity`);
    assert.ok(Number.isFinite(p.rot), `${id} produced a non-finite rotation`);
  }
});

test("the simulation is deterministic", () => {
  // If this ever fails, replay tapes are worthless and so is every tuning
  // decision made by feel.
  const once = () => {
    const p = makePlayer();
    const out: SimEvent[] = [];
    for (let i = 0; i < 500; i++) {
      p.def.applyInput(p, i % 7 === 0 ? { ...HELD } : { ...RELEASED }, FIXED_DT, out);
      integrate(p, FIXED_DT);
    }
    return [p.x, p.y, p.vy];
  };
  assert.deepEqual(once(), once());
});
