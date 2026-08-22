// One block, one test file section. Each object is verified in isolation as a
// unit, then again through the simulation in simulate.test.ts.

import { test } from "node:test";
import assert from "node:assert/strict";

import { PAD_TABLE, RING_TABLE, SIZE_MINI, SPEEDS, TILE } from "../constants.ts";
import { Player } from "../player.ts";
import { Palette } from "../palette.ts";
import { Block } from "./block.ts";
import { Pad, Ring } from "./boosts.ts";
import { Pit } from "./decoration.ts";
import { GravityPortal, ModePortal, SizePortal, SpeedPortal } from "./portals.ts";
import { Spike } from "./spike.ts";
import { buildObject } from "./registry.ts";
import { DecorObject, HazardObject, SolidObject, TriggerObject, type TouchContext } from "./object.ts";
import type { SimEvent } from "../types.ts";

function ctx(p = new Player()): TouchContext & { player: Player } {
  return {
    player: p,
    input: { held: false, ringArmed: true },
    events: [] as SimEvent[],
    palette: new Palette([40, 62, 255], [0, 19, 200]),
    coins: new Set<number>(),
  };
}

// ── categories ──────────────────────────────────────────────────────────────

test("the registry files every object into the right category", () => {
  assert.ok(buildObject({ t: "block", x: 0, y: 0 }) instanceof SolidObject);
  assert.ok(buildObject({ t: "spike", x: 0, y: 0 }) instanceof HazardObject);
  assert.ok(buildObject({ t: "pit", x: 0, y: 0 }) instanceof DecorObject);
  for (const o of [
    { t: "pad", x: 0, y: 0 },
    { t: "ring", x: 0, y: 0 },
    { t: "ship", x: 0, y: 0 },
    { t: "grav", x: 0, y: 0, dir: "up" },
    { t: "size", x: 0, y: 0, s: "mini" },
    { t: "speed", x: 0, y: 0, v: 3 },
  ] as const) {
    assert.ok(buildObject(o) instanceof TriggerObject, `${o.t} should be a trigger`);
  }
});

test("structural tags build no object", () => {
  assert.equal(buildObject({ t: "end", x: 10 }), null);
  assert.equal(buildObject({ t: "zone", x: 0, w: 4, groundY: 2 }), null);
});

// ── blocks and spikes ───────────────────────────────────────────────────────

test("a block carries its span rather than being expanded per cell", () => {
  const b = new Block(10, 2, 5, 3);
  assert.deepEqual(
    { x: b.box.x, y: b.box.y, w: b.box.w, h: b.box.h },
    { x: 300, y: 60, w: 150, h: 90 },
  );
  assert.equal(b.cell, b.box, "a block's drawn cell IS its hitbox");
});

test("a spike's kill rect is far smaller than its drawn cell", () => {
  const s = new Spike(4, 0);
  assert.equal(s.cell.w, TILE);
  assert.equal(s.cell.h, TILE);
  assert.ok(s.box.w < TILE * 0.5, "kill rect must be much narrower than the cell");
  assert.ok(s.box.h < TILE * 0.7);
  // That gap IS the forgiveness. If it ever closes, the game stops feeling fair.
});

test("a spike honours the per-object hitbox from the game's table", () => {
  const s = new Spike(0, 0, 0, 6, 12);
  assert.equal(s.box.w, 6);
  assert.equal(s.box.h, 12);
});

// ── boosts ──────────────────────────────────────────────────────────────────

test("a pad launches with no input at all", () => {
  const c = ctx();
  c.input.ringArmed = false;
  new Pad(3, 0, "yellow").onEnter(c);
  assert.equal(c.player.vy, PAD_TABLE.yellow.vy);
  assert.equal(c.player.onGround, false);
});

test("a ring does nothing without a fresh press, and consumes the one it uses", () => {
  const idle = ctx();
  idle.input.ringArmed = false;
  new Ring(3, 0).onEnter(idle);
  assert.equal(idle.player.vy, 0);
  assert.equal(idle.events.length, 0);

  const pressed = ctx();
  new Ring(3, 0).onEnter(pressed);
  assert.equal(pressed.player.vy, RING_TABLE.yellow.vy);
  assert.equal(pressed.input.ringArmed, false, "the press must be consumed");
});

test("colours are table rows, not special cases", () => {
  for (const color of ["yellow", "pink", "red"] as const) {
    const c = ctx();
    c.input.ringArmed = false;
    new Pad(0, 0, color).onEnter(c);
    assert.equal(c.player.vy, PAD_TABLE[color].vy, color);
  }
  assert.ok(PAD_TABLE.pink.vy < PAD_TABLE.yellow.vy, "pink is the weak one");
  assert.ok(PAD_TABLE.red.vy > PAD_TABLE.yellow.vy, "red is the strong one");
});

test("a gravity-flipping boost launches along the NEW down", () => {
  const c = ctx();
  c.input.ringArmed = false;
  new Pad(0, 0, "blue").onEnter(c);
  assert.equal(c.player.gravitySign, -1);
  assert.ok(c.player.vy < 0, "impulse follows the flipped gravity");
  assert.ok(c.events.some((e) => e.type === "gravity"));
});

// ── portals ─────────────────────────────────────────────────────────────────

test("a portal is three tiles tall so it cannot be missed", () => {
  const portal = new ModePortal(5, 0, "ship");
  assert.equal(portal.box.h, TILE * 3);
  assert.equal(portal.box.w, TILE);
});

test("a mode portal is inert when you are already in that mode", () => {
  const c = ctx();
  new ModePortal(0, 0, "cube").onEnter(c);
  assert.equal(c.events.length, 0);
});

test("a size portal shrinks every box and reports it", () => {
  const c = ctx();
  new SizePortal(0, 0, "mini").onEnter(c);
  assert.equal(c.player.sizeScale, SIZE_MINI);
  assert.equal(c.player.box().w, TILE * SIZE_MINI);
  assert.ok(c.events.some((e) => e.type === "size"));
});

test("a size change keeps the player's FEET planted, not its centre", () => {
  // The player's position is its centre, so a naive shrink leaves a grounded
  // player hanging a quarter-box above the floor.
  const c = ctx();
  c.player.y = TILE / 2; // resting on ground at y = 0
  const feet = c.player.y - c.player.halfH();
  new SizePortal(0, 0, "mini").onEnter(c);
  assert.ok(
    Math.abs(c.player.y - c.player.halfH() - feet) < 1e-9,
    "feet moved when the body resized",
  );
});

test("a size change under inverted gravity pins the HEAD instead", () => {
  // Composition: size and gravity are separate blocks that must not fight.
  const c = ctx();
  c.player.gravitySign = -1;
  c.player.y = 100;
  const head = c.player.y + c.player.halfH();
  new SizePortal(0, 0, "mini").onEnter(c);
  assert.ok(Math.abs(c.player.y + c.player.halfH() - head) < 1e-9);
});

test("a mode portal also resizes without moving the feet", () => {
  const c = ctx();
  c.player.y = TILE / 2;
  const feet = c.player.y - c.player.halfH();
  new ModePortal(0, 0, "ship").onEnter(c);
  assert.equal(c.player.mode, "ship");
  assert.ok(Math.abs(c.player.y - c.player.halfH() - feet) < 1e-9);
});

test("a gravity portal is idempotent and reports only real changes", () => {
  const c = ctx();
  new GravityPortal(0, 0, "down").onEnter(c);
  assert.equal(c.events.length, 0, "already pointing down");
  new GravityPortal(0, 0, "up").onEnter(c);
  assert.equal(c.player.gravitySign, -1);
  assert.equal(c.events.length, 1);
});

test("a speed portal selects a table entry", () => {
  const c = ctx();
  new SpeedPortal(0, 0, 3).onEnter(c);
  assert.equal(c.player.speedIndex, 3);
  assert.equal(c.player.speed(), SPEEDS[3]);
});

test("portals compose without knowing about each other", () => {
  const c = ctx();
  new ModePortal(0, 0, "ship").onEnter(c);
  new SizePortal(0, 0, "mini").onEnter(c);
  new SpeedPortal(0, 1, 2).onEnter(c);
  new GravityPortal(0, 0, "up").onEnter(c);

  assert.equal(c.player.mode, "ship");
  assert.equal(c.player.sizeScale, SIZE_MINI);
  assert.equal(c.player.speed(), SPEEDS[2]);
  assert.equal(c.player.gravitySign, -1);
  // A mini ship: 30x20 body at half scale.
  assert.equal(c.player.box().w, TILE * SIZE_MINI);
  assert.equal(c.player.box().h, 20 * SIZE_MINI);
});

// ── decoration ──────────────────────────────────────────────────────────────

test("a pit is drawn and never simulated", () => {
  const pit = new Pit(3, 0);
  assert.ok(pit instanceof DecorObject);
  assert.ok(!("box" in pit), "decoration must not expose a hitbox");
});
