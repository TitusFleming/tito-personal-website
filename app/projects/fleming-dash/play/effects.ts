// Death explosion.
//
// Presentation only, and deliberately outside the engine: it is driven by the
// `death` SimEvent the simulation already reports, so the physics has no idea
// it exists and a replay is unaffected by it.
//
// The particles are drawn in WORLD space inside the renderer's scaled
// transform, so the burst scales and scrolls with everything else rather than
// floating in screen space.

import { TILE } from "../engine/constants.ts";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  spin: number;
  rot: number;
};

const GRAVITY = -1400;
/** Matches DEATH_FREEZE, so the burst is finished exactly as the retry begins. */
const RING_LIFE = 0.42;

export class Effects {
  private particles: Particle[] = [];
  private rings: { x: number; y: number; life: number }[] = [];
  /**
   * Deterministic PRNG, seeded per burst.
   *
   * Math.random would make two runs of the same replay look different. Nothing
   * depends on that today, but an effect layer is exactly where such a
   * dependency creeps in unnoticed.
   */
  private seed = 1;

  private rand(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /** Blow the player apart at a world position. */
  burst(x: number, y: number, colors: readonly string[]): void {
    this.seed = Math.floor(Math.abs(x) * 31 + Math.abs(y) * 17) + 1;
    this.rings.push({ x, y, life: RING_LIFE });

    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2 + this.rand() * 0.35;
      const speed = 180 + this.rand() * 420;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed + 120,
        size: TILE * (0.12 + this.rand() * 0.22),
        life: 0.34 + this.rand() * 0.3,
        maxLife: 0.64,
        color: colors[Math.floor(this.rand() * colors.length)],
        spin: (this.rand() - 0.5) * 18,
        rot: this.rand() * Math.PI,
      });
    }
  }

  /** Drop everything immediately — used on respawn so a retry starts clean. */
  clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
  }

  get active(): boolean {
    return this.particles.length > 0 || this.rings.length > 0;
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      this.rings[i].life -= dt;
      if (this.rings[i].life <= 0) this.rings.splice(i, 1);
    }
  }

  /** `sx`/`sy` map world coordinates into the renderer's scaled space. */
  draw(
    ctx: CanvasRenderingContext2D,
    sx: (x: number) => number,
    sy: (y: number) => number,
  ): void {
    for (const r of this.rings) {
      const k = 1 - r.life / RING_LIFE;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = TILE * 0.16 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(sx(r.x), sy(r.y), TILE * (0.35 + k * 2.1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / (p.maxLife * 0.55)));
      ctx.translate(sx(p.x), sy(p.y));
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
  }
}
