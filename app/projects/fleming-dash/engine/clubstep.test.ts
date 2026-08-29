// Clubstep, held to its specification.
//
// Every expected value is transcribed from the game's own level file — see
// levels/SPEC-clubstep.md. The mode/size/gravity timeline test is the load-
// bearing one: it is what proves the ball is mini, the UFOs are mini, and the
// inverted cube section exists, against the file the real game ships.

import { test } from "node:test";
import assert from "node:assert/strict";

import { validateLevel } from "./level.ts";
import { Simulation } from "./simulate.ts";
import { World } from "./world.ts";
import { HELD, RELEASED, stepChecked } from "./test-support.ts";
import type { LevelDoc, LevelObject, SimEvent } from "./types.ts";
import clubstep from "../levels/clubstep.json" with { type: "json" };

const doc = clubstep as LevelDoc;

test("the level opens black on black at 1x cube", () => {
  assert.equal(doc.startMode, "cube");
  assert.equal(doc.speed, 1, "constant 1x: speed portals are 1.7-era ids");
  assert.deepEqual(doc.bgColor, [0, 0, 0]);
  assert.deepEqual(doc.groundColor, [0, 0, 0]);
});

test("the full mode / size / gravity timeline matches the level file", () => {
  const events = doc.objects
    .filter(
      (o) =>
        o.t === "cube" ||
        o.t === "ship" ||
        o.t === "ball" ||
        o.t === "ufo" ||
        o.t === "grav" ||
        o.t === "size",
    )
    .map((o) => {
      if (o.t === "grav") return `grav:${o.dir}@${o.x}`;
      if (o.t === "size") return `size:${o.s}@${o.x}`;
      return `${o.t}@${o.x}`;
    });

  assert.deepEqual(events, [
    "grav:up@166",
    "grav:up@187",
    "grav:up@206.5",
    "grav:down@211.5",
    "grav:up@216.25",
    "ship@232",
    "grav:up@250",
    "grav:down@268",
    "grav:up@287",
    "cube@304",
    "size:mini@326", // mini persists through ball, UFO and ship
    "ball@389",
    "ufo@466.5",
    "grav:down@466.5",
    "ship@505",
    "cube@524.25",
    "size:normal@524.75",
    "grav:down@547",
    "grav:up@550",
    "grav:down@556",
    "ship@582",
    "size:mini@582",
    "grav:up@598",
    "ufo@614.75",
    "grav:down@614.75",
    "ship@661.5",
    "grav:down@661.5",
    "grav:up@719",
    "grav:down@725",
    "grav:up@732",
    "cube@738",
    "size:normal@738",
    "grav:down@738",
    "size:mini@753",
    "grav:up@753.25",
    "ship@768.5",
    "grav:down@779.25",
    "grav:up@786.75",
    "grav:down@816",
    "cube@816",
    "ship@850.75",
  ]);
});

test("wait — the sizes above must alternate mini/normal from a normal start", () => {
  // A cheap structural proof that the 99/101 portal identities are not
  // swapped: the FIRST size portal in a level that starts normal must be
  // mini, and they must alternate (a same-size portal would be a no-op).
  const sizes = doc.objects
    .filter((o): o is Extract<LevelObject, { t: "size" }> => o.t === "size")
    .map((o) => o.s);
  assert.equal(sizes[0], "mini", "a normal-size start makes the first size portal mini");
  for (let i = 1; i < sizes.length; i++) {
    assert.notEqual(sizes[i], sizes[i - 1], `size portal ${i} is a no-op`);
  }
});

test("the object census matches the real level file", () => {
  const count = (t: string) => doc.objects.filter((o) => o.t === t).length;
  const cells = doc.objects
    .filter((o): o is Extract<LevelObject, { t: "block" }> => o.t === "block")
    .reduce((n, o) => n + (o.w ?? 1), 0);

  // 3,837 includes the 1,624 cells of legacy 1.3-1.6 block ids (69-75,
  // 91-96, 119, 161-169, 193) that are unlisted in the modern editor. Losing
  // them again would fail here first.
  assert.equal(cells, 3837, "solid cells");
  assert.equal(count("spike"), 569, "spikes");
  assert.equal(count("saw"), 139, "saws");
  assert.equal(count("pit"), 771, "ground pits");
  assert.equal(count("color"), 96, "colour triggers");
  assert.equal(count("coin"), 3, "secret coins");

  const byColor = (t: "pad" | "ring") => {
    const m: Record<string, number> = {};
    for (const o of doc.objects) {
      if (o.t !== t) continue;
      const c = o.c ?? "yellow";
      m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  };
  assert.deepEqual(byColor("pad"), { yellow: 9, pink: 7, blue: 16 }, "pad colours");
  assert.deepEqual(byColor("ring"), { yellow: 40, pink: 22, blue: 62 }, "orb colours");
});

test("every saw carries a real radius from the game's own data", () => {
  const radii: Record<string, number> = {};
  for (const o of doc.objects) {
    if (o.t !== "saw") continue;
    radii[o.cr] = (radii[o.cr] ?? 0) + 1;
  }
  assert.deepEqual(radii, {
    "32.3": 84, // ids 88 (30) + 186 (54)
    "21.6": 28, // id 89
    "12": 4, // id 98
    "15.48": 12, // id 183
    "20.4": 3, // id 184
    "3": 4, // id 185
    "21.96": 4, // id 187
  });
});

test("the three coins sit where the level puts them", () => {
  const coins = doc.objects
    .filter((o): o is Extract<LevelObject, { t: "coin" }> => o.t === "coin")
    .map((o) => [o.x, o.y]);
  assert.deepEqual(coins, [
    [89, 3],
    [638.5, 19],
    [869, 2],
  ]);
});

test("validateLevel is quiet about the shipped level", () => {
  assert.deepEqual(validateLevel(doc), []);
});

test("the level compiles and the whole run upholds every invariant", () => {
  const w = new World(doc);
  assert.equal(w.coinCount, 3);
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
