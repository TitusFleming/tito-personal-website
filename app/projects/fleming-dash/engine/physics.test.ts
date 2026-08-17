// The point of these tests is to pin the jump arc.
//
// Apex, airtime and horizontal reach all fall out of the same three constants,
// so if someone changes CUBE_JUMP_VY without changing CUBE_GRAVITY, all three
// assertions move at once and say so. That is the whole reason to test numbers
// that "obviously" work.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CUBE_JUMP_VY,
  CUBE_TERMINAL_VY,
  FIXED_DT,
  SHIP_MAX_VY,
  SPEED_1X,
  TILE,
} from "./constants.ts";
import { applyVertical, integrate } from "./physics.ts";
import type { InputState, SimEvent, SimState } from "./types.ts";

function makeState(over: Partial<SimState> = {}): SimState {
  return {
    status: "running",
    t: 0,
    mode: "cube",
    x: 0,
    y: 0,
    vy: 0,
    onGround: true,
    rot: 0,
    gravitySign: 1,
    attempt: 1,
    maxX: 0,
    triggerTouch: new Uint8Array(0),
    deathTimer: 0,
    ...over,
  };
}

const HELD: InputState = { held: true, ringArmed: true };
const RELEASED: InputState = { held: false, ringArmed: false };

/** Run a free jump from flat ground until the cube comes back down to y = 0. */
function simulateJump() {
  const s = makeState();
  const out: SimEvent[] = [];
  let apex = 0;
  let steps = 0;

  // First step triggers the jump, then we release so it is a single jump.
  applyVertical(s, HELD, FIXED_DT, out);
  integrate(s, SPEED_1X, FIXED_DT);
  steps++;

  while (s.y > 0 && steps < 10_000) {
    applyVertical(s, RELEASED, FIXED_DT, out);
    integrate(s, SPEED_1X, FIXED_DT);
    apex = Math.max(apex, s.y);
    steps++;
  }

  return { apex, airtime: steps * FIXED_DT, distance: s.x, events: out };
}

test("a cube jump clears exactly two tiles", () => {
  const { apex } = simulateJump();

  // The analytical apex is vy^2 / 2g = 509^2 / 4320 = 59.97 px, but a discrete
  // integrator lands slightly above it: the step that sets the jump velocity
  // moves a full vy*dt with no gravity applied yet, so the arc starts about
  // vy*dt/2 = 509/480 = 1.06 px high. That is inherent to semi-implicit Euler,
  // not a wrong constant, so the tolerance is derived from it rather than
  // guessed — if it ever exceeds this, the constants really did change.
  const overshoot = (CUBE_JUMP_VY * FIXED_DT) / 2;
  assert.ok(
    Math.abs(apex - 2 * TILE) < overshoot + 0.5,
    `apex was ${apex.toFixed(2)} px, expected ${2 * TILE} px + ~${overshoot.toFixed(2)} px integration overshoot`,
  );
});

test("a cube jump lasts about 0.4713 s", () => {
  const { airtime } = simulateJump();
  // Tolerance is a couple of steps: the loop lands on whichever step first
  // crosses y = 0, which quantises the result to FIXED_DT.
  assert.ok(
    Math.abs(airtime - 0.4713) < FIXED_DT * 3,
    `airtime was ${airtime.toFixed(4)} s, expected ~0.4713 s`,
  );
});

test("a cube jump travels just under five tiles", () => {
  const { distance } = simulateJump();
  const tiles = distance / TILE;
  assert.ok(
    tiles > 4.7 && tiles < 5.1,
    `jump covered ${tiles.toFixed(2)} tiles, expected ~4.90`,
  );
});

test("holding the button emits exactly one jump from the ground", () => {
  const s = makeState();
  const out: SimEvent[] = [];
  applyVertical(s, HELD, FIXED_DT, out);
  applyVertical(s, HELD, FIXED_DT, out); // still held, but airborne now
  assert.equal(out.filter((e) => e.type === "jump").length, 1);
  assert.equal(s.onGround, false);
});

test("a held button re-jumps the instant the cube lands", () => {
  // This is the auto-rejump rule, and it is why the loop needs no edge detection.
  const s = makeState({ onGround: false, vy: -100 });
  const out: SimEvent[] = [];

  applyVertical(s, HELD, FIXED_DT, out);
  assert.equal(out.length, 0, "must not jump while airborne");

  s.onGround = true;
  applyVertical(s, HELD, FIXED_DT, out);
  assert.deepEqual(out, [{ type: "jump" }]);
});

test("falling speed is capped, and the cap keeps a step under one tile", () => {
  const s = makeState({ onGround: false });
  const out: SimEvent[] = [];
  for (let i = 0; i < 2000; i++) applyVertical(s, RELEASED, FIXED_DT, out);

  assert.equal(s.vy, CUBE_TERMINAL_VY);

  // The reason the cap matters: no discrete overlap test can tunnel a 30 px tile.
  const perStep = Math.abs(CUBE_TERMINAL_VY) * FIXED_DT;
  assert.ok(perStep < TILE, `${perStep.toFixed(2)} px/step must stay under ${TILE}`);
});

test("the ship climbs while held and falls when released", () => {
  const s = makeState({ mode: "ship", onGround: false });
  const out: SimEvent[] = [];

  for (let i = 0; i < 30; i++) applyVertical(s, HELD, FIXED_DT, out);
  assert.ok(s.vy > 0, "ship should be climbing while held");

  for (let i = 0; i < 120; i++) applyVertical(s, RELEASED, FIXED_DT, out);
  assert.ok(s.vy < 0, "ship should be falling once released");
});

test("ship vertical speed clamps symmetrically", () => {
  const out: SimEvent[] = [];

  const up = makeState({ mode: "ship", onGround: false });
  for (let i = 0; i < 2000; i++) applyVertical(up, HELD, FIXED_DT, out);
  assert.equal(up.vy, SHIP_MAX_VY);

  const down = makeState({ mode: "ship", onGround: false });
  for (let i = 0; i < 2000; i++) applyVertical(down, RELEASED, FIXED_DT, out);
  assert.equal(down.vy, -SHIP_MAX_VY);
});

test("the ship never jumps, however hard you hold", () => {
  const s = makeState({ mode: "ship", onGround: true });
  const out: SimEvent[] = [];
  for (let i = 0; i < 10; i++) applyVertical(s, HELD, FIXED_DT, out);
  assert.equal(out.filter((e) => e.type === "jump").length, 0);
});

test("the simulation is deterministic", () => {
  // If this ever fails, replay tapes are worthless and so is every tuning
  // decision made by feel.
  const run = () => {
    const s = makeState();
    const out: SimEvent[] = [];
    for (let i = 0; i < 500; i++) {
      applyVertical(s, i % 7 === 0 ? HELD : RELEASED, FIXED_DT, out);
      integrate(s, SPEED_1X, FIXED_DT);
    }
    return [s.x, s.y, s.vy];
  };
  assert.deepEqual(run(), run());
});
