// The level's current colours.
//
// Lives in the simulation rather than the renderer for two reasons: it is
// driven by trigger objects like everything else in the world, and keeping it
// here makes it deterministic — the same inputs produce the same colours, so a
// replay looks the way it played. It touches no physics, so it can never change
// an outcome.

import type { Rgb } from "./types.ts";

type Fade = { from: Rgb; to: Rgb; t: number; dur: number };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Palette {
  bg: Rgb;
  ground: Rgb;
  private readonly base: { bg: Rgb; ground: Rgb };
  private fades: { bg: Fade | null; ground: Fade | null } = { bg: null, ground: null };

  constructor(bg: Rgb, ground: Rgb) {
    this.base = { bg: [...bg] as Rgb, ground: [...ground] as Rgb };
    this.bg = [...bg] as Rgb;
    this.ground = [...ground] as Rgb;
  }

  /** Back to the level's header colours. Called on every restart. */
  reset(): void {
    this.bg = [...this.base.bg] as Rgb;
    this.ground = [...this.base.ground] as Rgb;
    this.fades = { bg: null, ground: null };
  }

  fadeTo(target: "bg" | "ground", rgb: Rgb, seconds: number): void {
    if (seconds <= 0) {
      this[target] = [...rgb] as Rgb;
      this.fades[target] = null;
      return;
    }
    this.fades[target] = { from: [...this[target]] as Rgb, to: [...rgb] as Rgb, t: 0, dur: seconds };
  }

  step(dt: number): void {
    for (const key of ["bg", "ground"] as const) {
      const f = this.fades[key];
      if (!f) continue;
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      this[key] = [0, 1, 2].map((i) => Math.round(lerp(f.from[i], f.to[i], k))) as Rgb;
      if (k >= 1) this.fades[key] = null;
    }
  }

  /** CSS colour, optionally lightened or darkened. `shade` of 1 is unchanged. */
  css(which: "bg" | "ground", shade = 1): string {
    const [r, g, b] = this[which];
    const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * shade)));
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
  }

  /**
   * The same colour, guaranteed to be light enough to see against.
   *
   * A multiplicative shade cannot lift pure black: Clubstep's header sets both
   * background and ground to [0, 0, 0], so `css("ground", 1.15)` returned black
   * and the ground band vanished into a level whose blocks and spikes are also
   * near-black. Only the outlines were visible.
   *
   * Adding a floor rather than clamping the whole palette keeps a level's own
   * colours wherever they are already visible, and only intervenes where the
   * level would otherwise render as an unreadable void.
   */
  cssAtLeast(which: "bg" | "ground", floor: number, shade = 1): string {
    const [r, g, b] = this[which].map((v) => Math.max(0, Math.min(255, v * shade)));
    const lift = Math.max(0, floor - Math.max(r, g, b));
    const c = (v: number) => Math.round(Math.min(255, v + lift));
    return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
  }
}
