// Back on Track, held to its specification.
//
// Every expected number here is transcribed from the game's own level file —
// see levels/SPEC-back-on-track.md for the derivation and sources. If the
// importer, the object table, or the level JSON drifts from the real level,
// this file is what says so.

import { test } from "node:test";
import assert from "node:assert/strict";

import { TILE } from "./constants.ts";
import { validateLevel } from "./level.ts";
import { Simulation } from "./simulate.ts";
import { World } from "./world.ts";
import { HELD, RELEASED, stepChecked } from "./test-support.ts";
import type { LevelDoc, LevelObject, SimEvent } from "./types.ts";
import backOnTrack from "../levels/back-on-track.json" with { type: "json" };

const doc = backOnTrack as LevelDoc;

test("the level opens exactly as the header says", () => {
  assert.equal(doc.startMode, "cube");
  assert.equal(doc.speed, 1, "constant 1x, as in 1.0");
  assert.deepEqual(doc.bgColor, [255, 4, 181]);
  assert.deepEqual(doc.groundColor, [226, 0, 138]);
});

test("mode timeline: cube, ship at 421, cube at 559", () => {
  const portals = doc.objects
    .filter((o) => o.t === "cube" || o.t === "ship")
    .map((o) => `${o.t}@${o.x}`);
  assert.deepEqual(portals, ["ship@421", "cube@559"]);
});

test("the object census matches the real level file", () => {
  const count = (t: string) => doc.objects.filter((o) => o.t === t).length;
  const cells = doc.objects
    .filter((o): o is Extract<LevelObject, { t: "block" }> => o.t === "block")
    .reduce((n, o) => n + (o.w ?? 1), 0);

  assert.equal(cells, 464, "solid cells");
  assert.equal(count("spike"), 149, "spikes");
  assert.equal(count("saw"), 0, "no saws in a 1.0 level");
  assert.equal(count("pit"), 370, "ground pits");
  assert.equal(count("ring"), 0, "no orbs in a 1.0 level");
  assert.equal(count("color"), 10, "colour triggers");
  assert.equal(count("coin"), 3, "secret coins");

  const pads: Record<string, number> = {};
  for (const o of doc.objects) {
    if (o.t !== "pad") continue;
    const c = o.c ?? "yellow";
    pads[c] = (pads[c] ?? 0) + 1;
  }
  assert.deepEqual(pads, { yellow: 19, blue: 1 }, "pad colours");
});

test("the three coins sit where the level puts them", () => {
  const coins = doc.objects
    .filter((o): o is Extract<LevelObject, { t: "coin" }> => o.t === "coin")
    .map((o) => [o.x, o.y]);
  assert.deepEqual(coins, [
    [351, 8],
    [466, 7],
    [711, 1.5],
  ]);
});

test("validateLevel is quiet about the shipped level", () => {
  assert.deepEqual(validateLevel(doc), []);
});

test("the opening pad carries an idle player over the first spike run", () => {
  // Back on Track's own opening: a yellow pad at x=13.5 launches you clean
  // over the spikes at 14-17 with no input at all, and the spike at x=23 is
  // the first thing that actually demands a jump. Both halves are asserted,
  // so this fails if the pad weakens (short of the spikes) or strengthens
  // past believability (sails past 23 too), or if spike hitboxes drift.
  const sim = new Simulation(new World(doc));
  const out: SimEvent[] = [];
  while (sim.status === "running" && sim.player.x < 30 * TILE) {
    stepChecked(sim, RELEASED, out);
  }
  assert.equal(out.filter((e) => e.type === "pad").length, 1, "exactly one pad on the way");
  assert.equal(sim.status, "dead", "the x=23 spike must stop an idle player");
  const death = out.find((e) => e.type === "death");
  assert.ok(death && death.type === "death", "a death event must be reported");
  assert.ok(
    Math.abs(death.x / TILE - 23) < 1,
    `died at ${(death.x / TILE).toFixed(1)} tiles, expected ~23`,
  );
});

test("the whole level upholds every invariant under scripted input", () => {
  for (const period of [7, 13, 31, 60, 97]) {
    const sim = new Simulation(new World(doc));
    const out: SimEvent[] = [];
    let steps = 0;
    while (sim.status === "running" && steps < 8_000) {
      stepChecked(sim, steps % period < period / 2 ? HELD : RELEASED, out);
      steps++;
    }
    assert.ok(steps > 0, `pattern ${period} did not advance`);
  }
});
