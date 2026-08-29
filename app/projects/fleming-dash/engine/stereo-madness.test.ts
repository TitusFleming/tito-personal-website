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

test("every authored object lands in a category, counted by kind", () => {
  // By kind rather than one total, so adding a mechanic to the importer shows
  // up as the new kind appearing instead of an opaque number moving.
  const w = new World(doc);
  const seen = new Set<unknown>();
  const kinds: Record<string, number> = {};
  const buckets = { solids: 0, hazards: 0, triggers: 0, decor: 0 };

  for (const col of w.columns) {
    for (const key of ["solids", "hazards", "triggers", "decor"] as const) {
      for (const o of col[key]) {
        if (seen.has(o)) continue;
        seen.add(o);
        buckets[key]++;
        const kind = (o as { kind: string }).kind;
        kinds[kind] = (kinds[kind] ?? 0) + 1;
      }
    }
  }

  // 314 rather than 312 because x now keeps quarter-tile precision: nine blocks
  // in this level are genuinely placed off-grid, and two runs that used to be
  // merged by rounding are correctly kept separate.
  assert.equal(buckets.solids, 314, "block spans");
  assert.equal(buckets.hazards, 187, "spikes");
  assert.equal(buckets.decor, 423, "pits");
  assert.equal(kinds.portal, 4, "mode portals");
  assert.equal(kinds.color, 14, "colour changes");
  assert.equal(kinds.coin, 3, "secret coins");
  assert.equal(buckets.triggers, w.triggerCount, "every trigger is indexed");
});

test("the level has exactly three secret coins, numbered left to right", () => {
  const w = new World(doc);
  assert.equal(w.coinCount, 3);

  const coins: { index: number; x: number }[] = [];
  const seen = new Set<unknown>();
  for (const col of w.columns) {
    for (const t of col.triggers) {
      if ((t as { kind: string }).kind !== "coin" || seen.has(t)) continue;
      seen.add(t);
      coins.push({ index: (t as unknown as { index: number }).index, x: t.cell.x });
    }
  }
  coins.sort((a, b) => a.index - b.index);
  assert.deepEqual(coins.map((c) => c.index), [0, 1, 2]);
  for (let i = 1; i < coins.length; i++) {
    assert.ok(coins[i].x > coins[i - 1].x, "indices must run left to right");
  }
});

test("every coin is inside the reachable play area", () => {
  // The bug this pins: ship corridors had a hardcoded ten-tile ceiling, and the
  // third coin sits at y=12. The simulation clamps the ship at the ceiling, so
  // that coin was not merely hard to see — it was impossible to touch.
  const w = new World(doc);
  const seen = new Set<unknown>();
  for (const col of w.columns) {
    for (const t of col.triggers) {
      if ((t as { kind: string }).kind !== "coin" || seen.has(t)) continue;
      seen.add(t);
      const { floor, ceiling } = w.playBounds(t.cell.x);
      assert.ok(t.cell.y >= floor - TILE, `coin at x=${t.cell.x} is below the floor`);
      assert.ok(
        t.cell.y + t.cell.h <= ceiling,
        `coin at x=${t.cell.x} tops out at ${t.cell.y + t.cell.h} but the ceiling is ${ceiling}`,
      );
    }
  }
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
