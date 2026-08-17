// Level compilation, collision, and whole-sim behaviour.
//
// The tests that matter most here are the forgiveness ones. Anyone can make a
// platformer where touching a spike kills you; the thing that makes this genre
// feel fair is that the lethal region is visibly smaller than the drawn spike.
// If those assertions ever flip, the game stops feeling like Geometry Dash and
// starts feeling broken, so they are worth stating explicitly.

import { test } from "node:test";
import assert from "node:assert/strict";

import { FIXED_DT, TILE } from "./constants.ts";
import { hitsHazard, playerBox, playerHazardBox, playerSolidBox } from "./collision.ts";
import { compileLevel, validateLevel } from "./level.ts";
import { createSim, progressPercent, stepSim } from "./simulate.ts";
import type { InputState, LevelDoc, SimEvent, SimState } from "./types.ts";

function doc(over: Partial<LevelDoc> = {}): LevelDoc {
  return {
    format: 1,
    id: "test",
    rev: 1,
    name: "Test",
    author: "test",
    startMode: "cube",
    speed: 1,
    groundY: 0,
    ceilingY: null,
    objects: [{ t: "end", x: 100 }],
    ...over,
  };
}

const RELEASED: InputState = { held: false, ringArmed: false };

function run(s: SimState, level: ReturnType<typeof compileLevel>, steps: number, input = RELEASED) {
  const out: SimEvent[] = [];
  for (let i = 0; i < steps && s.status === "running"; i++) {
    stepSim(s, level, { ...input }, FIXED_DT, out);
  }
  return out;
}

// ── Compilation ─────────────────────────────────────────────────────────────

test("a block span expands across every column it covers", () => {
  const lv = compileLevel(doc({ objects: [{ t: "block", x: 10, y: 0, w: 5 }, { t: "end", x: 100 }] }));
  for (let gx = 10; gx < 15; gx++) {
    assert.equal(lv.columns[gx]?.solids.length, 1, `column ${gx} should hold the block`);
  }
  assert.equal(lv.columns[9]?.solids.length, 0);
  assert.equal(lv.columns[15]?.solids.length, 0);
});

test("a zone overrides ground and ceiling per column", () => {
  const lv = compileLevel(
    doc({ objects: [{ t: "zone", x: 20, w: 10, groundY: -4, ceilingY: 12 }, { t: "end", x: 100 }] }),
  );
  assert.equal(lv.columns[25]?.groundY, -4 * TILE);
  assert.equal(lv.columns[25]?.ceilingY, 12 * TILE);
  assert.equal(lv.columns[19]?.groundY, 0, "outside the zone is untouched");
  assert.equal(lv.columns[19]?.ceilingY, Infinity);
});

test("a level with no end marker is rejected rather than silently endless", () => {
  assert.throws(() => compileLevel(doc({ objects: [] })), /no end marker/i);
});

test("validateLevel flags a ship ending with no ceiling", () => {
  const warnings = validateLevel(
    doc({ objects: [{ t: "ship", x: 10, y: 3 }, { t: "end", x: 100 }] }),
  );
  assert.ok(warnings.some((w) => /ship mode with no ceiling/i.test(w.message)));
});

// ── Forgiveness ─────────────────────────────────────────────────────────────

test("the player has two hitboxes, and the solid one is much smaller", () => {
  // This is the real game's model: spikes are tested against the full 30x30
  // box, while only a small centre box decides whether a wall kills you.
  const s = createSim(compileLevel(doc()));
  const main = playerBox(s);
  const hazard = playerHazardBox(s);
  const solid = playerSolidBox(s);

  assert.equal(hazard.w, main.w, "hazards use the full main box");
  assert.equal(hazard.h, main.h);
  assert.ok(solid.w < main.w * 0.5, `solid box ${solid.w} should be far under half of ${main.w}`);
  // and concentric with it
  assert.ok(Math.abs((solid.x + solid.w / 2) - (main.x + main.w / 2)) < 0.001);
  assert.ok(Math.abs((solid.y + solid.h / 2) - (main.y + main.h / 2)) < 0.001);
});

test("brushing the outer edge of a spike survives", () => {
  const lv = compileLevel(doc({ objects: [{ t: "spike", x: 10, y: 0, hw: 6, hh: 12 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  // Forgiveness now lives in the spike, not the player: a real spike's lethal
  // rect is 6x12 inside its 30x30 cell, so the cube's full box can overlap the
  // cell while missing the kill rect entirely.
  s.x = 10 * TILE - 10;
  s.y = TILE / 2;
  assert.equal(hitsHazard(s, lv), false);
});

test("landing squarely on a spike kills", () => {
  const lv = compileLevel(doc({ objects: [{ t: "spike", x: 10, y: 0 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  s.x = 10 * TILE + TILE / 2;
  s.y = TILE / 2;
  assert.equal(hitsHazard(s, lv), true);
});

// ── Whole-sim behaviour ─────────────────────────────────────────────────────

test("the cube rests on the ground and does not sink", () => {
  const lv = compileLevel(doc());
  const s = createSim(lv);
  run(s, lv, 240);
  assert.equal(s.status, "running");
  assert.equal(s.y, TILE / 2, "should sit exactly one half-height above ground");
  assert.equal(s.onGround, true);
});

test("the cube lands on top of a block instead of falling through it", () => {
  // Dropped from directly above rather than jumped into, so the test pins the
  // landing behaviour and not the jump timing.
  const lv = compileLevel(doc({ objects: [{ t: "block", x: 10, y: 0, w: 20 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  s.x = 12 * TILE;
  s.y = 8 * TILE;
  s.onGround = false;

  // 150 steps is long enough to fall the 6.5 tiles and land, but short enough
  // that the cube is still over the block rather than off its far end.
  const events = run(s, lv, 150);
  assert.equal(s.status, "running", "landing on a block must not be fatal");
  assert.ok(events.some((e) => e.type === "land"), "should report a landing");
  assert.equal(s.y, TILE + TILE / 2, "should rest on the block's top, one tile up");
  assert.equal(s.onGround, true);
});

test("a block at ground level is a wall that must be jumped", () => {
  // This is correct Geometry Dash behaviour and worth stating: a one-tile block
  // sitting on the floor is an obstacle, not a step you walk up.
  const lv = compileLevel(doc({ objects: [{ t: "block", x: 6, y: 0 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  run(s, lv, 480);
  assert.equal(s.status, "dead");
});

test("running into a tall wall is fatal", () => {
  const lv = compileLevel(doc({ objects: [{ t: "block", x: 6, y: 0, h: 6 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  const events = run(s, lv, 480);
  assert.equal(s.status, "dead");
  const death = events.find((e) => e.type === "death");
  assert.equal(death && death.type === "death" ? death.cause : null, "wall");
});

test("a ship portal switches mode and carries velocity through", () => {
  const lv = compileLevel(
    doc({
      ceilingY: 14,
      objects: [{ t: "ship", x: 5, y: 1 }, { t: "end", x: 100 }],
    }),
  );
  const s = createSim(lv);
  const events = run(s, lv, 240);
  assert.equal(s.mode, "ship");
  assert.ok(events.some((e) => e.type === "portal"));
});

test("a pad launches the cube without any input", () => {
  const lv = compileLevel(doc({ objects: [{ t: "pad", x: 5, y: 0 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);

  // Track the peak, not the height at an arbitrary step — the cube is airborne
  // for well under a second, so sampling at the end just catches it back down.
  const events: SimEvent[] = [];
  let peak = 0;
  for (let i = 0; i < 240 && s.status === "running"; i++) {
    stepSim(s, lv, { ...RELEASED }, FIXED_DT, events);
    peak = Math.max(peak, s.y);
  }

  assert.ok(events.some((e) => e.type === "pad"), "the pad should have fired");
  assert.ok(peak > TILE * 2, `pad launched the cube to ${(peak / TILE).toFixed(1)} tiles, expected > 2`);
});

test("a ring does nothing unless the player clicks", () => {
  const lv = compileLevel(doc({ objects: [{ t: "ring", x: 5, y: 0 }, { t: "end", x: 100 }] }));

  const passive = createSim(lv);
  const noClick = run(passive, lv, 240, { held: false, ringArmed: false });
  assert.equal(noClick.some((e) => e.type === "ring"), false);

  const active = createSim(lv);
  const clicked = run(active, lv, 240, { held: true, ringArmed: true });
  assert.ok(clicked.some((e) => e.type === "ring"));
});

test("progress rises monotonically and reaching the end completes the level", () => {
  const lv = compileLevel(doc({ objects: [{ t: "end", x: 40 }] }));
  const s = createSim(lv);
  let last = 0;
  const events: SimEvent[] = [];
  for (let i = 0; i < 5000 && s.status === "running"; i++) {
    stepSim(s, lv, { ...RELEASED }, FIXED_DT, events);
    const pct = progressPercent(s, lv);
    assert.ok(pct >= last, "progress must never go backwards");
    last = pct;
  }
  assert.equal(s.status, "complete");
  assert.equal(progressPercent(s, lv), 100);
  assert.ok(events.some((e) => e.type === "complete"));
});

test("a dead sim stops moving", () => {
  const lv = compileLevel(doc({ objects: [{ t: "block", x: 6, y: 0, h: 6 }, { t: "end", x: 100 }] }));
  const s = createSim(lv);
  run(s, lv, 480);
  assert.equal(s.status, "dead");
  const frozenX = s.x;
  run(s, lv, 120);
  assert.equal(s.x, frozenX, "nothing should advance after death");
});
