// The composition seam.
//
// This is the ONLY place that maps an authored `t` tag to a runtime class. Add
// a mechanic and you touch exactly three things: a variant in LevelObject, a
// class in this directory, and one line here. Nothing in collision, simulation,
// camera or rendering needs to learn about it.
//
// The switch is exhaustive over the LevelObject union, so a new variant that
// nobody wired up is a compile error rather than an object that silently
// vanishes from the level.

import { Block } from "./block.ts";
import { ColorTrigger } from "./color.ts";
import { Pad, Ring } from "./boosts.ts";
import { Pit } from "./decoration.ts";
import { GravityPortal, ModePortal, SizePortal, SpeedPortal } from "./portals.ts";
import { Spike } from "./spike.ts";
import type { GameObject } from "./object.ts";
import type { LevelObject } from "../types.ts";

/**
 * Instantiate one authored object.
 *
 * Returns null for the two tags that are level STRUCTURE rather than things in
 * the world: `zone` sets per-column ground and ceiling, `end` sets the finish
 * line. Both are consumed by the world compiler before this runs.
 */
export function buildObject(o: LevelObject): GameObject | null {
  switch (o.t) {
    case "block":
      return new Block(o.x, o.y, o.w ?? 1, o.h ?? 1);
    case "spike":
      return new Spike(o.x, o.y, o.r ?? 0, o.hw, o.hh, o.gw ?? 1, o.gh ?? 1);
    case "pit":
      return new Pit(o.x, o.y);
    case "pad":
      return new Pad(o.x, o.y, o.c ?? "yellow");
    case "ring":
      return new Ring(o.x, o.y, o.c ?? "yellow");

    // Mode portals keep their bare tags so existing level files still parse.
    case "cube":
    case "ship":
    case "ball":
    case "ufo":
    case "wave":
      return new ModePortal(o.x, o.y, o.t);

    case "grav":
      return new GravityPortal(o.x, o.y, o.dir);
    case "size":
      return new SizePortal(o.x, o.y, o.s);
    case "speed":
      return new SpeedPortal(o.x, o.y, o.v);

    case "color":
      return new ColorTrigger(o.x, o.target, o.rgb, o.fade ?? 0);

    case "zone":
    case "end":
      return null;

    default: {
      // Exhaustiveness guard: if this stops compiling, a LevelObject variant
      // was added without a class to build it.
      const never: never = o;
      throw new Error(`Unhandled level object: ${JSON.stringify(never)}`);
    }
  }
}
