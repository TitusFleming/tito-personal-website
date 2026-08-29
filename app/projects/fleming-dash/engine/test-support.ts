// Shared test scaffolding, and the invariant harness.
//
// THE POINT OF THE HARNESS
// Every bug found in the first audit of this engine was a *transition* or
// *composition* bug, not a mechanic behaving wrong in isolation — and the unit
// tests all placed the player by hand into a static pose and asserted one
// thing. `stepChecked` closes that gap: it asserts a set of always-true
// properties after every single step of every test that uses it, so a state
// machine that drifts is caught by whatever test happens to be running rather
// than by a test somebody remembered to write.
//
// Concretely: the stale-onGround bug violated GROUNDED_IMPLIES_SUPPORTED on
// every step of a ledge fall. Any test that walked a player off a platform
// would have failed instantly.

import assert from "node:assert/strict";

import { FIXED_DT, SPEEDS, TILE } from "./constants.ts";
import { Simulation } from "./simulate.ts";
import { World } from "./world.ts";
import type { InputState, LevelDoc, LevelObject, SimEvent } from "./types.ts";

export const RELEASED: InputState = { held: false, ringArmed: false };
export const HELD: InputState = { held: true, ringArmed: true };

/** A minimal valid level, overridable per test. */
export function doc(over: Partial<LevelDoc> = {}): LevelDoc {
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

export function world(objects: LevelObject[], over: Partial<LevelDoc> = {}): World {
  return new World(doc({ objects: [...objects, { t: "end", x: 100 }], ...over }));
}

/**
 * The highest surface at the player's x that could be holding them up.
 *
 * Ground scalar or the top of any solid they horizontally overlap, whichever is
 * higher, ignoring surfaces above their feet.
 */
function supportHeight(sim: Simulation): number {
  const p = sim.player;
  const feet = p.y - p.halfH();
  let best = sim.world.groundAt(p.x);
  const box = p.box();
  const [lo, hi] = sim.world.span(box);
  for (let gx = lo; gx <= hi; gx++) {
    const col = sim.world.columns[gx];
    if (!col) continue;
    for (const solid of col.solids) {
      const r = solid.box;
      if (r.x >= box.x + box.w || r.x + r.w <= box.x) continue;
      const top = r.y + r.h;
      if (top <= feet + 0.51 && top > best) best = top;
    }
  }
  return best;
}

export type Invariant = {
  name: string;
  check: (sim: Simulation, prev: Snapshot) => void;
  /**
   * Skip on any step that launched the player.
   *
   * A pad, ring or portal fires at the END of a step, after position has
   * already been resolved: it clears onGround so the next step's input handler
   * knows the player is airborne, but the player has not physically moved yet.
   * For exactly one step the flag legitimately leads the position. Suppressing
   * the check on those steps is narrower than weakening the invariant itself,
   * which would blind it to the stale-flag bug it exists to catch.
   */
  skipOnLaunch?: boolean;
};
type Snapshot = { x: number; y: number; status: string };

const LAUNCH_EVENTS = new Set(["pad", "ring", "portal", "gravity", "size"]);

/** Tolerance in px. One step at terminal velocity is ~5.8px, so 0.5 is tight. */
const EPS = 0.5;

export const INVARIANTS: Invariant[] = [
  {
    name: "GROUNDED_IMPLIES_SUPPORTED",
    check(sim) {
      const p = sim.player;
      if (!p.onGround || p.gravitySign !== 1) return;
      const feet = p.y - p.halfH();
      const support = supportHeight(sim);
      assert.ok(
        Math.abs(feet - support) <= EPS,
        `onGround but feet are ${(feet - support).toFixed(2)}px from any surface`,
      );
    },
  },
  {
    // The mirror of the above, and the one that catches a MISSED collision
    // rather than a stale flag: the player must never end a step sunk into
    // geometry, grounded or not.
    //
    // Deliberately not "airborne implies not touching a surface" — a falling
    // player is legitimately a fraction of a pixel above a block on the step
    // before it lands, and asserting otherwise produces noise rather than
    // signal. Being BELOW a surface is never legitimate.
    name: "NOT_EMBEDDED_IN_GEOMETRY",
    skipOnLaunch: true,
    check(sim) {
      const p = sim.player;
      if (p.gravitySign !== 1 || sim.status !== "running") return;
      const feet = p.y - p.halfH();
      const support = supportHeight(sim);
      assert.ok(
        feet >= support - EPS,
        `sunk ${(support - feet).toFixed(2)}px into a surface (feet ${feet.toFixed(2)}, support ${support.toFixed(2)})`,
      );
    },
  },
  {
    name: "X_ADVANCES_WHILE_RUNNING",
    check(sim, prev) {
      if (sim.status !== "running" || prev.status !== "running") return;
      assert.ok(sim.player.x > prev.x, "x must advance every running step");
    },
  },
  {
    name: "NO_TUNNELLING",
    check(sim, prev) {
      if (sim.status !== "running" || prev.status !== "running") return;
      // A single step must never move further vertically than one tile, or a
      // discrete overlap test could pass straight through a platform.
      assert.ok(
        Math.abs(sim.player.y - prev.y) <= TILE,
        `y moved ${Math.abs(sim.player.y - prev.y).toFixed(2)}px in one step, over one tile`,
      );
    },
  },
  {
    name: "VY_BOUNDED",
    check(sim) {
      // Generous: the cap is applied after acceleration, so one step of
      // overshoot is legitimate. This is a runaway detector, not a tight bound.
      assert.ok(
        Math.abs(sim.player.vy) < 5000,
        `vy ran away to ${sim.player.vy.toFixed(1)}`,
      );
    },
  },
  {
    name: "STATUS_IS_ONE_WAY",
    check(sim, prev) {
      if (prev.status === "complete") assert.equal(sim.status, "complete");
      if (prev.status === "dead") {
        assert.ok(sim.status === "dead", "a dead sim must not resurrect itself");
      }
    },
  },
  {
    name: "SPEED_IS_A_TABLE_ENTRY",
    check(sim) {
      assert.ok(
        SPEEDS.includes(sim.player.speed() as (typeof SPEEDS)[number]),
        `speed ${sim.player.speed()} is not one of the defined speeds`,
      );
    },
  },
];

/**
 * Step the simulation once, asserting every invariant afterwards.
 *
 * Use this instead of sim.step() in tests. The cost is a handful of comparisons
 * per step and the benefit is that every test in the suite polices the whole
 * state machine, not just the thing it was written for.
 */
export function stepChecked(
  sim: Simulation,
  input: InputState = RELEASED,
  out: SimEvent[] = [],
  dt = FIXED_DT,
): SimEvent[] {
  const prev = { x: sim.player.x, y: sim.player.y, status: sim.status };
  const before = out.length;
  sim.step({ ...input }, dt, out);
  const launched = out.slice(before).some((e) => LAUNCH_EVENTS.has(e.type));

  for (const inv of INVARIANTS) {
    if (inv.skipOnLaunch && launched) continue;
    try {
      inv.check(sim, prev);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `invariant ${inv.name} failed at t=${sim.t.toFixed(4)} ` +
          `x=${sim.player.x.toFixed(1)} y=${sim.player.y.toFixed(1)} ` +
          `vy=${sim.player.vy.toFixed(1)} mode=${sim.player.mode} ` +
          `onGround=${sim.player.onGround}: ${detail}`,
      );
    }
  }
  return out;
}

/** Run n checked steps, or until the sim stops running. Returns the events. */
export function run(
  sim: Simulation,
  steps: number,
  input: InputState = RELEASED,
): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < steps && sim.status === "running"; i++) {
    stepChecked(sim, input, out);
  }
  return out;
}

/** Advance until a predicate holds, with a step budget. Throws if never reached. */
export function runUntil(
  sim: Simulation,
  predicate: (s: Simulation) => boolean,
  input: InputState = RELEASED,
  budget = 20_000,
): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < budget; i++) {
    if (predicate(sim)) return out;
    stepChecked(sim, input, out);
  }
  throw new Error("runUntil: predicate never became true within the step budget");
}
