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

/** How many icons drift at once. Raised from two — the backdrop should read
 *  as busy, closer to the game's own menu, while everything else about each
 *  icon (size, speed, forms, popping) stays exactly as it was. */
const ICON_COUNT = 6;
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
      icon.spin = rand(-0.008, 0.008);
      icon.vx = rand(0.5, 1.1) * (Math.random() < 0.5 ? -1 : 1);
      icon.vy = rand(-0.2, 0.2);
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
      if (rect.width === 0 || rect.height === 0) return;
      width = rect.width;
      height = rect.height;
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

    /** The default icons have no face. They have a square inside a square
     *  inside a square, and that motif is most of what makes them readable. */
    function nested(cx: number, cy: number, s: number) {
      const c = ctx!;
      c.fillStyle = OUTLINE;
      c.fillRect(cx - s * 0.3, cy - s * 0.3, s * 0.6, s * 0.6);
      c.fillStyle = ACCENT;
      c.fillRect(cx - s * 0.16, cy - s * 0.16, s * 0.32, s * 0.32);
    }

    function star(cx: number, cy: number, outer: number, inner: number, points: number) {
      const c = ctx!;
      c.beginPath();
      for (let i = 0; i < points * 2; i += 1) {
        const r = i % 2 === 0 ? outer : inner;
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
      // Heavy outline: the single most characteristic thing about these icons.
      c.lineWidth = Math.max(3, s * 0.1);
      c.fillStyle = icon.color;

      if (icon.form === "cube") {
        box(-h, -h, s, s, s * 0.1);
        c.fill(); c.stroke();
        nested(0, 0, s * 0.62);
      } else if (icon.form === "ball") {
        star(0, 0, h, h * 0.62, 8);
        c.fill(); c.stroke();
        c.fillStyle = ACCENT;
        star(0, 0, h * 0.5, h * 0.26, 8);
        c.fill(); c.stroke();
      } else if (icon.form === "ship") {
        // Hull along the bottom, cockpit block above it.
        box(-h, h * 0.1, s, h * 0.62, s * 0.1);
        c.fill(); c.stroke();
        c.fillStyle = ACCENT;
        box(-h * 0.95, h * 0.22, s * 0.34, h * 0.4, s * 0.06);
        c.fill(); c.stroke();
        c.fillStyle = icon.color;
        box(-h * 0.42, -h * 0.85, s * 0.6, h * 0.95, s * 0.08);
        c.fill(); c.stroke();
        nested(-h * 0.12, -h * 0.36, s * 0.4);
      } else if (icon.form === "ufo") {
        // Dome, then the saucer across the middle.
        c.fillStyle = ACCENT;
        c.beginPath(); c.arc(0, 0, h * 0.66, Math.PI, 0);
        c.fill(); c.stroke();
        c.fillStyle = icon.color;
        box(-h, -h * 0.02, s, h * 0.44, h * 0.2);
        c.fill(); c.stroke();
        nested(0, -h * 0.3, s * 0.4);
        c.fillStyle = ACCENT;
        c.beginPath(); c.arc(0, h * 0.2, h * 0.19, 0, Math.PI * 2);
        c.fill(); c.stroke();
      } else if (icon.form === "swing") {
        box(-h * 0.62, -h * 0.55, s * 0.62, s * 0.62, s * 0.1);
        c.fill(); c.stroke();
        c.lineWidth = Math.max(3, s * 0.085);
        c.beginPath();
        c.moveTo(-h * 0.98, -h * 0.78); c.lineTo(h * 0.58, -h * 0.78);
        c.stroke();
        c.fillStyle = ACCENT;
        c.beginPath(); c.arc(-h * 0.2, h * 0.62, h * 0.2, 0, Math.PI * 2);
        c.fill(); c.stroke();
        nested(-h * 0.3, -h * 0.24, s * 0.36);
      } else {
        // spider: squat body, angular legs
        c.lineWidth = Math.max(3, s * 0.085);
        for (const dx of [-h * 0.82, -h * 0.3, h * 0.3, h * 0.82]) {
          c.beginPath();
          c.moveTo(dx * 0.62, h * 0.05);
          c.lineTo(dx, h * 0.55);
          c.lineTo(dx * 1.05, h * 0.95);
          c.stroke();
        }
        c.lineWidth = Math.max(3, s * 0.1);
        box(-h * 0.8, -h * 0.7, s * 0.8, s * 0.72, s * 0.12);
        c.fill(); c.stroke();
        nested(-h * 0.4, -h * 0.34, s * 0.44);
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
     *  transparent element stretched over most of the viewport, so it — not the
     *  canvas — is what a real click actually lands on; a canvas-bound listener
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
        step: (n = 1) => { for (let i = 0; i < n; i += 1) tick(); cancelAnimationFrame(frame); },
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
