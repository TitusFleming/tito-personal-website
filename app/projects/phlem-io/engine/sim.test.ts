// The Phlem.io engine, held to its own rules.
//
// The vanilla mechanics (radius, eat threshold, split, merge, decay, virus)
// are asserted against the Ogar-documented figures in constants.ts, and the
// design requirements that came in words — "no preference for attacking the
// player", "bots leave after 10-15 deaths", "the biggest blobs quit" — are
// asserted as behaviour, because words drift and tests do not.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BIG_QUIT_MASS,
  INITIAL_MASS_MAX,
  BOT_COUNT,
  BOT_DEATHS_MAX,
  BOT_DEATHS_MIN,
  EAT_MASS_RATIO,
  MAX_PIECES,
  MIN_SPLIT_MASS,
  PELLET_TARGET,
  START_MASS,
  VIRUS_POP_SHARDS,
  WORLD_SIZE,
  radiusOf,
} from "./constants.ts";
import { PhlemSim, canEat, recombineTime, speedOf, totalMass } from "./sim.ts";
import { thinkBot } from "./bots.ts";
import NAMES from "./names.json" with { type: "json" };

const DT = 1 / 60;
const idle = { aimX: 0, aimY: 0, split: false };

function sim(seed = 7): PhlemSim {
  const s = new PhlemSim(seed, "Tester");
  // Park the player in a corner so scripted scenarios control the action.
  s.player.pieces[0].x = 50;
  s.player.pieces[0].y = 50;
  return s;
}

// ── vanilla numbers ─────────────────────────────────────────────────────────

test("radius follows the vanilla size rule and speed falls with size", () => {
  assert.equal(radiusOf(100), 100, "mass 100 is size 100, the virus anchor");
  assert.ok(Math.abs(radiusOf(START_MASS) - 31.62) < 0.01);
  assert.ok(speedOf(10) > speedOf(100), "bigger is slower");
  assert.ok(speedOf(100) > speedOf(1000));
});

test("eating needs a 25% mass edge AND real coverage", () => {
  // At the ratio boundary, no meal, however deep the overlap.
  assert.equal(canEat(124, 100, 0), false);
  assert.equal(canEat(126, 100, 0), true);
  // With the edge but barely touching, still no meal.
  const dist = radiusOf(126) - radiusOf(100) * 0.4;
  assert.equal(canEat(126, 100, dist + 1), false);
  assert.equal(canEat(126, 100, dist - 1), true);
});

test("the merge clock scales with mass", () => {
  assert.ok(recombineTime(36) < recombineTime(1000));
  assert.ok(recombineTime(0) >= 30, "base is Ogar's 30 seconds");
});

// ── split and merge ─────────────────────────────────────────────────────────

test("a split halves the piece, launches the twin, and starts the clock", () => {
  const s = sim();
  const p = s.player;
  p.pieces[0].mass = 100;
  s.step(DT, { aimX: 500, aimY: 50, split: true });
  assert.equal(p.pieces.length, 2);
  const [a, b] = p.pieces;
  assert.ok(Math.abs(a.mass - 50) < 1 && Math.abs(b.mass - 50) < 1);
  assert.ok(a.cooldown > 0 && b.cooldown > 0);
  assert.ok(Math.hypot(b.ix, b.iy) > 0, "the twin is launched");
});

test("a piece under the minimum refuses to split", () => {
  const s = sim();
  s.player.pieces[0].mass = MIN_SPLIT_MASS - 1;
  s.step(DT, { aimX: 500, aimY: 50, split: true });
  assert.equal(s.player.pieces.length, 1);
});

test("splitting never exceeds the 16-piece cap", () => {
  const s = sim();
  s.player.pieces[0].mass = 40000;
  for (let i = 0; i < 8; i++) s.step(DT, { aimX: 3000, aimY: 3000, split: true });
  assert.ok(s.player.pieces.length <= MAX_PIECES, `${s.player.pieces.length} pieces`);
});

test("pieces re-merge only after the cooldown", () => {
  const s = sim();
  const p = s.player;
  p.pieces[0].mass = 100;
  s.step(DT, { aimX: 500, aimY: 50, split: true });
  assert.equal(p.pieces.length, 2);
  // Force the pieces together while the clock runs: they must stay two.
  for (const piece of p.pieces) {
    piece.x = 300;
    piece.y = 50;
    piece.ix = 0;
    piece.iy = 0;
  }
  s.step(DT, { aimX: 300, aimY: 50, split: false });
  assert.equal(p.pieces.length, 2, "no merging on cooldown");
  for (const piece of p.pieces) {
    piece.cooldown = 0;
    piece.x = 300;
    piece.y = 50;
  }
  s.step(DT, { aimX: 300, aimY: 50, split: false });
  assert.equal(p.pieces.length, 1, "merged once both clocks expired");
  assert.ok(Math.abs(totalMass(p) - 100) < 2, "mass conserved through the round trip");
});

// ── viruses ─────────────────────────────────────────────────────────────────

test("eating a virus pops the piece into shards and respawns the virus", () => {
  const s = sim();
  // Hermetic: the uneven lobby can seed a monster near the virus, and a
  // shard flying into its mouth is not what this test is about.
  for (const a of s.actors) {
    if (a.isPlayer) continue;
    for (const piece of a.pieces) {
      piece.x = WORLD_SIZE - 60;
      piece.y = WORLD_SIZE - 60;
    }
  }
  const p = s.player.pieces[0];
  // And pellet-free: the scattering shards would hoover up pellets in the
  // same step, which is correct play but noise in a conservation check.
  s.pellets = [];
  p.mass = 400;
  const virusCount = s.viruses.length;
  const v = s.viruses[0];
  p.x = v.x;
  p.y = v.y;
  const before = totalMass(s.player) + v.mass;
  s.step(DT, { aimX: v.x, aimY: v.y, split: false });
  assert.ok(s.player.pieces.length > 1, "popped into shards");
  assert.ok(s.player.pieces.length <= VIRUS_POP_SHARDS + 1);
  assert.equal(s.viruses.length, virusCount, "a new virus replaced the eaten one");
  const after = totalMass(s.player);
  assert.ok(Math.abs(after - before) < before * 0.01, "virus mass was absorbed");
});

// ── bots: the design requirements, as behaviour ─────────────────────────────

test("prey choice follows size and distance, never identity", () => {
  const s = sim();
  const hunter = s.actors[1];
  const otherBot = s.actors[2];
  // Clear the stage: everyone else far away.
  for (const a of s.actors) {
    if (a === hunter || a === otherBot || a === s.player) continue;
    for (const p of a.pieces) {
      p.x = WORLD_SIZE - 60;
      p.y = WORLD_SIZE - 60;
    }
  }
  hunter.pieces = [{ x: 3000, y: 3000, mass: 200, ix: 0, iy: 0, cooldown: 0 }];
  hunter.persona.aggression = 1; // always hunt when a meal exists
  s.player.pieces = [{ x: 3400, y: 3000, mass: 50, ix: 0, iy: 0, cooldown: 0 }];
  otherBot.pieces = [{ x: 2800, y: 3000, mass: 50, ix: 0, iy: 0, cooldown: 0 }];

  // Identical prey; the bot is closer. The bot must be chosen even though
  // the player is on the menu too.
  thinkBot(hunter, s);
  assert.ok(
    Math.abs(hunter.desiredX - 2800) < 50,
    `aimed at ${hunter.desiredX}, expected the closer bot`,
  );

  // Swap the distances and the player becomes the pick, for the same reason.
  s.player.pieces[0].x = 2800;
  otherBot.pieces[0].x = 3400;
  thinkBot(hunter, s);
  assert.ok(
    Math.abs(hunter.desiredX - 2800) < 50,
    `aimed at ${hunter.desiredX}, expected the closer player`,
  );
});

test("a bot flees a blob that can eat it", () => {
  const s = sim();
  const runner = s.actors[1];
  const monster = s.actors[2];
  runner.pieces = [{ x: 3000, y: 3000, mass: 50, ix: 0, iy: 0, cooldown: 0 }];
  monster.pieces = [{ x: 3200, y: 3000, mass: 800, ix: 0, iy: 0, cooldown: 0 }];
  thinkBot(runner, s);
  assert.ok(
    runner.desiredX < 3000,
    `fled toward ${runner.desiredX}, expected away from the monster`,
  );
});

test("bot steering eases toward the decision instead of snapping", () => {
  const s = sim();
  const bot = s.actors[1];
  bot.pieces = [{ x: 3000, y: 3000, mass: 50, ix: 0, iy: 0, cooldown: 0 }];
  bot.aimX = 3000;
  bot.aimY = 3000;
  bot.desiredX = 4000;
  bot.desiredY = 3000;
  bot.thinkIn = 999; // no re-decision this step; only the easing acts
  s.step(DT, idle);
  assert.ok(bot.aimX > 3000, "the aim moves toward the want");
  assert.ok(bot.aimX < 3100, `moved ${(bot.aimX - 3000).toFixed(1)}px in one step — a snap, not a turn`);
});

test("the lobby starts uneven, like a match already in progress", () => {
  // Across seeds: the player always starts at 10, every bot is somewhere
  // between START_MASS and the cap, and the spread genuinely contains both
  // grazers and monsters rather than an even footing.
  for (const seed of [1, 7, 99]) {
    const s = new PhlemSim(seed, "Fresh");
    assert.equal(totalMass(s.player), START_MASS, "the newcomer starts small");
    const masses = s.actors.filter((a) => !a.isPlayer).map((a) => totalMass(a));
    for (const m of masses) {
      assert.ok(m >= START_MASS - 1 && m <= INITIAL_MASS_MAX + 1, `mass ${m} out of range`);
    }
    assert.ok(masses.filter((m) => m < 100).length >= 4, "plenty of small blobs");
    assert.ok(masses.filter((m) => m > 400).length >= 2, "a mid-to-heavy tier exists");
    assert.ok(Math.max(...masses) > 1000, "somebody is already massive");
  }
});

test("an identity leaves only after its 10-15 deaths, then a new demon joins", () => {
  const s = sim();
  const victim = s.actors[1];
  assert.ok(victim.deathsLeft >= BOT_DEATHS_MIN && victim.deathsLeft <= BOT_DEATHS_MAX);
  const name = victim.name;

  victim.deathsLeft = 2;
  const eat = () => {
    // Teleport a monster player onto the victim.
    s.player.pieces = [
      { x: victim.pieces[0].x, y: victim.pieces[0].y, mass: 5000, ix: 0, iy: 0, cooldown: 0 },
    ];
    s.step(DT, { aimX: s.player.pieces[0].x, aimY: s.player.pieces[0].y, split: false });
  };

  eat();
  assert.equal(victim.name, name, "one death is not a reason to leave");
  assert.ok(victim.respawnIn > 0, "waiting to rejoin under the same name");
  // Let it respawn, then kill it again to exhaust the identity.
  for (let i = 0; i < 600 && victim.pieces.length === 0; i++) s.step(DT, idle);
  assert.ok(victim.pieces.length > 0, "respawned");
  eat();

  const events = s.takeEvents();
  assert.ok(
    events.some((e) => e.type === "leave" && e.name === name && e.reason === "eaten-out"),
    "the exhausted identity left",
  );
  assert.ok(events.some((e) => e.type === "join" && e.name === victim.name));
  assert.notEqual(victim.name, name, "the seat belongs to a new demon now");
});

test("the biggest blobs eventually ragequit", () => {
  const s = sim();
  const rich = s.actors[1];
  const name = rich.name;
  rich.pieces = [{ x: 3000, y: 3000, mass: BIG_QUIT_MASS + 500, ix: 0, iy: 0, cooldown: 0 }];
  rich.quitAfter = 0.5; // the fuse is random per identity; shorten it for the test
  for (let i = 0; i < 90; i++) s.step(DT, idle);
  const events = s.takeEvents();
  assert.ok(
    events.some((e) => e.type === "leave" && e.name === name && e.reason === "rich-quit"),
    "the giant left the lobby",
  );
});

// ── the lobby as a whole ────────────────────────────────────────────────────

test("names come from the AREDL and never collide in the lobby", () => {
  const s = sim();
  const pool = new Set(NAMES as string[]);
  const bots = s.actors.filter((a) => !a.isPlayer);
  assert.equal(bots.length, BOT_COUNT);
  const names = bots.map((b) => b.name);
  assert.equal(new Set(names).size, names.length, "no duplicate names");
  for (const n of names) assert.ok(pool.has(n), `${n} is not an AREDL demon`);
  assert.ok(pool.size >= BOT_COUNT * 5, "pool is at least 5x the lobby, per the design");
});

test("thirty simulated seconds hold every invariant", () => {
  const s = new PhlemSim(1234, "Smoke");
  for (let i = 0; i < 30 * 60; i++) {
    s.step(DT, { aimX: s.player.pieces[0]?.x ?? 0, aimY: s.player.pieces[0]?.y ?? 0, split: false });
    if (i % 60 !== 0) continue;
    assert.equal(s.actors.length, BOT_COUNT + 1, "seats never appear or vanish");
    for (const a of s.actors) {
      for (const p of a.pieces) {
        assert.ok(p.mass > 0 && Number.isFinite(p.mass), "masses stay positive");
        assert.ok(p.x >= 0 && p.x <= WORLD_SIZE && p.y >= 0 && p.y <= WORLD_SIZE, "in bounds");
        assert.ok(a.pieces.length <= MAX_PIECES);
      }
    }
    const alive = s.actors.filter((a) => a.pieces.length > 0 || a.respawnIn > 0);
    assert.ok(alive.length >= BOT_COUNT - 2, "the lobby stays populated");
    assert.ok(s.pellets.length <= PELLET_TARGET);
  }
});

test("same seed, same session — the sim is deterministic", () => {
  const run = () => {
    const s = new PhlemSim(42, "Det");
    for (let i = 0; i < 600; i++) {
      s.step(DT, { aimX: 1000, aimY: 1000, split: i === 120 });
    }
    return JSON.stringify({
      actors: s.actors.map((a) => [a.name, a.pieces.map((p) => [p.x, p.y, p.mass])]),
      pellets: s.pellets.length,
    });
  };
  assert.equal(run(), run());
});

test("eat ratio sanity: a fresh spawn cannot be eaten by another fresh spawn", () => {
  assert.equal(canEat(START_MASS, START_MASS, 0), false);
  assert.equal(START_MASS * EAT_MASS_RATIO > START_MASS, true);
});
