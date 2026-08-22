// The simulation: one fixed step of the whole game.
//
// This class mutates only itself, reads only the world and the input, and
// REPORTS side effects by pushing into `out` rather than calling audio,
// particles or React. That is what lets the entire game run headlessly under
// `node --test`, which is what makes replay tapes possible.
//
// The step is deliberately a fixed sequence of phases over typed object
// buckets, not a polymorphic walk over one list:
//
//   input -> integrate -> solids -> surfaces -> triggers -> hazards -> finish
//
// Each phase touches one category from world.ts. Adding a mechanic means adding
// a class to that category; the order of play stays stated in one readable
// place instead of being an emergent property of what objects happen to exist.

import { DEATH_FREEZE, TILE } from "./constants.ts";
import { overlaps } from "./core/aabb.ts";
import { VOID_DEPTH, hitsHazard, resolveSolids } from "./collision.ts";
import { integrate } from "./physics.ts";
import { Player } from "./player.ts";
import { Palette } from "./palette.ts";
import type { TouchContext } from "./objects/object.ts";
import type { World } from "./world.ts";
import type { InputState, SimEvent, SimStatus } from "./types.ts";

/**
 * A practice-mode respawn point.
 *
 * Everything the simulation needs to resume mid-level, which is more than a
 * position: dropping the player back at an x with zero velocity in the wrong
 * gamemode would be unrecoverable. Size and speed travel with it too — resuming
 * a mini high-speed section at normal size and 1x is just as unrecoverable, and
 * that is a bug this class shape makes impossible to forget.
 */
export class Checkpoint {
  readonly x: number;
  readonly y: number;
  readonly vy: number;
  readonly mode: Player["mode"];
  readonly gravitySign: 1 | -1;
  readonly sizeScale: number;
  readonly speedIndex: Player["speedIndex"];
  readonly onGround: boolean;
  readonly rot: number;

  private constructor(p: Player) {
    this.x = p.x;
    this.y = p.y;
    this.vy = p.vy;
    this.mode = p.mode;
    this.gravitySign = p.gravitySign;
    this.sizeScale = p.sizeScale;
    this.speedIndex = p.speedIndex;
    this.onGround = p.onGround;
    this.rot = p.rot;
  }

  static capture(p: Player): Checkpoint {
    return new Checkpoint(p);
  }

  applyTo(p: Player): void {
    p.x = this.x;
    p.y = this.y;
    p.vy = this.vy;
    p.mode = this.mode;
    p.gravitySign = this.gravitySign;
    p.sizeScale = this.sizeScale;
    p.speedIndex = this.speedIndex;
    p.onGround = this.onGround;
    p.rot = this.rot;
  }
}

export class Simulation {
  readonly player = new Player();
  /** Presentation state driven by the level's colour triggers. */
  readonly palette: Palette;
  /**
   * Coins taken on THIS attempt. Cleared on every restart, because a coin only
   * counts if you carry it to the end of the run — collecting all three across
   * three separate attempts is not the same achievement.
   */
  readonly coins = new Set<number>();
  status: SimStatus = "running";
  /** Seconds into this attempt. */
  t = 0;
  attempt = 1;
  /** Furthest x reached this attempt, for the progress percentage. */
  maxX = 0;
  deathTimer = 0;

  /** Per-trigger "was overlapping last step" bit. Flat array: no allocation at 240 Hz. */
  private readonly triggerTouch: Uint8Array;

  readonly world: World;

  constructor(world: World) {
    this.world = world;
    this.palette = new Palette(world.bgColor, world.groundColor);
    this.triggerTouch = new Uint8Array(world.triggerCount);
    this.seed();
  }

  private seed(): void {
    this.status = "running";
    this.t = 0;
    this.deathTimer = 0;
    this.triggerTouch.fill(0);
    this.palette.reset();
    this.coins.clear();
    this.player.resetTo(
      this.world.spawn.x,
      this.world.spawn.y,
      this.world.startMode,
      this.world.startSpeed,
    );
  }

  /** Restart from the beginning. Reuses every object, so a retry allocates nothing. */
  reset(): void {
    this.seed();
    this.maxX = 0;
    this.attempt += 1;
  }

  /**
   * Resume from a checkpoint instead of the start.
   *
   * maxX is deliberately NOT reset: progress is "furthest reached", and a
   * practice run that resumes at 40% has genuinely reached 40%.
   */
  restore(cp: Checkpoint): void {
    this.status = "running";
    this.t = 0;
    this.deathTimer = 0;
    // Portals behind the checkpoint must be able to fire again on the way back.
    this.triggerTouch.fill(0);
    cp.applyTo(this.player);
    this.attempt += 1;
    if (this.player.x > this.maxX) this.maxX = this.player.x;
  }

  /** Progress through the level, 0-100. Based on furthest reached, not current x. */
  progressPercent(): number {
    if (this.world.lengthPx <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.maxX / this.world.lengthPx) * 100)));
  }

  private die(out: SimEvent[], cause: "hazard" | "wall" | "void"): void {
    this.status = "dead";
    this.deathTimer = DEATH_FREEZE;
    out.push({ type: "death", x: this.player.x, y: this.player.y, cause });
  }

  step(input: InputState, dt: number, out: SimEvent[]): void {
    if (this.status !== "running") {
      // The simulation owns its own death clock, at the fixed rate. It used to
      // be drained here AND again by the frame loop with the real frame dt,
      // which ran the half-second freeze at roughly double speed.
      if (this.deathTimer > 0) this.deathTimer = Math.max(0, this.deathTimer - dt);
      return;
    }

    const p = this.player;
    const world = this.world;
    const hhBefore = p.halfH();
    const prevBottom = p.y - hhBefore;
    const prevTop = p.y + hhBefore;

    // Captured before applyInput, which clears the flag itself when the cube
    // jumps — so this is genuinely "was resting at the start of the step".
    const wasOnGround = p.onGround;

    // ── input and motion ────────────────────────────────────────────────────
    p.def.applyInput(p, input, dt, out);
    integrate(p, dt);
    this.t += dt;

    // Grounded is re-established from scratch every step by the surface checks
    // below. Leaving the previous value standing meant that walking off a ledge
    // kept the flag true for the entire fall — a free mid-air jump seconds
    // later, and a camera that dived with the player instead of holding its
    // anchor. Nothing ever cleared it except jumping.
    p.onGround = false;

    // ── solids ──────────────────────────────────────────────────────────────
    // Before hazards, deliberately. Landing on a block next to a spike lifts the
    // player out of the block, which may lift them clear of the spike too — and
    // erring toward survival is the whole design goal here.
    if (resolveSolids(p, world, prevBottom, prevTop) === "death") {
      return this.die(out, "wall");
    }

    // ── ground and ceiling ──────────────────────────────────────────────────
    // Scalars per column, so these are single comparisons. Which one is "the
    // floor" depends on gravity, which is what makes gravity portals work
    // without a second copy of this logic.
    const ground = world.groundAt(p.x);
    const ceiling = world.ceilingAt(p.x);
    const hh = p.halfH();
    const hasCeiling = Number.isFinite(ceiling);

    if (p.gravitySign === 1) {
      if (p.y - hh <= ground) {
        p.y = ground + hh;
        if (p.vy < 0) p.vy = 0;
        p.onGround = true;
      }
      if (hasCeiling && p.y + hh >= ceiling) {
        if (p.def.grounded) return this.die(out, "void");
        p.y = ceiling - hh;
        if (p.vy > 0) p.vy = 0;
      }
    } else {
      if (hasCeiling && p.y + hh >= ceiling) {
        p.y = ceiling - hh;
        if (p.vy > 0) p.vy = 0;
        p.onGround = true;
      }
      if (p.y - hh <= ground) {
        if (p.def.grounded) return this.die(out, "void");
        p.y = ground + hh;
        if (p.vy < 0) p.vy = 0;
      }
    }

    if (p.onGround && !wasOnGround) out.push({ type: "land" });

    // ── triggers ────────────────────────────────────────────────────────────
    // After movement, so a pad fires where the player actually ended up. Fired
    // on the rising edge only: a portal re-applied every step would fire dozens
    // of times crossing it.
    const ctx: TouchContext = {
      player: p,
      input,
      events: out,
      palette: this.palette,
      coins: this.coins,
    };
    const [lo, hi] = world.span(p.box());
    for (let gx = lo; gx <= hi; gx++) {
      const col = world.columns[gx];
      if (!col) continue;
      for (const trigger of col.triggers) {
        // Recomputed per trigger: a size portal changes the box mid-loop, and
        // the next trigger must be tested against the new one.
        if (!overlaps(p.box(), trigger.box)) {
          this.triggerTouch[trigger.id] = 0;
          continue;
        }
        if (this.triggerTouch[trigger.id]) continue;
        this.triggerTouch[trigger.id] = 1;
        trigger.onEnter(ctx);
      }
    }

    // ── hazards ─────────────────────────────────────────────────────────────
    if (hitsHazard(p, world)) return this.die(out, "hazard");

    // Fell out of the world, in whichever direction that currently means.
    const depth = p.gravitySign === 1 ? ground - (p.y + hh) : (p.y - hh) - ceiling;
    if (Number.isFinite(depth) && depth > VOID_DEPTH) return this.die(out, "void");

    // ── finish ──────────────────────────────────────────────────────────────
    if (p.x > this.maxX) this.maxX = p.x;
    if (p.x >= world.lengthPx) {
      this.status = "complete";
      out.push({ type: "complete", timeSec: this.t });
      return;
    }

    p.def.applyRotation(p, input, p.speed(), dt);
    this.palette.step(dt);
  }
}

/** Visual height of the player, for the renderer. */
export function playerSize(p: Player): { w: number; h: number } {
  return p.size();
}

export { TILE };
