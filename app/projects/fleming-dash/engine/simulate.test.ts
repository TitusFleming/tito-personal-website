// Whole-simulation behaviour, and the regressions that keep it honest.
//
// Every test here steps through the invariant harness in test-support.ts, so
// each one also polices the entire state machine — grounded-ness, tunnelling,
// monotonic x, one-way status — not only the thing it was written to check.

import { test } from "node:test";
import assert from "node:assert/strict";

import { DEATH_FREEZE, FIXED_DT, LAND_TOLERANCE, SIZE_MINI, SPEEDS, TILE } from "./constants.ts";
import { hitsHazard } from "./collision.ts";
import { validateLevel } from "./level.ts";
import { Checkpoint, Simulation } from "./simulate.ts";
import { Player } from "./player.ts";
import { Palette } from "./palette.ts";
import { ModePortal } from "./objects/portals.ts";
import { World } from "./world.ts";
import { HELD, RELEASED, doc, run, runUntil, stepChecked, world } from "./test-support.ts";
import type { SimEvent } from "./types.ts";

// ── compilation ─────────────────────────────────────────────────────────────

test("a block span is registered in every column it covers", () => {
  const w = world([{ t: "block", x: 10, y: 0, w: 5 }]);
  for (let gx = 10; gx < 15; gx++) {
    assert.equal(w.columns[gx]?.solids.length, 1, `column ${gx} should hold the block`);
  }
  assert.equal(w.columns[9]?.solids.length, 0);
  assert.equal(w.columns[15]?.solids.length, 0);
});

test("a zone overrides ground and ceiling per column", () => {
  const w = world([{ t: "zone", x: 20, w: 10, groundY: -4, ceilingY: 12 }]);
  assert.equal(w.columns[25]?.groundY, -4 * TILE);
  assert.equal(w.columns[25]?.ceilingY, 12 * TILE);
  assert.equal(w.columns[19]?.groundY, 0, "outside the zone is untouched");
  assert.equal(w.columns[19]?.ceilingY, Infinity);
});

test("a level with no end marker is rejected rather than silently endless", () => {
  assert.throws(() => new World(doc({ objects: [] })), /no end marker/i);
});

test("the camera ceiling comes from the level's own geometry", () => {
  // It used to be a global constant tuned to one level's ship corridors.
  const flat = world([{ t: "block", x: 5, y: 0 }]);
  const tall = world([{ t: "block", x: 5, y: 0, h: 9 }]);
  assert.ok(tall.maxHeight > flat.maxHeight);
  assert.equal(tall.maxHeight, 9 * TILE);
});

test("validateLevel flags a ship ending with no ceiling", () => {
  const warnings = validateLevel(doc({ objects: [{ t: "ship", x: 10, y: 0 }, { t: "end", x: 100 }] }));
  assert.ok(warnings.some((w) => /ship mode with no ceiling/i.test(w.message)));
});

test("validateLevel flags modes that exist but are not tuned", () => {
  const warnings = validateLevel(doc({ objects: [{ t: "ball", x: 10, y: 0 }, { t: "end", x: 100 }] }));
  assert.ok(warnings.some((w) => /not yet tuned/i.test(w.message)));
});

// ── forgiveness ─────────────────────────────────────────────────────────────

test("brushing the outer edge of a spike survives", () => {
  const w = world([{ t: "spike", x: 10, y: 0, hw: 6, hh: 12 }]);
  const sim = new Simulation(w);
  sim.player.x = 10 * TILE - 10;
  sim.player.y = TILE / 2;
  assert.equal(hitsHazard(sim.player, w), false);
});

test("landing squarely on a spike kills", () => {
  const w = world([{ t: "spike", x: 10, y: 0 }]);
  const sim = new Simulation(w);
  sim.player.x = 10 * TILE + TILE / 2;
  sim.player.y = TILE / 2;
  assert.equal(hitsHazard(sim.player, w), true);
});

test("spike lethality has a stated threshold, not a remembered sample", () => {
  // A sweep rather than a point: when SPIKE_BOX or the player body changes,
  // this reports the NEW threshold instead of silently passing on one sample.
  const w = world([{ t: "spike", x: 10, y: 0, hw: 6, hh: 12 }]);
  const sim = new Simulation(w);
  sim.player.y = TILE / 2;
  const spikeCentre = 10 * TILE + TILE / 2;

  let firstLethal = Number.NaN;
  for (let d = 30; d >= 0; d--) {
    sim.player.x = spikeCentre - d;
    if (hitsHazard(sim.player, w)) {
      firstLethal = d;
      break;
    }
  }
  assert.ok(
    firstLethal >= 16 && firstLethal <= 20,
    `spike becomes lethal at ${firstLethal}px of approach; expected 16-20. ` +
      `If this moved deliberately, update the range — but know that it changes how fair the game feels.`,
  );
});

// ── whole-sim behaviour ─────────────────────────────────────────────────────

test("the cube rests on the ground and does not sink", () => {
  const sim = new Simulation(world([]));
  run(sim, 240);
  assert.equal(sim.status, "running");
  assert.equal(sim.player.y, TILE / 2, "should sit exactly one half-height above ground");
  assert.equal(sim.player.onGround, true);
});

test("the cube lands on top of a block instead of falling through it", () => {
  const sim = new Simulation(world([{ t: "block", x: 10, y: 0, w: 20 }]));
  sim.player.x = 12 * TILE;
  sim.player.y = 8 * TILE;
  sim.player.onGround = false;

  const events = run(sim, 150);
  assert.equal(sim.status, "running", "landing on a block must not be fatal");
  assert.ok(events.some((e) => e.type === "land"), "should report a landing");
  assert.equal(sim.player.y, TILE + TILE / 2, "should rest on the block's top");
  assert.equal(sim.player.onGround, true);
});

test("a block at ground level is a wall that must be jumped", () => {
  const sim = new Simulation(world([{ t: "block", x: 6, y: 0 }]));
  run(sim, 480);
  assert.equal(sim.status, "dead");
});

test("running into a tall wall is fatal", () => {
  const sim = new Simulation(world([{ t: "block", x: 6, y: 0, h: 6 }]));
  const events = run(sim, 480);
  assert.equal(sim.status, "dead");
  const death = events.find((e) => e.type === "death");
  assert.equal(death && death.type === "death" ? death.cause : null, "wall");
});

test("a ship portal switches mode and carries velocity through", () => {
  // y is the portal's cell BOTTOM: every GD portal is three tiles tall and the
  // level file anchors it there, so y=0 is a floor-level portal.
  const sim = new Simulation(world([{ t: "ship", x: 5, y: 0 }], { ceilingY: 14 }));
  const events = run(sim, 240);
  assert.equal(sim.player.mode, "ship");
  assert.ok(events.some((e) => e.type === "portal"));
});

test("a pad launches the cube without any input", () => {
  const sim = new Simulation(world([{ t: "pad", x: 5, y: 0 }]));
  const events: SimEvent[] = [];
  let peak = 0;
  for (let i = 0; i < 240 && sim.status === "running"; i++) {
    stepChecked(sim, RELEASED, events);
    peak = Math.max(peak, sim.player.y);
  }
  assert.ok(events.some((e) => e.type === "pad"), "the pad should have fired");
  assert.ok(peak > TILE * 2, `pad launched to ${(peak / TILE).toFixed(1)} tiles, expected > 2`);
});

test("a ring does nothing unless the player clicks", () => {
  const passive = new Simulation(world([{ t: "ring", x: 5, y: 0 }]));
  assert.equal(run(passive, 240, RELEASED).some((e) => e.type === "ring"), false);

  const active = new Simulation(world([{ t: "ring", x: 5, y: 0 }]));
  assert.ok(run(active, 240, HELD).some((e) => e.type === "ring"));
});

test("progress rises monotonically and reaching the end completes the level", () => {
  const sim = new Simulation(new World(doc({ objects: [{ t: "end", x: 40 }] })));
  let last = 0;
  const events: SimEvent[] = [];
  for (let i = 0; i < 5000 && sim.status === "running"; i++) {
    stepChecked(sim, RELEASED, events);
    const pct = sim.progressPercent();
    assert.ok(pct >= last, "progress must never go backwards");
    last = pct;
  }
  assert.equal(sim.status, "complete");
  assert.equal(sim.progressPercent(), 100);
  assert.ok(events.some((e) => e.type === "complete"));
});

test("a dead sim stops moving", () => {
  const sim = new Simulation(world([{ t: "block", x: 6, y: 0, h: 6 }]));
  run(sim, 480);
  assert.equal(sim.status, "dead");
  const frozenX = sim.player.x;
  run(sim, 120);
  assert.equal(sim.player.x, frozenX, "nothing should advance after death");
});

// ── portals through the whole simulation ────────────────────────────────────

test("a size portal makes the player mini mid-run without disturbing the ground", () => {
  const sim = new Simulation(world([{ t: "size", x: 5, y: 0, s: "mini" }]));
  const events = runUntil(sim, (s) => s.player.sizeScale === SIZE_MINI);
  assert.ok(events.some((e) => e.type === "size"));
  run(sim, 120);
  assert.equal(sim.player.onGround, true, "a mini cube still rests on the floor");
  assert.equal(sim.player.y, (TILE * SIZE_MINI) / 2, "seated at its own half-height");
});

test("a speed portal changes horizontal speed mid-level", () => {
  const sim = new Simulation(world([{ t: "speed", x: 5, y: 0, v: 3 }]));
  const before = sim.player.speed();
  runUntil(sim, (s) => s.player.speedIndex === 3);
  assert.equal(sim.player.speed(), SPEEDS[3]);
  assert.ok(sim.player.speed() > before);
});

test("a gravity portal inverts the fall and the player lands on the ceiling", () => {
  const sim = new Simulation(
    world([{ t: "grav", x: 5, y: 0, dir: "up" }, { t: "zone", x: 0, w: 60, ceilingY: 8 }]),
  );
  runUntil(sim, (s) => s.player.gravitySign === -1);
  run(sim, 400);
  assert.equal(sim.status, "running", "inverted gravity must not kill the player");
  assert.ok(sim.player.y > 4 * TILE, "should have fallen UP toward the ceiling");
});

// ── regressions ─────────────────────────────────────────────────────────────
// Each of these corresponds to a bug that 27 passing tests did not catch.

test("REGRESSION: walking off a ledge clears onGround", () => {
  // onGround was set true by landing and cleared only by jumping, so running
  // off a platform left it true for the whole fall.
  const sim = new Simulation(
    world([
      { t: "block", x: 2, y: 0, w: 5, h: 3 },
      { t: "zone", x: 0, w: 60, groundY: -20 },
    ]),
  );
  sim.player.x = 3 * TILE;
  sim.player.y = 3 * TILE + TILE / 2;
  sim.player.onGround = true;

  runUntil(sim, (s) => s.player.x > 7.5 * TILE);
  assert.equal(sim.player.onGround, false, "must be airborne after leaving the ledge");
  assert.ok(sim.player.vy < 0, "and falling");
});

test("REGRESSION: no free mid-air jump after walking off a ledge", () => {
  const sim = new Simulation(
    world([
      { t: "block", x: 2, y: 0, w: 5, h: 3 },
      { t: "zone", x: 0, w: 60, groundY: -20 },
    ]),
  );
  sim.player.x = 3 * TILE;
  sim.player.y = 3 * TILE + TILE / 2;
  sim.player.onGround = true;

  runUntil(sim, (s) => s.player.x > 7.5 * TILE);
  run(sim, 60); // fall a while longer
  const events = run(sim, 1, HELD);
  assert.equal(
    events.filter((e) => e.type === "jump").length,
    0,
    "pressing jump in mid-air must do nothing",
  );
});

test("REGRESSION: the cube spins while falling off a ledge", () => {
  // A consequence of the same flag: rotation snapped to a quarter turn every
  // step of the fall because the cube believed it was resting.
  const sim = new Simulation(
    world([
      { t: "block", x: 2, y: 0, w: 5, h: 3 },
      { t: "zone", x: 0, w: 60, groundY: -20 },
    ]),
  );
  sim.player.x = 3 * TILE;
  sim.player.y = 3 * TILE + TILE / 2;
  sim.player.onGround = true;
  sim.player.rot = 0;

  runUntil(sim, (s) => s.player.x > 7.5 * TILE);
  const before = sim.player.rot;
  run(sim, 60);
  assert.notEqual(sim.player.rot, before, "a falling cube must keep rotating");
});

test("REGRESSION: hitting a block's face never lifts the player onto its roof", () => {
  // The landing test used to borrow the solid box's 10.5px inset, so being up
  // to 16px inside a wall was silently promoted to a landing on the roof — a
  // free half-tile teleport upward out of a fatal position.
  //
  // A sweep, not a sample: it states where the threshold IS, so a change to
  // SOLID_HITBOX_SCALE reports the new number instead of quietly passing.
  const w = world([{ t: "block", x: 10, y: 0, w: 4, h: 4 }]);
  const blockTop = 4 * TILE;
  const outcomes: Record<number, string> = {};

  for (const depth of [1, 2, 3, 4, 6, 8, 12, 16, 20, 24]) {
    const sim = new Simulation(w);
    sim.player.x = 10 * TILE + 2;
    sim.player.y = blockTop - depth + TILE / 2;
    sim.player.vy = -300;
    sim.player.onGround = false;
    sim.step({ ...RELEASED }, FIXED_DT, []);

    const lifted = sim.status === "running" && sim.player.y - sim.player.halfH() >= blockTop - 1;
    outcomes[depth] = sim.status === "dead" ? "dead" : lifted ? "lifted" : "brushed past";
  }

  // The ONLY depth that may be lifted is within LAND_TOLERANCE, which is the
  // documented 2px of "your feet were basically on top of it" forgiveness.
  // Anything deeper used to be lifted too, up to 16px, because the landing test
  // borrowed the solid box's inset.
  for (const [depth, outcome] of Object.entries(outcomes)) {
    if (Number(depth) > LAND_TOLERANCE) {
      assert.notEqual(outcome, "lifted", `${depth}px into the face was lifted onto the roof`);
    }
  }

  // Shallow contact past the tolerance is a survivable corner brush, because
  // the small solid box has not reached the block yet. Deeper contact is a
  // wall, because it has. That is the whole rule — no special cases.
  assert.equal(outcomes[2], "lifted", `within tolerance: ${JSON.stringify(outcomes)}`);
  assert.equal(outcomes[4], "brushed past", `corner brush: ${JSON.stringify(outcomes)}`);
  assert.equal(outcomes[16], "dead", `wall: ${JSON.stringify(outcomes)}`);
  assert.equal(outcomes[24], "dead", `wall: ${JSON.stringify(outcomes)}`);
});

test("a genuine descent onto a block's top still lands", () => {
  // The other half of the previous test: tightening the wall rule must not
  // break ordinary landings, which is the trade the inset was paying for.
  const w = world([{ t: "block", x: 10, y: 0, w: 4, h: 4 }]);
  const sim = new Simulation(w);
  sim.player.x = 11 * TILE;
  sim.player.y = 4 * TILE + TILE / 2 + 12; // above the top, descending onto it
  sim.player.vy = -300;
  sim.player.onGround = false;
  run(sim, 30);
  assert.equal(sim.status, "running");
  assert.equal(sim.player.onGround, true);
  assert.equal(sim.player.y, 4 * TILE + TILE / 2, "seated exactly on the block top");
});

test("REGRESSION: the death freeze lasts exactly DEATH_FREEZE", () => {
  // The timer was drained inside the step AND again by the frame loop, so half
  // a second of freeze lasted about a quarter.
  const sim = new Simulation(world([{ t: "block", x: 6, y: 0, h: 6 }]));
  run(sim, 480);
  assert.equal(sim.status, "dead");
  assert.equal(sim.deathTimer, DEATH_FREEZE);

  const steps = Math.round(DEATH_FREEZE / FIXED_DT);
  for (let i = 0; i < steps - 1; i++) sim.step({ ...RELEASED }, FIXED_DT, []);
  assert.ok(sim.deathTimer > 0, "must still be frozen one step before the end");

  sim.step({ ...RELEASED }, FIXED_DT, []);
  assert.ok(sim.deathTimer < 1e-9, `expired at the end, was ${sim.deathTimer}`);
});

// ── checkpoints ─────────────────────────────────────────────────────────────

test("a checkpoint restores size and speed, not just position", () => {
  const sim = new Simulation(
    world([
      { t: "size", x: 5, y: 0, s: "mini" },
      { t: "speed", x: 6, y: 0, v: 3 },
    ]),
  );
  runUntil(sim, (s) => s.player.speedIndex === 3);
  assert.equal(sim.player.sizeScale, SIZE_MINI);

  const cp = Checkpoint.capture(sim.player);
  sim.reset();
  assert.equal(sim.player.sizeScale, 1, "reset returns to normal size");

  sim.restore(cp);
  assert.equal(sim.player.sizeScale, SIZE_MINI, "a mini checkpoint must resume mini");
  assert.equal(sim.player.speedIndex, 3, "and at the speed it was set at");
});

// ── lethality ───────────────────────────────────────────────────────────────

test("bumping your head on a block is fatal", () => {
  // In the real game a block's underside kills, exactly like its side. This
  // used to be a survivable bonk that zeroed the climb and dropped you.
  const sim = new Simulation(world([{ t: "block", x: 8, y: 2, w: 6 }]));
  const events = run(sim, 480, HELD);
  assert.equal(sim.status, "dead", "jumping into an overhang must kill");
  const death = events.find((e) => e.type === "death");
  assert.equal(death && death.type === "death" ? death.cause : null, "wall");
});

test("clipping the corner of an overhang is still survivable", () => {
  // The other half: head-bump death is judged on the SOLID box, so the
  // forgiveness model is unchanged and a corner brush lives.
  const w = world([{ t: "block", x: 8, y: 2, w: 6 }]);
  const sim = new Simulation(w);
  sim.player.x = 8 * TILE - 12;      // barely under the block's left edge
  sim.player.y = 2 * TILE - TILE / 2 - 2;
  sim.player.vy = 100;
  sim.player.onGround = false;
  sim.step({ ...RELEASED }, FIXED_DT, []);
  assert.equal(sim.status, "running", "a corner brush must not kill");
});

test("a spike's kill box is far smaller than the spike it is drawn as", () => {
  // The object table's own figures, used literally: id 8 is 0.2 x 0.4, so a
  // 6x12 lethal rect inside a 30x30 triangle. The gap is deliberate and large —
  // clipping most of a spike's visual and surviving is how the real game reads.
  //
  // An earlier version treated hx/hy as half extents and doubled them, which
  // made spikes punishing. If these bounds ever widen, that has come back.
  const lv = world([{ t: "spike", x: 10, y: 0, hw: 6, hh: 12 }]);
  const spike = lv.columns[10]!.hazards[0]!;
  assert.equal(spike.box.w, TILE * 0.2, "kill box is a fifth of the cell wide");
  assert.equal(spike.box.h, TILE * 0.4, "and two fifths tall");
  assert.ok(spike.box.w < spike.cell.w * 0.25, "much narrower than the drawn triangle");
});

test("the spike default matches the object table, so authored spikes agree with imported ones", () => {
  const authored = world([{ t: "spike", x: 10, y: 0 }]).columns[10]!.hazards[0]!;
  const imported = world([{ t: "spike", x: 10, y: 0, hw: 6, hh: 12 }]).columns[10]!.hazards[0]!;
  assert.equal(authored.box.w, imported.box.w);
  assert.equal(authored.box.h, imported.box.h);
});

// ── colour triggers ─────────────────────────────────────────────────────────

test("a colour trigger changes the palette when crossed, at any height", () => {
  const sim = new Simulation(
    world([{ t: "color", x: 5, target: "bg", rgb: [255, 0, 40] }]),
  );
  assert.deepEqual(sim.palette.bg, [40, 62, 255], "starts on the level's header colour");
  runUntil(sim, (s) => s.player.x > 6 * TILE);
  assert.deepEqual(sim.palette.bg, [255, 0, 40], "crossing the trigger recolours the background");
});

test("a colour fade interpolates rather than snapping", () => {
  const sim = new Simulation(
    world([{ t: "color", x: 5, target: "ground", rgb: [255, 255, 255], fade: 1 }]),
  );
  runUntil(sim, (s) => s.player.x > 5.5 * TILE);
  const mid = [...sim.palette.ground];
  assert.notDeepEqual(mid, [255, 255, 255], "must not have snapped");
  run(sim, 240);
  assert.deepEqual(sim.palette.ground, [255, 255, 255], "and must arrive");
});

test("restarting restores the level's opening colours", () => {
  const sim = new Simulation(
    world([{ t: "color", x: 5, target: "bg", rgb: [255, 0, 40] }]),
  );
  runUntil(sim, (s) => s.player.x > 6 * TILE);
  sim.reset();
  assert.deepEqual(sim.palette.bg, [40, 62, 255], "a new attempt starts on the opening colours");
});

// ── coins ───────────────────────────────────────────────────────────────────

test("a coin is collected by touching it, once", () => {
  const sim = new Simulation(world([{ t: "coin", x: 6, y: 0 }]));
  const events = runUntil(sim, (s) => s.coins.size > 0);
  assert.deepEqual([...sim.coins], [0]);
  assert.equal(events.filter((e) => e.type === "coin").length, 1);

  // Still inside its volume on the following steps, and it must not re-fire.
  run(sim, 20);
  assert.equal(sim.coins.size, 1);
});

test("collecting a coin does not disturb the run", () => {
  // A coin must never alter a trajectory, or a route would play differently
  // depending on whether you had already taken one.
  const withCoin = new Simulation(world([{ t: "coin", x: 6, y: 0 }]));
  const without = new Simulation(world([]));
  for (let i = 0; i < 600; i++) {
    withCoin.step({ ...RELEASED }, FIXED_DT, []);
    without.step({ ...RELEASED }, FIXED_DT, []);
  }
  assert.equal(withCoin.player.x, without.player.x);
  assert.equal(withCoin.player.y, without.player.y);
  assert.equal(withCoin.player.vy, without.player.vy);
  assert.ok(withCoin.coins.size > 0, "and the coin was actually taken");
});

test("a restart drops the coins taken on the failed attempt", () => {
  const sim = new Simulation(world([{ t: "coin", x: 6, y: 0 }]));
  runUntil(sim, (s) => s.coins.size > 0);
  sim.reset();
  assert.equal(sim.coins.size, 0, "a coin only counts if you carry it home");
});

test("coins keep their real off-grid position", () => {
  // GD places the secret coins deliberately off the integer grid. Rounding x to
  // whole tiles put two of Stereo Madness's three up to 14px left of where the
  // level puts them — enough to change whether a route lines up.
  const w = world([{ t: "coin", x: 6.5, y: 2.25 }]);
  const coin = w.columns[6]!.triggers.find((t) => (t as { kind: string }).kind === "coin")!;
  assert.equal(coin.cell.x, 6.5 * TILE, "fractional x survives compilation");
  assert.equal(coin.cell.y, 2.25 * TILE, "and so does fractional y");
});

// ── portal-established sections ─────────────────────────────────────────────

test("a flying section is bounded by its portal, not by nearby geometry", () => {
  // Two levels, identical portals, wildly different scenery. The section must
  // come out the same: it is composed around the portal, and what happens to be
  // built beside it is scenery.
  const bare = new Simulation(world([{ t: "ship", x: 4, y: 0 }]));
  const cluttered = new Simulation(
    world([
      { t: "ship", x: 4, y: 0 },
      { t: "block", x: 10, y: 0, h: 14 },
      { t: "block", x: 14, y: 0, h: 9 },
    ]),
  );
  runUntil(bare, (s) => s.player.mode === "ship");
  runUntil(cluttered, (s) => s.player.mode === "ship");
  assert.deepEqual(bare.player.section, cluttered.player.section);
});

test("a ship section is never unbounded", () => {
  const sim = new Simulation(world([{ t: "ship", x: 4, y: 0 }]));
  runUntil(sim, (s) => s.player.mode === "ship");
  assert.notEqual(sim.player.section, null, "a flying mode must have a section");
  const { floor, ceiling } = sim.player.section!;
  assert.ok(Number.isFinite(floor) && Number.isFinite(ceiling));
  assert.equal((ceiling - floor) / TILE, 10, "ship declares a ten-tile section");
});

test("two portals at different heights give different sections", () => {
  // The rule tested directly: a portal's section comes from that portal's own
  // position. Driving a cube into a raised portal would just test gravity.
  const sectionFloorFor = (gy: number) => {
    const p = new Player();
    const portal = new ModePortal(4, gy, "ship");
    portal.onEnter({
      player: p,
      input: { held: false, ringArmed: false },
      events: [],
      palette: new Palette([0, 0, 0], [0, 0, 0]),
      coins: new Set<number>(),
    });
    return p.section!.floor;
  };
  assert.ok(sectionFloorFor(6) > sectionFloorFor(0), "a higher portal sits higher");
  assert.equal(
    sectionFloorFor(6) - sectionFloorFor(0),
    6 * TILE,
    "and moves with it one for one",
  );
});

test("a section narrows the level but never widens it", () => {
  // A section whose floor sits below the terrain would let a flying player sink
  // straight through the ground.
  const sim = new Simulation(world([{ t: "ship", x: 4, y: 0 }]));
  runUntil(sim, (s) => s.player.mode === "ship");
  assert.ok(sim.player.section!.floor < 0, "this portal's raw section is below ground");
  run(sim, 600);
  assert.ok(
    sim.player.y - sim.player.halfH() >= -0.5,
    `player sank to ${(sim.player.y - sim.player.halfH()).toFixed(2)} below the ground`,
  );
});

test("returning to the cube clears the section", () => {
  const sim = new Simulation(
    world([{ t: "ship", x: 4, y: 0 }, { t: "cube", x: 20, y: 0 }]),
  );
  runUntil(sim, (s) => s.player.mode === "ship");
  assert.notEqual(sim.player.section, null);
  runUntil(sim, (s) => s.player.mode === "cube");
  assert.equal(sim.player.section, null, "on foot, the level's own ground applies");
});
