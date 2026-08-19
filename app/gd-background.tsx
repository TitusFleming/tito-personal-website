"use client";

import { useEffect, useRef } from "react";

/** Geometry-Dash-flavoured menu backdrop.
 *
 *  Every shape here is drawn with canvas paths — nothing is extracted from the
 *  game's files. The forms (cube, ship, ball, UFO, swing, spider) and the death
 *  spray are rendered from scratch in the site's own colours. Credited on the
 *  page; see the "special thanks" line.
 *
 *  Only one or two icons are alive at once, so the backdrop stays quiet enough
 *  to read the menu over.
 */

const ICON_COLORS = ["#3ddc97", "#ffd23f", "#ff6b5b", "#4fc3ff", "#c77dff", "#ff9f45"];
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

type Flash = { x: number; y: number; life: number; color: string };

/** Two on screen at most — the backdrop sits behind a menu, not a level. */
const ICON_COUNT = 2;
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
      icon.size = rand(38, 74);
      icon.color = ICON_COLORS[Math.floor(rand(0, ICON_COLORS.length))];
      icon.form = FORMS[Math.floor(rand(0, FORMS.length))];
      icon.angle = rand(-0.4, 0.4);
      icon.spin = rand(-0.01, 0.01);
      icon.vx = rand(0.5, 1.15) * (Math.random() < 0.5 ? -1 : 1);
      icon.vy = rand(-0.22, 0.22);
      icon.dead = 0;
      if (fromEdge) {
        icon.x = icon.vx > 0 ? -icon.size : width + icon.size;
        icon.y = rand(icon.size, Math.max(icon.size + 1, height * 0.8));
      } else {
        icon.x = rand(width * 0.15, width * 0.85);
        icon.y = rand(height * 0.15, height * 0.7);
      }
    }

    function resize() {
      // Measure the WRAPPER, never the canvas: a canvas with no CSS size takes
      // its layout size from its attributes, so measuring it to set them feeds
      // back on itself and the element grows without bound.
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

    // ── form drawing ──────────────────────────────────────────
    const OUTLINE = "rgba(6, 20, 44, 0.85)";
    const FACE = "rgba(6, 20, 44, 0.82)";

    function rounded(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function face(c: CanvasRenderingContext2D, s: number, cy = 0) {
      c.fillStyle = FACE;
      const e = s * 0.13;
      c.fillRect(-s * 0.22, cy - e * 0.6, e, e * 1.4);
      c.fillRect(s * 0.09, cy - e * 0.6, e, e * 1.4);
      c.fillRect(-s * 0.15, cy + e * 1.2, s * 0.3, e * 0.55);
    }

    function drawForm(icon: Icon) {
      const c = ctx!;
      const s = icon.size;
      const h = s / 2;
      c.fillStyle = icon.color;
      c.strokeStyle = OUTLINE;
      c.lineWidth = Math.max(2.5, s * 0.075);

      if (icon.form === "cube") {
        rounded(c, -h, -h, s, s, s * 0.16);
        c.fill(); c.stroke();
        face(c, s);
      } else if (icon.form === "ball") {
        c.beginPath(); c.arc(0, 0, h, 0, Math.PI * 2);
        c.fill(); c.stroke();
        c.beginPath(); c.arc(0, 0, h * 0.62, 0, Math.PI * 2); c.stroke();
        face(c, s);
      } else if (icon.form === "ship") {
        // Wedge with a cockpit dome.
        c.beginPath();
        c.moveTo(h, 0); c.lineTo(-h * 0.6, h * 0.55);
        c.lineTo(-h, h * 0.1); c.lineTo(-h * 0.6, -h * 0.5);
        c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.arc(-h * 0.05, -h * 0.1, h * 0.34, Math.PI, 0);
        c.fill(); c.stroke();
        face(c, s * 0.7, -h * 0.25);
      } else if (icon.form === "ufo") {
        // Dome over a wide saucer.
        c.beginPath(); c.arc(0, 0, h * 0.55, Math.PI, 0); c.fill(); c.stroke();
        rounded(c, -h, -h * 0.06, s, h * 0.42, h * 0.2);
        c.fill(); c.stroke();
        face(c, s * 0.72, -h * 0.28);
      } else if (icon.form === "swing") {
        // Body with a propeller nub each side.
        rounded(c, -h * 0.72, -h * 0.62, s * 0.72, s * 0.62, s * 0.14);
        c.fill(); c.stroke();
        c.lineWidth = Math.max(2, s * 0.06);
        c.beginPath();
        c.moveTo(-h * 0.95, -h * 0.72); c.lineTo(h * 0.5, -h * 0.72);
        c.stroke();
        c.beginPath(); c.arc(-h * 0.36, h * 0.5, h * 0.16, 0, Math.PI * 2);
        c.fill(); c.stroke();
        face(c, s * 0.6, -h * 0.28);
      } else {
        // spider — squat body on four legs
        c.lineWidth = Math.max(2, s * 0.06);
        for (const dx of [-h * 0.72, -h * 0.28, h * 0.28, h * 0.72]) {
          c.beginPath(); c.moveTo(dx * 0.7, h * 0.1); c.lineTo(dx, h * 0.92); c.stroke();
        }
        c.lineWidth = Math.max(2.5, s * 0.075);
        rounded(c, -h * 0.78, -h * 0.62, s * 0.78, s * 0.72, s * 0.16);
        c.fill(); c.stroke();
        face(c, s * 0.66, -h * 0.18);
      }
    }

    function burst(icon: Icon) {
      // The death spray: pieces thrown out in every direction, plus a bright
      // ring that expands and fades — the read is "popped", not "faded out".
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
      flashes.push({ x: icon.x, y: icon.y, life: 0, color: icon.color });
    }

    function handleClick(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      for (const icon of icons) {
        if (icon.dead > 0) continue;
        const h = icon.size / 2 + 8;
        if (Math.abs(px - icon.x) <= h && Math.abs(py - icon.y) <= h) {
          burst(icon);
          icon.dead = Math.round(rand(40, 90));
          break;
        }
      }
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
    canvas.addEventListener("pointerdown", handleClick);
    motionQuery.addEventListener("change", onMotionChange);
    frame = requestAnimationFrame(tick);

    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __gd?: unknown }).__gd = {
        icons, particles, flashes, FORMS,
        step: (n = 1) => { for (let i = 0; i < n; i += 1) tick(); cancelAnimationFrame(frame); },
        popAt: (x: number, y: number) => handleClick({ clientX: x, clientY: y } as PointerEvent),
        setForm: (i: number, f: Form) => { icons[i].form = f; },
      };
    }

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", handleClick);
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
