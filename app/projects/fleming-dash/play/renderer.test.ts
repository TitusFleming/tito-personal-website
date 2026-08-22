import { test } from "node:test";
import assert from "node:assert/strict";

import { CAM_RISE_TILES, GROUND_BAND_TILES, TILE, VIEW_TILES } from "../engine/constants.ts";
import { Simulation } from "../engine/simulate.ts";
import { World } from "../engine/world.ts";
import { world as makeWorld } from "../engine/test-support.ts";
import { CanvasRecorder } from "./canvas-recorder.ts";
import { PALETTE } from "./sprites.ts";
import { createCamera, draw, interpolate, snapCamera } from "./renderer.ts";
import { Player } from "../engine/player.ts";
import { Palette } from "../engine/palette.ts";

const VIEW = { w: 960, h: 540 };
const INFO = {
  palette: new Palette([40, 62, 255], [0, 19, 200]),
  percent: 0,
  attempt: 1,
  practice: false,
  checkpoints: [],
  showHitboxes: false,
};

function render(w: World, place?: (s: Simulation) => void) {
  const sim = new Simulation(w);
  place?.(sim);
  const cam = createCamera(w);
  snapCamera(cam, sim.player, w, VIEW.w, VIEW.h);
  const rec = new CanvasRecorder();
  const view = interpolate({ x: sim.player.x, y: sim.player.y, rot: sim.player.rot }, sim.player, 1);
  draw(rec.asContext(), sim.player, view, w, cam, VIEW.w, VIEW.h, INFO);
  return { rec, sim, cam };
}

/** A triangle's apex is the vertex furthest from the midpoint of the other two. */
function apexPointsUp(tri: { x: number; y: number }[]): boolean {
  const ys = tri.map((p) => p.y).sort((a, b) => a - b);
  // Screen y grows downward: apex up means one vertex clearly above two others.
  return Math.abs(ys[0] - ys[1]) > Math.abs(ys[1] - ys[2]);
}

test("a ground spike is drawn pointing UP", () => {
  const w = makeWorld([{ t: "spike", x: 6, y: 0 }]);
  const { rec } = render(w, (s) => { s.player.x = 5 * TILE; });
  const tris = rec.triangles("#0A0A1E");
  assert.equal(tris.length, 1, "expected exactly one spike triangle");
  assert.ok(apexPointsUp(tris[0]), `ground spike apex should be above its base: ${JSON.stringify(tris[0])}`);
});

test("a ceiling spike is drawn pointing DOWN", () => {
  const w = makeWorld([{ t: "spike", x: 6, y: 9, r: 180 }, { t: "zone", x: 0, w: 60, ceilingY: 10 }]);
  const { rec } = render(w, (s) => { s.player.x = 5 * TILE; });
  const tris = rec.triangles("#0A0A1E");
  assert.equal(tris.length, 1);
  assert.ok(!apexPointsUp(tris[0]), `ceiling spike apex should be below its base: ${JSON.stringify(tris[0])}`);
});

test("a ground spike sits ON the ground line, not below it", () => {
  const w = makeWorld([{ t: "spike", x: 6, y: 0 }]);
  const { rec, cam } = render(w, (s) => { s.player.x = 5 * TILE; });
  const tri = rec.triangles("#0A0A1E")[0];
  const scale = VIEW.h / (VIEW_TILES * TILE);
  const vh = VIEW.h / scale;
  const groundScreenY = (vh / 2 - (0 - cam.y)) * scale;
  const baseY = Math.max(...tri.map((p) => p.y));
  assert.ok(
    Math.abs(baseY - groundScreenY) < 4 * scale,
    `spike base at ${baseY.toFixed(1)} should sit on the ground line at ${groundScreenY.toFixed(1)}`,
  );
});

// ── camera ──────────────────────────────────────────────────────────────────
// The rule these enforce, in one line: the camera's position is a function of
// the PLAYER and of the level's declared borders — never of the scenery.

import { updateCamera } from "./renderer.ts";
import stereoMadness from "../levels/stereo-madness.json" with { type: "json" };
import type { LevelDoc } from "../engine/types.ts";

const SCALE = VIEW.h / (VIEW_TILES * TILE);
const VH = VIEW.h / SCALE;

/** The world-space band the camera is currently showing. */
function windowOf(camY: number) {
  return { bottom: camY - VH / 2, top: camY + VH / 2 };
}

function camAt(w: World, x: number, y: number, mode: "cube" | "ship" = "cube") {
  const { cam } = render(w, (s) => { s.player.mode = mode; s.player.x = x; s.player.y = y; });
  return cam.y;
}

test("the camera ignores scenery: identical player, wildly different geometry", () => {
  // THE regression. A previous version clamped the view against a "skyline"
  // computed from nearby block heights, so walking past a tall structure moved
  // the camera even though the player had not moved. The camera must respond
  // to the icon and to declared borders, and to nothing else.
  const flat = makeWorld([{ t: "block", x: 12, y: 0 }]);
  const towers = makeWorld([
    { t: "block", x: 12, y: 0 },
    { t: "block", x: 13, y: 0, h: 12 },
    { t: "block", x: 16, y: 0, h: 9 },
    { t: "block", x: 20, y: 0, h: 14 },
  ]);
  for (const y of [TILE / 2, TILE * 2, TILE * 4]) {
    assert.equal(
      camAt(flat, 10 * TILE, y),
      camAt(towers, 10 * TILE, y),
      `player at y=${y}: scenery changed the camera`,
    );
  }
});

/** Settle the camera at a given player height, through the real update path. */
function settledCamY(w: World, x: number, y: number, mode: "cube" | "ship" = "cube"): number {
  const sim = new Simulation(w);
  sim.player.mode = mode;
  sim.player.x = x;
  sim.player.y = y;
  const cam = createCamera(w);
  snapCamera(cam, sim.player, w, VIEW.w, VIEW.h);
  for (let i = 0; i < 400; i++) {
    updateCamera(cam, sim.player, { x, y, rot: 0 }, w, VIEW.w, VIEW.h, 1 / 60);
  }
  return cam.y;
}

test("ordinary jumping does not move the camera at all", () => {
  // The spec: the view holds still until the player is genuinely ascending.
  // A cube jump is two tiles, so nothing up to CAM_RISE_TILES may shift it.
  const w = makeWorld([{ t: "block", x: 12, y: 0 }]);
  const rest = settledCamY(w, 10 * TILE, TILE / 2);
  for (const tiles of [0.5, 1, 2, 3, 4, CAM_RISE_TILES - 0.1]) {
    assert.equal(
      settledCamY(w, 10 * TILE, tiles * TILE),
      rest,
      `player ${tiles} tiles up moved the camera`,
    );
  }
});

test("the camera follows once the player climbs past the threshold", () => {
  const w = makeWorld([{ t: "block", x: 12, y: 0 }]);
  const rest = settledCamY(w, 10 * TILE, TILE / 2);
  const high = settledCamY(w, 10 * TILE, (CAM_RISE_TILES + 4) * TILE);
  assert.ok(high > rest + TILE, `climbing well past the threshold must raise the view`);
});

test("the camera target is continuous — no step at the threshold", () => {
  // This is the anti-jerk guarantee. The previous camera tracked the last
  // surface landed on, so its target teleported on every landing and the
  // easing was permanently chasing a step change.
  const w = makeWorld([{ t: "block", x: 12, y: 0 }]);
  let prev = settledCamY(w, 10 * TILE, 0);
  let worst = 0;
  for (let t = 0.1; t <= 10; t += 0.1) {
    const y = settledCamY(w, 10 * TILE, t * TILE);
    worst = Math.max(worst, Math.abs(y - prev));
    prev = y;
  }
  // A tenth of a tile of player movement must never move the view more than
  // that same tenth of a tile: the response is flat, then 1:1, never a jump.
  assert.ok(worst <= TILE * 0.1 + 0.01, `camera stepped ${worst.toFixed(2)}px for a 3px player move`);
});

test("inside a ship corridor the camera never shows above the ceiling", () => {
  const w = makeWorld([{ t: "zone", x: 0, w: 60, ceilingY: 10 }], { ceilingY: 10 });
  for (const y of [TILE, TILE * 4, TILE * 8, TILE * 9.5]) {
    const win = windowOf(camAt(w, 10 * TILE, y, "ship"));
    assert.ok(win.top <= 10 * TILE + 1, `player at y=${y}: view top ${win.top.toFixed(1)} above the ceiling`);
  }
});

test("inside a ship corridor the camera is static", () => {
  // GD's ship gamemode has top and bottom borders by default; a ten-tile
  // corridor inside an eleven-tile viewport has nowhere to scroll to.
  const w = makeWorld([{ t: "zone", x: 0, w: 60, ceilingY: 10 }], { ceilingY: 10 });
  const seen = new Set<number>();
  for (const y of [TILE, TILE * 3, TILE * 5, TILE * 7, TILE * 9]) {
    seen.add(Math.round(camAt(w, 10 * TILE, y, "ship") * 100));
  }
  assert.equal(seen.size, 1, `camera moved inside a corridor: ${[...seen]}`);
});

test("a corridor camera stays put across many update steps", () => {
  const w = makeWorld([{ t: "zone", x: 0, w: 60, ceilingY: 10 }], { ceilingY: 10 });
  const sim = new Simulation(w);
  sim.player.mode = "ship";
  sim.player.x = 10 * TILE;
  sim.player.y = TILE * 5;
  const cam = createCamera(w);
  snapCamera(cam, sim.player, w, VIEW.w, VIEW.h);
  const settled = cam.y;

  for (let i = 0; i < 200; i++) {
    sim.player.y = TILE * (2 + 7 * Math.abs(Math.sin(i / 9)));
    updateCamera(cam, sim.player, { x: sim.player.x, y: sim.player.y, rot: 0 }, w, VIEW.w, VIEW.h, 1 / 60);
  }
  assert.ok(Math.abs(cam.y - settled) < 0.5, `camera drifted ${(cam.y - settled).toFixed(2)}px`);
});

test("play borders come from the level's declarations, not its objects", () => {
  const open = makeWorld([{ t: "block", x: 10, y: 0, h: 12 }]);
  const roofed = makeWorld([{ t: "zone", x: 0, w: 60, ceilingY: 10 }], { ceilingY: 10 });
  assert.equal(open.playBounds(10 * TILE).ceiling, Infinity, "a block is scenery, not a border");
  assert.equal(roofed.playBounds(10 * TILE).ceiling, 10 * TILE, "a zone ceiling IS a border");
});

test("across the WHOLE real level the view never drops below the ground border", () => {
  // The general guarantee, asserted against what the level itself declares, so
  // it transfers unchanged to any new level.
  const w = new World(stereoMadness as LevelDoc);
  let checked = 0;
  for (let gx = 0; gx < w.columns.length; gx += 7) {
    const x = gx * TILE;
    const { floor, ceiling } = w.playBounds(x);
    const top = Number.isFinite(ceiling) ? ceiling : floor + 12 * TILE;
    for (const frac of [0, 0.3, 0.6, 1]) {
      const win = windowOf(camAt(w, x, floor + (top - floor) * frac, Number.isFinite(ceiling) ? "ship" : "cube"));
      assert.ok(win.bottom >= floor - GROUND_BAND_TILES * TILE - 0.5, `x=${x}: view bottom ${win.bottom.toFixed(1)} below ground ${floor}`);
      if (Number.isFinite(ceiling)) {
        assert.ok(win.top <= ceiling + 0.5, `x=${x}: view top ${win.top.toFixed(1)} above ceiling ${ceiling}`);
      }
      checked++;
    }
  }
  assert.ok(checked > 100, `only checked ${checked} positions`);
});

// ── sprite orientation ──────────────────────────────────────────────────────
// Rotation is stored in WORLD space (y-up, counter-clockwise positive) and
// converted to screen space in exactly one place. These pin that conversion, so
// a mode whose rotation disagrees with the convention fails here rather than
// shipping as a craft that points the wrong way.


/** The hull's forward-most vertex, in screen coords. */
function nose(rec: CanvasRecorder): { x: number; y: number } {
  const hull = rec.shapes.find(
    (s) => (s.kind === "path" || s.kind === "rect") && s.op === "fill" && s.style === PALETTE.shipHull,
  );
  assert.ok(hull && (hull.kind === "path" || hull.kind === "rect"), "no ship hull was drawn");
  const pts = (hull as { points: { x: number; y: number }[] }).points;
  return pts.reduce((a, b) => (b.x > a.x ? b : a));
}

function renderShip(vy: number) {
  const w = makeWorld([{ t: "zone", x: 0, w: 60, ceilingY: 10 }], { ceilingY: 10 });
  const sim = new Simulation(w);
  sim.player.mode = "ship";
  sim.player.x = 10 * TILE;
  sim.player.y = TILE * 5;
  sim.player.vy = vy;
  // Settle the rotation rather than sampling one step of easing.
  for (let i = 0; i < 200; i++) {
    sim.player.def.applyRotation(sim.player, { held: vy > 0, ringArmed: false }, sim.player.speed(), 1 / 240);
  }
  const cam = createCamera(w);
  snapCamera(cam, sim.player, w, VIEW.w, VIEW.h);
  const rec = new CanvasRecorder();
  const view = interpolate({ x: sim.player.x, y: sim.player.y, rot: sim.player.rot }, sim.player, 1);
  draw(rec.asContext(), sim.player, view, w, cam, VIEW.w, VIEW.h, INFO);
  return rec;
}

test("the ship's nose points UP while climbing and DOWN while diving", () => {
  // The bug this pins: `rot` came from atan2(vy, speed), a world-space angle,
  // but was applied straight to a y-down canvas — so the ship pitched nose-down
  // exactly when it was climbing.
  const climbing = nose(renderShip(300));
  const level = nose(renderShip(0));
  const diving = nose(renderShip(-300));

  assert.ok(
    climbing.y < level.y - 1,
    `climbing nose (screen y ${climbing.y.toFixed(1)}) must be ABOVE level (${level.y.toFixed(1)})`,
  );
  assert.ok(
    diving.y > level.y + 1,
    `diving nose (screen y ${diving.y.toFixed(1)}) must be BELOW level (${level.y.toFixed(1)})`,
  );
});

test("the ship's nose is genuinely forward of its centre", () => {
  // A craft with no reading direction cannot show a pitch change at all.
  const rec = renderShip(0);
  const hull = rec.shapes.find(
    (s) => (s.kind === "path" || s.kind === "rect") && s.op === "fill" && s.style === PALETTE.shipHull,
  ) as { points: { x: number; y: number }[] };
  const xs = hull.points.map((p) => p.x);
  const centre = (Math.min(...xs) + Math.max(...xs)) / 2;
  assert.ok(nose(rec).x > centre, "the forward-most point must be ahead of the hull centre");
});

test("a cube in flight rolls forward, not backward", () => {
  // Moving right, the cube must roll clockwise ON SCREEN. This is the other
  // half of the rotation convention: world CCW-positive, negated once on the
  // way to the canvas.
  const p = new Player();
  p.onGround = false;
  p.rot = 0;
  for (let i = 0; i < 60; i++) {
    p.def.applyRotation(p, { held: false, ringArmed: false }, p.speed(), 1 / 240);
  }
  assert.ok(p.rot < 0, `world rotation should decrease (screen-clockwise); was ${p.rot.toFixed(3)}`);
});

test("a half-size spike draws at half size, seated on the surface", () => {
  // The object table has 0.5x0.5 spikes. Assuming every hazard fills a whole
  // cell drew those at double scale on a cell whose origin sits a quarter tile
  // below the surface — too big AND sunk into the floor.
  const full = makeWorld([{ t: "spike", x: 6, y: 0 }]);
  const half = makeWorld([{ t: "spike", x: 6, y: 0, gw: 0.5, gh: 0.5 }]);

  const fullTri = render(full, (s) => { s.player.x = 4 * TILE; }).rec.triangles(PALETTE.spike)[0];
  const halfTri = render(half, (s) => { s.player.x = 4 * TILE; }).rec.triangles(PALETTE.spike)[0];

  const height = (t: { y: number }[]) => Math.max(...t.map((p) => p.y)) - Math.min(...t.map((p) => p.y));
  const ratio = height(halfTri) / height(fullTri);
  assert.ok(Math.abs(ratio - 0.5) < 0.05, `half spike drew at ${ratio.toFixed(2)}x, expected 0.5x`);

  // Both bases sit on the same surface — a smaller spike must not sink.
  const base = (t: { y: number }[]) => Math.max(...t.map((p) => p.y));
  assert.ok(
    Math.abs(base(halfTri) - base(fullTri)) < 1,
    `half spike base at ${base(halfTri).toFixed(1)}, full at ${base(fullTri).toFixed(1)}`,
  );
});

test("no spike in the real level is drawn below its own ground line", () => {
  // The general guarantee, swept across the whole level. Any authored spike
  // whose triangle dips under the floor fails here, in any level.
  const w = new World(stereoMadness as LevelDoc);
  for (let gx = 4; gx < w.columns.length - 4; gx += 11) {
    const { rec, cam } = render(w, (s) => { s.player.x = gx * TILE; });
    const scale = VIEW.h / (VIEW_TILES * TILE);
    const vh = VIEW.h / scale;
    const groundScreenY = (vh / 2 - (0 - cam.y)) * scale;
    for (const tri of rec.triangles(PALETTE.spike)) {
      const base = Math.max(...tri.map((p) => p.y));
      assert.ok(
        base <= groundScreenY + 1.5,
        `at tile ${gx} a spike base sits ${(base - groundScreenY).toFixed(1)}px below the ground line`,
      );
    }
  }
});
