// The hitbox RULE, tested as a rule rather than as a set of remembered rects.
//
// If these pass, "every box in the game is HITBOX_UNIT x shape x scale" is
// true by construction, which is what makes a size portal a one-line feature.

import { test } from "node:test";
import assert from "node:assert/strict";

import { HITBOX_UNIT, ROLE_SCALE, centeredInCell, inCell, rotateShape, shape } from "./hitbox.ts";
import { SIZE_MINI, SPIKE_BOX, TILE } from "../constants.ts";
import { Player } from "../player.ts";

test("the canonical unit is one grid cell", () => {
  assert.equal(HITBOX_UNIT, TILE);
});

test("every player box is the body scaled by size and role", () => {
  const p = new Player();
  p.x = 100;
  p.y = 50;

  for (const scale of [1, SIZE_MINI, 0.25]) {
    p.sizeScale = scale;
    const body = p.box("body");
    for (const role of ["body", "solid", "lethal"] as const) {
      const box = p.box(role);
      const expected = ROLE_SCALE[role];
      assert.ok(
        Math.abs(box.w / body.w - expected) < 1e-9 && Math.abs(box.h / body.h - expected) < 1e-9,
        `${role} at size ${scale} should be ${expected}x the body`,
      );
      // Concentric with the body — a role must never shift the player.
      assert.ok(Math.abs(box.x + box.w / 2 - (body.x + body.w / 2)) < 1e-9);
      assert.ok(Math.abs(box.y + box.h / 2 - (body.y + body.h / 2)) < 1e-9);
    }
  }
});

test("a size change scales every box together, in lockstep", () => {
  // This is the property that makes mini portals free. If it ever fails, some
  // box has escaped the single rule and mini will be subtly wrong somewhere.
  const p = new Player();
  const full = (["body", "solid", "lethal"] as const).map((r) => p.box(r));
  p.sizeScale = SIZE_MINI;
  const mini = (["body", "solid", "lethal"] as const).map((r) => p.box(r));

  for (let i = 0; i < full.length; i++) {
    assert.ok(Math.abs(mini[i].w / full[i].w - SIZE_MINI) < 1e-9);
    assert.ok(Math.abs(mini[i].h / full[i].h - SIZE_MINI) < 1e-9);
  }
});

test("the ship is a declared scale of the same unit, not a special case", () => {
  const p = new Player();
  const cube = p.box();
  p.mode = "ship";
  const ship = p.box();
  assert.equal(cube.w, TILE);
  assert.equal(cube.h, TILE);
  assert.equal(ship.w, TILE, "same width");
  assert.equal(ship.h, 20, "30x20, from body scale 2/3");
});

test("rotating a shape four times returns it exactly", () => {
  const s = centeredInCell(SPIKE_BOX.w / TILE, SPIKE_BOX.h / TILE, SPIKE_BOX.dy / TILE);
  let r = s;
  for (let i = 0; i < 4; i++) r = rotateShape(r, 90);
  for (const k of ["sx", "sy", "ox", "oy"] as const) {
    assert.ok(Math.abs(r[k] - s[k]) < 1e-9, `${k} drifted under four rotations`);
  }
});

test("rotation keeps a shape inside its cell", () => {
  const s = centeredInCell(1 / 3, 8 / 15, 1 / 15);
  for (const deg of [0, 90, 180, 270]) {
    const box = inCell(rotateShape(s, deg), 0, 0);
    assert.ok(box.x >= -1e-9 && box.y >= -1e-9, `${deg} deg escaped the cell origin`);
    assert.ok(box.x + box.w <= TILE + 1e-9, `${deg} deg overflowed the cell width`);
    assert.ok(box.y + box.h <= TILE + 1e-9, `${deg} deg overflowed the cell height`);
  }
});

test("rotation matches the hand-computed rects it replaced", () => {
  // The four orientations used to be four literal rects. Pinning them here
  // means the general rule is verified against the specific thing that worked.
  const s = centeredInCell(SPIKE_BOX.w / TILE, SPIKE_BOX.h / TILE, SPIKE_BOX.dy / TILE);
  const { dx, dy, w, h } = SPIKE_BOX;
  const expected = {
    0: { x: dx, y: dy, w, h },
    90: { x: dy, y: dx, w: h, h: w },
    180: { x: dx, y: TILE - dy - h, w, h },
    270: { x: TILE - dy - h, y: dx, w: h, h: w },
  };
  for (const [deg, want] of Object.entries(expected)) {
    const got = inCell(rotateShape(s, Number(deg)), 0, 0);
    for (const k of ["x", "y", "w", "h"] as const) {
      assert.ok(
        Math.abs(got[k] - want[k]) < 1e-9,
        `${deg} degrees: ${k} was ${got[k]}, expected ${want[k]}`,
      );
    }
  }
});

test("inCell does not silently centre a shape", () => {
  // Implicit centring is what put every rotated hazard in the wrong place.
  const box = inCell(shape(1 / 3, 1 / 3, 0, 0), 2, 3);
  assert.equal(box.x, 2 * TILE, "offset 0 means flush left, not centred");
  assert.equal(box.y, 3 * TILE);
});
