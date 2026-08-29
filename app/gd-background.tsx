"use client";

import { useEffect, useRef } from "react";

/** Geometry-Dash-flavoured menu backdrop.
 *
 *  Every shape is drawn from canvas paths. Nothing is extracted from the game's
 *  files. The visual grammar copied is the obvious stuff: very heavy black
 *  outlines, flat two-tone fills, and the nested-square motif the default icons
 *  use in place of a face.
 */

const BODY_COLORS = ["#7ee63f", "#3ddc97", "#ffd23f", "#ff6b5b", "#c77dff", "#ff9f45"];
const ACCENT = "#5fe0f5";
const OUTLINE = "#0b1220";

const FORMS = ["cube", "ship", "ball", "ufo", "swing", "spider"] as const;
type Form = (typeof FORMS)[number];

type Icon = {
  x: number; y: number; vx: number; vy: number;
  size: number; angle: number; spin: number;
  color: string; form: Form; dead: number;
};
type Particle = {
  x: number; y: number; vx: number; vy: number;
  size: number; life: number; maxLife: number; color: string;
};
type Flash = { x: number; y: number; life: number };

/** Density comes from count, not speed: more icons drifting at a calm rate
 *  reads as a busy field, where fewer fast ones just read as twitchy. */
const ICON_COUNT = 7;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

export default function GdBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = motionQuery.matches;
    let width = 0;
    let height = 0;

    const icons: Icon[] = [];
    const particles: Particle[] = [];
    const flashes: Flash[] = [];

    function spawn(icon: Icon, fromEdge: boolean) {
      icon.size = rand(46, 82);
      icon.color = BODY_COLORS[Math.floor(rand(0, BODY_COLORS.length))];
      icon.form = FORMS[Math.floor(rand(0, FORMS.length))];
      icon.angle = rand(-0.3, 0.3);
      icon.spin = rand(-0.006, 0.006);
      icon.vx = rand(0.25, 0.85) * (Math.random() < 0.5 ? -1 : 1);
      icon.vy = rand(-0.16, 0.16);
      icon.dead = 0;
      if (fromEdge) {
        icon.x = icon.vx > 0 ? -icon.size : width + icon.size;
        icon.y = rand(icon.size, Math.max(icon.size + 1, height * 0.82));
      } else {
        icon.x = rand(width * 0.1, width * 0.9);
        icon.y = rand(height * 0.1, height * 0.75);
      }
    }

    function resize() {
      // Measure the wrapper, never the canvas: a canvas with no CSS size takes
      // its layout size from its attributes, so measuring it to set them feeds
      // back on itself and it grows without bound.
      const rect = wrap!.getBoundingClientRect();
      // The wrapper is position:fixed inset:0, so its size is the viewport by
      // definition. Falling back to that matters: if the element measures zero
      // when this first runs (a page that has not composited yet) and the
      // ResizeObserver never delivers a second callback, the icons would never
      // spawn and the backdrop would stay empty for good.
      width = rect.width || window.innerWidth;
      height = rect.height || window.innerHeight;
      if (width === 0 || height === 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (icons.length === 0) {
        for (let i = 0; i < ICON_COUNT; i += 1) {
          const icon = {} as Icon;
          spawn(icon, false);
          icons.push(icon);
        }
      }
    }

    // ── shapes ────────────────────────────────────────────────
    //
    // What the reference actually shows, and what the previous pass missed:
    // the outline is enormously thick relative to the icon; the body carries a
    // darker band across its lower half so it reads as lit from above; and the
    // "eye" is a dark square with a cyan square inside it, sunk into a raised
    // block rather than floating on the silhouette.

    function box(x: number, y: number, w: number, h: number, r: number) {
      const c = ctx!;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    /** Fill, shade the lower half, then outline. Doing the shade inside a clip
     *  of the same path is what keeps it from bleeding past the silhouette. */
    function plate(path: () => void, color: string, s: number, shadeFrom = 0.1) {
      const c = ctx!;
      c.save();
      path();
      c.fillStyle = color;
      c.fill();
      c.clip();
      c.fillStyle = "rgba(0, 0, 0, 0.18)";
      c.fillRect(-s, s * shadeFrom, s * 2, s * 2);
      c.restore();
      path();
      c.stroke();
    }

    /** Dark square, cyan square inside it. No face: this motif is what the
     *  default icons use instead, and it is most of what makes them readable. */
    function eye(cx: number, cy: number, s: number) {
      const c = ctx!;
      c.save();
      c.lineWidth = Math.max(2, s * 0.09);
      c.fillStyle = "#2f3b3f";
      box(cx - s * 0.5, cy - s * 0.5, s, s, s * 0.06);
      c.fill();
      c.stroke();
      c.fillStyle = ACCENT;
      box(cx - s * 0.24, cy - s * 0.24, s * 0.48, s * 0.48, s * 0.04);
      c.fill();
      c.restore();
    }

    /** Irregular spikes rather than an even star: the ball's outline is ragged,
     *  and an evenly-spaced star reads as a sheriff's badge instead. */
    const SPIKE_JITTER = [1, 0.86, 1.05, 0.9, 1, 0.82, 1.08, 0.88, 0.98, 0.84];
    function spikes(cx: number, cy: number, outer: number, inner: number) {
      const c = ctx!;
      const points = 10;
      c.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const jitter = SPIKE_JITTER[Math.floor(i / 2) % SPIKE_JITTER.length];
        const r = i % 2 === 0 ? outer * jitter : inner;
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      }
      c.closePath();
    }

    function drawForm(icon: Icon) {
      const c = ctx!;
      const s = icon.size;
      const h = s / 2;
      c.strokeStyle = OUTLINE;
      c.lineJoin = "round";
      c.lineCap = "round";
      // Very heavy: the single most characteristic thing about these icons.
      c.lineWidth = Math.max(3, s * 0.11);

      if (icon.form === "cube") {
        plate(() => box(-h, -h, s, s, s * 0.1), icon.color, s);
        eye(0, 0, s * 0.42);
      } else if (icon.form === "ball") {
        plate(() => spikes(0, 0, h, h * 0.52), icon.color, s);
        c.save();
        c.lineWidth = Math.max(2, s * 0.075);
        c.fillStyle = ACCENT;
        spikes(0, 0, h * 0.48, h * 0.22);
        c.fill();
        c.stroke();
        c.restore();
      } else if (icon.form === "ship") {
        // Flat segmented hull, raised block above it carrying the eye.
        plate(() => box(-h, h * 0.16, s, h * 0.58, h * 0.28), icon.color, s, 0.4);
        c.save();
        c.lineWidth = Math.max(2, s * 0.08);
        plate(() => box(-h * 0.98, h * 0.24, s * 0.3, h * 0.42, h * 0.14), ACCENT, s, 0.5);
        c.restore();
        plate(() => box(-h * 0.5, -h * 0.82, s * 0.62, h * 1, s * 0.09), icon.color, s, -0.4);
        eye(-h * 0.19, -h * 0.32, s * 0.34);
      } else if (icon.form === "ufo") {
        // Dome first so the saucer overlaps its base, as in the reference.
        c.save();
        c.lineWidth = Math.max(2, s * 0.07);
        c.fillStyle = "rgba(255, 255, 255, 0.34)";
        c.strokeStyle = "rgba(255, 255, 255, 0.75)";
        c.beginPath();
        c.arc(0, h * 0.05, h * 0.72, Math.PI, 0);
        c.fill();
        c.stroke();
        c.restore();
        plate(() => box(-h * 0.46, -h * 0.5, s * 0.46, h * 0.6, s * 0.07), icon.color, s, -0.2);
        eye(-h * 0.23, -h * 0.2, s * 0.3);
        plate(() => box(-h, h * 0.02, s, h * 0.4, h * 0.2), icon.color, s, 0.28);
        c.save();
        c.lineWidth = Math.max(2, s * 0.08);
        c.fillStyle = ACCENT;
        c.beginPath();
        c.arc(0, h * 0.32, h * 0.21, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
      } else if (icon.form === "swing") {
        plate(() => box(-h * 0.66, -h * 0.5, s * 0.66, s * 0.6, s * 0.1), icon.color, s, 0.15);
        eye(-h * 0.33, -h * 0.2, s * 0.3);
        c.save();
        c.lineWidth = Math.max(3, s * 0.1);
        c.beginPath();
        c.moveTo(-h * 1.02, -h * 0.72);
        c.lineTo(h * 0.62, -h * 0.72);
        c.stroke();
        c.restore();
        c.save();
        c.lineWidth = Math.max(2, s * 0.08);
        c.fillStyle = ACCENT;
        c.beginPath();
        c.arc(-h * 0.18, h * 0.56, h * 0.2, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
      } else {
        // spider: angular legs under a blocky head
        c.save();
        c.lineWidth = Math.max(3, s * 0.1);
        c.strokeStyle = OUTLINE;
        for (const dir of [-1, 1]) {
          for (const spread of [0.36, 0.86]) {
            c.beginPath();
            c.moveTo(dir * h * 0.28, h * 0.1);
            c.lineTo(dir * h * spread, h * 0.6);
            c.lineTo(dir * h * (spread + 0.14), h * 1);
            c.stroke();
          }
        }
        c.restore();
        plate(() => box(-h * 0.82, -h * 0.72, s * 0.82, s * 0.78, s * 0.1), icon.color, s, 0.05);
        eye(-h * 0.41, -h * 0.33, s * 0.34);
      }
    }

    function burst(icon: Icon) {
      for (let i = 0; i < 26; i += 1) {
        const a = (i / 26) * Math.PI * 2 + rand(-0.22, 0.22);
        const sp = rand(1.8, 6.4);
        particles.push({
          x: icon.x, y: icon.y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          size: rand(3, icon.size * 0.2),
          life: 1, maxLife: rand(26, 54),
          color: Math.random() < 0.3 ? "#ffffff" : icon.color,
        });
      }
      flashes.push({ x: icon.x, y: icon.y, life: 0 });
    }

    function popAtPoint(px: number, py: number) {
      for (const icon of icons) {
        if (icon.dead > 0) continue;
        const h = icon.size / 2 + 10;
        if (Math.abs(px - icon.x) <= h && Math.abs(py - icon.y) <= h) {
          burst(icon);
          icon.dead = Math.round(rand(40, 90));
          return true;
        }
      }
      return false;
    }

    /** Listen on the window, not the canvas. The page's layout wrapper is a
     *  transparent element stretched over most of the viewport, so it, not the
     *  canvas, is what a real click actually lands on; a canvas-bound listener
     *  never fires for icons drifting inside that column. Clicks on genuine
     *  controls are skipped so popping never steals a menu press. */
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a, button, input, [role='button']")) return;
      const rect = canvas!.getBoundingClientRect();
      popAtPoint(event.clientX - rect.left, event.clientY - rect.top);
    }

    let frame = 0;
    function tick() {
      frame = requestAnimationFrame(tick);
      if (icons.length === 0) resize();
      ctx!.clearRect(0, 0, width, height);

      for (const icon of icons) {
        if (icon.dead > 0) {
          icon.dead -= 1;
          if (icon.dead === 0) spawn(icon, true);
          continue;
        }
        if (!reduced) {
          icon.x += icon.vx; icon.y += icon.vy; icon.angle += icon.spin;
        }
        const pad = icon.size;
        if (icon.x < -pad || icon.x > width + pad || icon.y < -pad || icon.y > height + pad) {
          spawn(icon, true);
        }
        ctx!.save();
        ctx!.translate(icon.x, icon.y);
        ctx!.rotate(icon.angle);
        drawForm(icon);
        ctx!.restore();
      }

      for (let i = flashes.length - 1; i >= 0; i -= 1) {
        const f = flashes[i];
        f.life += 1;
        if (f.life > 16) { flashes.splice(i, 1); continue; }
        const t = f.life / 16;
        ctx!.save();
        ctx!.globalAlpha = (1 - t) * 0.85;
        ctx!.strokeStyle = "#ffffff";
        ctx!.lineWidth = 5 * (1 - t) + 1;
        ctx!.beginPath();
        ctx!.arc(f.x, f.y, 10 + t * 62, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.restore();
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += 1;
        if (p.life > p.maxLife) { particles.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.vx *= 0.985;
        ctx!.save();
        ctx!.globalAlpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx!.fillStyle = p.color;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.life * 0.16);
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx!.restore();
      }
    }

    const onMotionChange = (e: MediaQueryListEvent) => { reduced = e.matches; };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();
    window.addEventListener("pointerdown", handlePointerDown);
    motionQuery.addEventListener("change", onMotionChange);
    frame = requestAnimationFrame(tick);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __gd?: unknown }).__gd = {
        icons, particles, flashes, FORMS,
        step: (n = 1) => {
          for (let i = 0; i < n; i += 1) {
            cancelAnimationFrame(frame);
            tick();
          }
          cancelAnimationFrame(frame);
        },
        popAt: (x: number, y: number) => popAtPoint(x, y),
      };
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("pointerdown", handlePointerDown);
      motionQuery.removeEventListener("change", onMotionChange);
      if (process.env.NODE_ENV !== "production") {
        delete (window as unknown as { __gd?: unknown }).__gd;
      }
    };
  }, []);

  return (
    <div className="gd-bg" aria-hidden="true" ref={wrapRef}>
      <div className="gd-streaks" />
      <div className="gd-vignette" />
      <canvas className="gd-canvas" ref={canvasRef} />
      <div className="gd-ground">
        <div className="gd-ground-streaks" />
      </div>
    </div>
  );
}
