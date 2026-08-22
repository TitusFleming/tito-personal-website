// The real imported level, as a regression fixture.
//
// The synthetic tests use three-object worlds; this one runs the actual 930
// objects of Stereo Madness through the invariant harness. It is the closest
// thing here to a replay tape until a recorded one exists, and it is what would
// catch a refactor that compiles, passes every unit test, and quietly breaks
// the only level anybody plays.

import { test } from "node:test";
import assert from "node:assert/strict";

import { TILE } from "./constants.ts";
import { validateLevel } from "./level.ts";
import { Simulation } from "./simulate.ts";
import { World } from "./world.ts";
import { HELD, RELEASED, stepChecked } from "./test-support.ts";
import type { LevelDoc, SimEvent } from "./types.ts";
import stereoMadness from "../levels/stereo-madness.json" with { type: "json" };

const doc = stereoMadness as LevelDoc;

test("the shipped level compiles", () => {
  const w = new World(doc);
  assert.equal(w.id, "stereo-madness");
  assert.ok(w.lengthPx > 0);
  assert.ok(w.columns.length > 100);
});

test("every authored object lands in a category", () => {
  const w = new World(doc);
  const counts = { solids: 0, hazards: 0, triggers: 0, decor: 0 };
  const seen = new Set<unknown>();
  for (const col of w.columns) {
    for (const [key, list] of Object.entries(col) as [keyof typeof counts, unknown[]][]) {
      if (!Array.isArray(list)) continue;
      for (const o of list) {
        if (seen.has(o)) continue;
        seen.add(o);
        counts[key]++;
      }
    }
  }
  // 312 block spans, 187 spikes, 423 pits, and 18 triggers: 4 mode portals
  // plus the level's own 14 colour changes.
  assert.equal(counts.solids, 312, "blocks");
  assert.equal(counts.hazards, 187, "spikes");
  assert.equal(counts.decor, 423, "pits");
  assert.equal(counts.triggers, 18, "portals + colour triggers");
  assert.equal(w.triggerCount, 18);
});

test("the level's own geometry sets the camera ceiling", () => {
  const w = new World(doc);
  assert.ok(w.maxHeight >= 3 * TILE, `tallest solid is ${w.maxHeight / TILE} tiles`);
});

test("validateLevel is quiet about the shipped level", () => {
  const errors = validateLevel(doc).filter((v) => v.severity === "error");
  assert.deepEqual(errors, [], "the level we ship must have no structural errors");
});

test("the opening run to the first spike is survivable with no input", () => {
  // Stereo Madness opens on flat ground, with its first spike at tile 17 —
  // 1.64s in at 1x. Running to just short of it must be uneventful. If a
  // physics change kills the player on flat ground, this says so immediately.
  const firstSpikeX = 17 * TILE;
  const sim = new Simulation(new World(doc));
  const out: SimEvent[] = [];

  while (sim.status === "running" && sim.player.x < firstSpikeX - TILE) {
    stepChecked(sim, RELEASED, out);
  }
  assert.equal(sim.status, "running", "died on the flat opening stretch");
  assert.ok(sim.player.onGround, "should be running along the floor");
  assert.deepEqual(out.filter((e) => e.type === "death"), [], "no deaths before the first spike");

  // And the first spike does kill an idle player — the level is not trivially
  // survivable, so the check above is actually testing something.
  while (sim.status === "running" && sim.player.x < firstSpikeX + TILE * 2) {
    stepChecked(sim, RELEASED, out);
  }
  assert.equal(sim.status, "dead", "walking into the first spike must kill");
});

test("the whole level upholds every invariant under scripted input", () => {
  // Not a solve — a fuzz. Several input patterns, each run to death or to the
  // step budget, with the full invariant set checked after every single step.
  // Any pattern that produces an impossible state fails here.
  for (const period of [7, 13, 31, 60, 97]) {
    const sim = new Simulation(new World(doc));
    const out: SimEvent[] = [];
    let steps = 0;
    while (sim.status === "running" && steps < 8_000) {
      stepChecked(sim, steps % period < period / 2 ? HELD : RELEASED, out);
      steps++;
    }
    assert.ok(steps > 0, `pattern ${period} did not advance`);
    // Reaching a death is fine and expected; reaching an impossible state is
    // what stepChecked would already have thrown on.
    assert.ok(
      sim.status === "running" || sim.status === "dead" || sim.status === "complete",
      `pattern ${period} ended in ${sim.status}`,
    );
  }
});

test("progress never exceeds 100 or goes backwards, across the real level", () => {
  const sim = new Simulation(new World(doc));
  const out: SimEvent[] = [];
  let last = 0;
  for (let i = 0; i < 8_000 && sim.status === "running"; i++) {
    stepChecked(sim, i % 40 < 12 ? HELD : RELEASED, out);
    const pct = sim.progressPercent();
    assert.ok(pct >= last && pct <= 100, `progress went ${last} -> ${pct}`);
    last = pct;
  }
});
