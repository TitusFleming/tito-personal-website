// The Phlem.io simulation: one arena, one player, twenty ghosts of the AREDL.
//
// Headless and deterministic: no canvas, no DOM, one seeded random stream.
// The UI drives it with step() and reads state back; side effects are
// reported as events, never performed. Same shape as the Fleming Dash
// engine, for the same reason — everything interesting is testable under
// node --test.

import {
  BIG_QUIT_MASS,
  BIG_QUIT_MAX_S,
  BIG_QUIT_MIN_S,
  BOT_COUNT,
  BOT_DEATHS_MAX,
  BOT_DEATHS_MIN,
  DECAY_MIN_MASS,
  DECAY_PER_S,
  EAT_DEPTH_FRAC,
  EAT_MASS_RATIO,
  MAX_PIECES,
  MIN_SPLIT_MASS,
  PELLET_MASS,
  PELLET_RESPAWN_PER_S,
  PELLET_TARGET,
  RECOMBINE_BASE_S,
  RECOMBINE_PER_MASS_S,
  RESPAWN_DELAY_S,
  SPEED_COEF,
  SPEED_EXP,
  SPLIT_FRICTION,
  SPLIT_LAUNCH,
  START_MASS,
  VIRUS_COUNT,
  VIRUS_MAX_MASS,
  VIRUS_MIN_MASS,
  VIRUS_POP_SHARDS,
  WORLD_SIZE,
  clamp,
  radiusOf,
} from "./constants.ts";
import { mulberry32, range, rangeInt, type Rng } from "./rng.ts";
import { thinkBot, makePersona, type Persona } from "./bots.ts";
import NAMES from "./names.json" with { type: "json" };

export type Piece = {
  x: number;
  y: number;
  mass: number;
  /** Split-launch impulse, decays exponentially. */
  ix: number;
  iy: number;
  /** Seconds until this piece may recombine with a sibling. */
  cooldown: number;
};

export type Actor = {
  readonly id: number;
  name: string;
  /** 0-360. Every player gets a random colour; bots too. */
  hue: number;
  readonly isPlayer: boolean;
  /** Empty while dead or waiting to respawn. */
  pieces: Piece[];
  /** Seconds until a dead actor rejoins; 0 when alive or gone for good. */
  respawnIn: number;
  /** Full deaths this identity has left before it leaves the lobby. */
  deathsLeft: number;
  /** Seconds spent over BIG_QUIT_MASS, and this identity's own quit fuse. */
  bigFor: number;
  quitAfter: number;
  persona: Persona;
  // Steering state, written by the bot brain (or the player's input).
  aimX: number;
  aimY: number;
  wantSplit: boolean;
  thinkIn: number;
};

export type Pellet = { x: number; y: number; hue: number };
export type Virus = { x: number; y: number; mass: number };

export type PhlemEvent =
  | { type: "join"; name: string }
  | { type: "leave"; name: string; reason: "eaten-out" | "rich-quit" }
  | { type: "player-eaten"; by: string; mass: number }
  | { type: "ate-actor"; name: string; by: string };

export type PlayerInput = {
  /** World-space point the player steers toward. */
  aimX: number;
  aimY: number;
  /** Press edge: split once per press. */
  split: boolean;
};

export const totalMass = (a: Actor): number =>
  a.pieces.reduce((n, p) => n + p.mass, 0);

export const speedOf = (mass: number): number =>
  SPEED_COEF / Math.pow(radiusOf(mass), SPEED_EXP);

/** Vanilla-style recombine clock: base plus 2.33% of the piece's mass. */
export const recombineTime = (mass: number): number =>
  RECOMBINE_BASE_S + RECOMBINE_PER_MASS_S * mass;

/** Ogar's eat test: 25% mass advantage AND the centre swallowed deep enough. */
export function canEat(predMass: number, preyMass: number, dist: number): boolean {
  if (predMass < preyMass * EAT_MASS_RATIO) return false;
  return dist < radiusOf(predMass) - radiusOf(preyMass) * EAT_DEPTH_FRAC;
}

export class PhlemSim {
  readonly rng: Rng;
  readonly actors: Actor[] = [];
  pellets: Pellet[] = [];
  viruses: Virus[] = [];
  readonly events: PhlemEvent[] = [];
  t = 0;

  private nextId = 1;
  private pelletDebt = 0;
  /** Names currently on an actor, so a joiner can never duplicate one. */
  private readonly activeNames = new Set<string>();
  private readonly namePool: string[];
  private poolIndex = 0;

  readonly player: Actor;

  constructor(seed: number, playerName: string, playerHue?: number) {
    this.rng = mulberry32(seed);

    // The bot name pool is the AREDL, shuffled once per session so every
    // game meets a different crowd. 1,602 names for ~20 seats.
    this.namePool = [...(NAMES as string[])];
    for (let i = this.namePool.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.namePool[i], this.namePool[j]] = [this.namePool[j], this.namePool[i]];
    }

    this.player = this.makeActor(playerName || "An unnamed blob", true);
    if (playerHue !== undefined) this.player.hue = playerHue;
    this.actors.push(this.player);
    this.spawnActor(this.player);

    for (let i = 0; i < BOT_COUNT; i++) {
      const bot = this.makeActor(this.drawName(), false);
      this.actors.push(bot);
      this.spawnActor(bot);
    }

    for (let i = 0; i < PELLET_TARGET; i++) this.pellets.push(this.makePellet());
    for (let i = 0; i < VIRUS_COUNT; i++) this.viruses.push(this.makeVirus());
  }

  private drawName(): string {
    // Walk the shuffled pool; skip anything currently in the lobby. The pool
    // wraps, which matters only in sessions long enough to burn 1,600 names.
    for (let hops = 0; hops < this.namePool.length; hops++) {
      const name = this.namePool[this.poolIndex];
      this.poolIndex = (this.poolIndex + 1) % this.namePool.length;
      if (!this.activeNames.has(name)) {
        this.activeNames.add(name);
        return name;
      }
    }
    return `Blob ${this.nextId}`; // unreachable with a sane pool
  }

  private makeActor(name: string, isPlayer: boolean): Actor {
    return {
      id: this.nextId++,
      name,
      hue: Math.floor(this.rng() * 360),
      isPlayer,
      pieces: [],
      respawnIn: 0,
      deathsLeft: rangeInt(this.rng, BOT_DEATHS_MIN, BOT_DEATHS_MAX),
      bigFor: 0,
      quitAfter: range(this.rng, BIG_QUIT_MIN_S, BIG_QUIT_MAX_S),
      persona: makePersona(this.rng),
      aimX: 0,
      aimY: 0,
      wantSplit: false,
      thinkIn: 0,
    };
  }

  private makePellet(): Pellet {
    return {
      x: this.rng() * WORLD_SIZE,
      y: this.rng() * WORLD_SIZE,
      hue: Math.floor(this.rng() * 360),
    };
  }

  private makeVirus(): Virus {
    return {
      x: range(this.rng, WORLD_SIZE * 0.05, WORLD_SIZE * 0.95),
      y: range(this.rng, WORLD_SIZE * 0.05, WORLD_SIZE * 0.95),
      mass: range(this.rng, VIRUS_MIN_MASS, VIRUS_MAX_MASS),
    };
  }

  /** Place a fresh start-mass piece somewhere not instantly fatal. */
  private spawnActor(a: Actor): void {
    let best = { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2 };
    let bestDist = -1;
    // A handful of samples, keep the one furthest from any piece that could
    // eat a spawner. Cheap, and reads like the real game's "usually safe".
    for (let i = 0; i < 12; i++) {
      const x = range(this.rng, 100, WORLD_SIZE - 100);
      const y = range(this.rng, 100, WORLD_SIZE - 100);
      let nearest = Infinity;
      for (const other of this.actors) {
        for (const p of other.pieces) {
          if (p.mass < START_MASS * EAT_MASS_RATIO) continue;
          const d = Math.hypot(p.x - x, p.y - y) - radiusOf(p.mass);
          if (d < nearest) nearest = d;
        }
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        best = { x, y };
      }
    }
    a.pieces = [{ x: best.x, y: best.y, mass: START_MASS, ix: 0, iy: 0, cooldown: 0 }];
    a.aimX = best.x;
    a.aimY = best.y;
    a.bigFor = 0;
  }

  /** Restart the player after being eaten. Same name, same colour. */
  respawnPlayer(): void {
    if (this.player.pieces.length === 0) this.spawnActor(this.player);
  }

  step(dt: number, input: PlayerInput): void {
    this.t += dt;

    // ── decide ──────────────────────────────────────────────────────────
    this.player.aimX = input.aimX;
    this.player.aimY = input.aimY;
    this.player.wantSplit = input.split;
    for (const a of this.actors) {
      if (a.isPlayer || a.pieces.length === 0) continue;
      a.thinkIn -= dt;
      if (a.thinkIn <= 0) thinkBot(a, this);
    }

    // ── move ────────────────────────────────────────────────────────────
    for (const a of this.actors) {
      for (const p of a.pieces) {
        const dx = a.aimX - p.x;
        const dy = a.aimY - p.y;
        const d = Math.hypot(dx, dy);
        // Ease to a stop over the last radius rather than jittering on the
        // target point, which is how the original client feels.
        const v = speedOf(p.mass) * clamp(d / radiusOf(p.mass), 0, 1);
        if (d > 1e-6) {
          p.x += (dx / d) * v * dt;
          p.y += (dy / d) * v * dt;
        }
        p.x += p.ix * dt;
        p.y += p.iy * dt;
        const f = Math.exp(-SPLIT_FRICTION * dt);
        p.ix *= f;
        p.iy *= f;
        p.cooldown = Math.max(0, p.cooldown - dt);
        p.x = clamp(p.x, 0, WORLD_SIZE);
        p.y = clamp(p.y, 0, WORLD_SIZE);
      }
      this.settleSiblings(a);
    }

    // ── split intents ───────────────────────────────────────────────────
    for (const a of this.actors) {
      if (a.wantSplit) {
        a.wantSplit = false;
        this.split(a);
      }
    }

    // ── eat ─────────────────────────────────────────────────────────────
    this.eatPellets();
    this.eatViruses();
    this.eatActors();

    // ── decay ───────────────────────────────────────────────────────────
    for (const a of this.actors) {
      for (const p of a.pieces) {
        if (p.mass > DECAY_MIN_MASS) p.mass -= p.mass * DECAY_PER_S * dt;
      }
    }

    // ── restock pellets ─────────────────────────────────────────────────
    if (this.pellets.length < PELLET_TARGET) {
      this.pelletDebt += PELLET_RESPAWN_PER_S * dt;
      while (this.pelletDebt >= 1 && this.pellets.length < PELLET_TARGET) {
        this.pellets.push(this.makePellet());
        this.pelletDebt -= 1;
      }
    }

    this.lifecycle(dt);
  }

  /** Same-owner pieces: solid against each other until both may merge. */
  private settleSiblings(a: Actor): void {
    const ps = a.pieces;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const A = ps[i];
        const B = ps[j];
        const d = Math.hypot(B.x - A.x, B.y - A.y);
        const rA = radiusOf(A.mass);
        const rB = radiusOf(B.mass);

        if (A.cooldown <= 0 && B.cooldown <= 0) {
          // Merge once the smaller centre is inside the bigger piece.
          if (d < Math.max(rA, rB)) {
            const [big, small] = A.mass >= B.mass ? [A, B] : [B, A];
            big.mass += small.mass;
            ps.splice(ps.indexOf(small), 1);
            j--;
          }
          continue;
        }

        // Rigid separation while on cooldown, half the push each way.
        const overlap = rA + rB - d;
        if (overlap > 0 && d > 1e-6) {
          const nx = (B.x - A.x) / d;
          const ny = (B.y - A.y) / d;
          A.x -= (nx * overlap) / 2;
          A.y -= (ny * overlap) / 2;
          B.x += (nx * overlap) / 2;
          B.y += (ny * overlap) / 2;
        }
      }
    }
  }

  /** Split every eligible piece toward the aim, as the original does. */
  private split(a: Actor): void {
    const candidates = [...a.pieces].sort((x, y) => y.mass - x.mass);
    for (const p of candidates) {
      if (a.pieces.length >= MAX_PIECES) return;
      if (p.mass < MIN_SPLIT_MASS) continue;
      const dx = a.aimX - p.x;
      const dy = a.aimY - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.mass /= 2;
      p.cooldown = recombineTime(p.mass);
      a.pieces.push({
        x: p.x,
        y: p.y,
        mass: p.mass,
        ix: (dx / d) * SPLIT_LAUNCH,
        iy: (dy / d) * SPLIT_LAUNCH,
        cooldown: recombineTime(p.mass),
      });
    }
  }

  private eatPellets(): void {
    // Pellet field is static between eats, so a coarse grid beats N*M.
    const CELL = 200;
    const grid = new Map<number, number[]>();
    const key = (cx: number, cy: number) => cx * 4096 + cy;
    this.pellets.forEach((pe, idx) => {
      const k = key(Math.floor(pe.x / CELL), Math.floor(pe.y / CELL));
      const bucket = grid.get(k);
      if (bucket) bucket.push(idx);
      else grid.set(k, [idx]);
    });

    const gone = new Set<number>();
    for (const a of this.actors) {
      for (const p of a.pieces) {
        const r = radiusOf(p.mass);
        const lo = { cx: Math.floor((p.x - r) / CELL), cy: Math.floor((p.y - r) / CELL) };
        const hi = { cx: Math.floor((p.x + r) / CELL), cy: Math.floor((p.y + r) / CELL) };
        for (let cx = lo.cx; cx <= hi.cx; cx++) {
          for (let cy = lo.cy; cy <= hi.cy; cy++) {
            for (const idx of grid.get(key(cx, cy)) ?? []) {
              if (gone.has(idx)) continue;
              const pe = this.pellets[idx];
              if (Math.hypot(pe.x - p.x, pe.y - p.y) < r) {
                gone.add(idx);
                p.mass += PELLET_MASS;
              }
            }
          }
        }
      }
    }
    if (gone.size > 0) this.pellets = this.pellets.filter((_, i) => !gone.has(i));
  }

  private eatViruses(): void {
    for (let vi = this.viruses.length - 1; vi >= 0; vi--) {
      const v = this.viruses[vi];
      for (const a of this.actors) {
        let popped = false;
        for (const p of a.pieces) {
          const d = Math.hypot(v.x - p.x, v.y - p.y);
          if (!canEat(p.mass, v.mass, d)) continue;
          p.mass += v.mass;
          this.pop(a, p);
          this.viruses.splice(vi, 1);
          this.viruses.push(this.makeVirus());
          popped = true;
          break;
        }
        if (popped) break;
      }
    }
  }

  /** Burst a piece into shards, respecting the 16-piece cap. */
  private pop(a: Actor, p: Piece): void {
    const room = MAX_PIECES - a.pieces.length;
    const shards = Math.min(VIRUS_POP_SHARDS, room);
    if (shards <= 0) return;
    const each = p.mass / (shards + 1);
    p.mass = each;
    p.cooldown = recombineTime(each);
    for (let i = 0; i < shards; i++) {
      const ang = (i / shards) * Math.PI * 2 + this.rng() * 0.5;
      a.pieces.push({
        x: p.x,
        y: p.y,
        mass: each,
        ix: Math.cos(ang) * SPLIT_LAUNCH * 0.8,
        iy: Math.sin(ang) * SPLIT_LAUNCH * 0.8,
        cooldown: recombineTime(each),
      });
    }
  }

  private eatActors(): void {
    for (const pred of this.actors) {
      for (const prey of this.actors) {
        if (pred === prey) continue;
        for (const pp of pred.pieces) {
          for (let i = prey.pieces.length - 1; i >= 0; i--) {
            const q = prey.pieces[i];
            const d = Math.hypot(q.x - pp.x, q.y - pp.y);
            if (!canEat(pp.mass, q.mass, d)) continue;
            pp.mass += q.mass;
            prey.pieces.splice(i, 1);
            if (prey.pieces.length === 0) this.onFullyEaten(prey, pred);
          }
        }
      }
    }
  }

  private onFullyEaten(prey: Actor, pred: Actor): void {
    if (prey.isPlayer) {
      this.events.push({ type: "player-eaten", by: pred.name, mass: 0 });
      return; // the UI decides when to respawn the player
    }
    this.events.push({ type: "ate-actor", name: prey.name, by: pred.name });
    prey.deathsLeft -= 1;
    if (prey.deathsLeft <= 0) {
      this.replaceBot(prey, "eaten-out");
    } else {
      prey.respawnIn = RESPAWN_DELAY_S;
    }
  }

  /** This identity leaves; a new demon joins in the same seat. */
  private replaceBot(bot: Actor, reason: "eaten-out" | "rich-quit"): void {
    this.events.push({ type: "leave", name: bot.name, reason });
    this.activeNames.delete(bot.name);
    bot.name = this.drawName();
    bot.hue = Math.floor(this.rng() * 360);
    bot.deathsLeft = rangeInt(this.rng, BOT_DEATHS_MIN, BOT_DEATHS_MAX);
    bot.quitAfter = range(this.rng, BIG_QUIT_MIN_S, BIG_QUIT_MAX_S);
    bot.persona = makePersona(this.rng);
    bot.pieces = [];
    bot.respawnIn = RESPAWN_DELAY_S + range(this.rng, 0.5, 2.5);
    this.events.push({ type: "join", name: bot.name });
  }

  private lifecycle(dt: number): void {
    for (const a of this.actors) {
      if (a.isPlayer) continue;

      if (a.pieces.length === 0) {
        a.respawnIn -= dt;
        if (a.respawnIn <= 0) this.spawnActor(a);
        continue;
      }

      // Rich players quit: nothing on this map can eat them any more, and
      // that is exactly when a real lobby's top player logs off.
      if (totalMass(a) >= BIG_QUIT_MASS) {
        a.bigFor += dt;
        if (a.bigFor >= a.quitAfter) this.replaceBot(a, "rich-quit");
      } else {
        a.bigFor = Math.max(0, a.bigFor - dt);
      }
    }
  }

  /** Drain events for the UI feed. */
  takeEvents(): PhlemEvent[] {
    return this.events.splice(0, this.events.length);
  }
}
