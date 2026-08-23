"use client";

// Phlem.io, the playable part.
//
// The component owns three UI phases (menu -> playing -> eaten) and one
// canvas. Everything that matters happens in engine/sim.ts at a fixed step;
// this file converts pointer positions into world-space aims, draws the
// state, and narrates the lobby's comings and goings. All the art is drawn
// by hand from canvas paths, same policy as Fleming Dash: no sprites, no
// assets, one obvious place each thing gets its look.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  FIXED_DT,
  MAX_STEPS_PER_FRAME,
  WORLD_SIZE,
  clamp,
  radiusOf,
} from "./engine/constants.ts";
import { PhlemSim, totalMass } from "./engine/sim.ts";

type Phase = "menu" | "playing" | "eaten";

type Feed = { id: number; text: string };

/** World-to-screen scale from the player's total radius. Judgement: tuned so
 *  a fresh blob reads about 70px tall and a monster still fits on screen. */
const zoomFor = (totalR: number): number => 5.1 / Math.pow(Math.max(totalR, 20), 0.44);

const NAME_KEY = "phlem.name";

export default function PhlemGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<PhlemSim | null>(null);

  const [phase, setPhase] = useState<Phase>("menu");
  const [name, setName] = useState("");
  const [board, setBoard] = useState<{ name: string; me: boolean }[]>([]);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [obit, setObit] = useState<{ by: string; mass: number; time: number } | null>(null);

  // Everything the loop needs without re-rendering React.
  const live = useRef({
    phase: "menu" as Phase,
    pointer: { x: 0.5, y: 0.5 }, // canvas-relative 0..1
    splitEdge: false,
    cam: { x: WORLD_SIZE / 2, y: WORLD_SIZE / 2, zoom: 0.6 },
    peakMass: 10,
    startedAt: 0,
    feedId: 1,
  });

  useEffect(() => {
    // Deferred a tick: reading the saved name synchronously in the effect
    // trips the cascading-render lint rule, and one frame of empty input
    // before hydration fills it is invisible.
    const id = window.setTimeout(() => {
      setName((current) => current || (window.localStorage.getItem(NAME_KEY) ?? ""));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const start = useCallback(() => {
    const trimmed = name.trim().slice(0, 24);
    window.localStorage.setItem(NAME_KEY, trimmed);
    simRef.current = new PhlemSim((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0, trimmed);
    live.current.peakMass = 10;
    live.current.startedAt = performance.now();
    live.current.phase = "playing";
    setObit(null);
    setFeed([]);
    setPhase("playing");
  }, [name]);

  const respawn = useCallback(() => {
    simRef.current?.respawnPlayer();
    live.current.peakMass = 10;
    live.current.startedAt = performance.now();
    live.current.phase = "playing";
    setObit(null);
    setPhase("playing");
  }, []);

  // ── input ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointer = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      live.current.pointer = {
        x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
        y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
      };
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || live.current.phase !== "playing") return;
      e.preventDefault();
      live.current.splitEdge = true;
    };
    canvas.addEventListener("pointermove", onPointer);
    canvas.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      canvas.removeEventListener("pointermove", onPointer);
      canvas.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── the loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    const resize = () => {
      const rect = wrap.getBoundingClientRect();
      if (rect.width === 0) return;
      width = rect.width;
      height = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudIn = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      const sim = simRef.current;
      const L = live.current;

      if (sim && L.phase === "playing") {
        // Convert the pointer through the CURRENT camera, so steering keeps
        // meaning "toward my cursor" while the view scales.
        const aimX = L.cam.x + (L.pointer.x - 0.5) * (width / L.cam.zoom);
        const aimY = L.cam.y + (L.pointer.y - 0.5) * (height / L.cam.zoom);

        acc += dt;
        let steps = 0;
        while (acc >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
          sim.step(FIXED_DT, { aimX, aimY, split: L.splitEdge });
          L.splitEdge = false;
          acc -= FIXED_DT;
          steps++;
        }

        const mass = totalMass(sim.player);
        if (mass > L.peakMass) L.peakMass = mass;

        // Camera chases the player's centre of mass; zoom follows total size.
        if (sim.player.pieces.length > 0) {
          let cx = 0;
          let cy = 0;
          let m = 0;
          for (const p of sim.player.pieces) {
            cx += p.x * p.mass;
            cy += p.y * p.mass;
            m += p.mass;
          }
          const k = 1 - Math.exp(-6 * dt);
          L.cam.x += (cx / m - L.cam.x) * k;
          L.cam.y += (cy / m - L.cam.y) * k;
          const targetZoom = zoomFor(radiusOf(m));
          L.cam.zoom += (targetZoom - L.cam.zoom) * (1 - Math.exp(-3 * dt));
        }

        // Lobby narration and the player's death, at HUD rate.
        for (const ev of sim.takeEvents()) {
          if (ev.type === "join" || ev.type === "leave") {
            const text = ev.type === "join" ? `${ev.name} joined` : `${ev.name} left`;
            const id = L.feedId++;
            setFeed((f) => [...f.slice(-4), { id, text }]);
          } else if (ev.type === "player-eaten") {
            L.phase = "eaten";
            setObit({
              by: ev.by,
              mass: Math.round(L.peakMass),
              time: Math.round((performance.now() - L.startedAt) / 1000),
            });
            setPhase("eaten");
          }
        }

        hudIn -= dt;
        if (hudIn <= 0) {
          hudIn = 0.25;
          const rows = [...sim.actors]
            .filter((a) => a.pieces.length > 0)
            .sort((a, b) => totalMass(b) - totalMass(a))
            .slice(0, 10)
            .map((a) => ({ name: a.name, me: a.isPlayer }));
          setBoard(rows);
        }
      }

      draw(ctx, width, height, sim, L.cam);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="phlem-shell">
      <div className="phlem-stage" ref={wrapRef}>
        <canvas className="phlem-canvas" ref={canvasRef} />

        {phase === "playing" ? (
          <>
            <ol className="phlem-board" aria-label="Leaderboard">
              {board.map((row, i) => (
                <li key={`${row.name}-${i}`} className={row.me ? "phlem-me" : undefined}>
                  {i + 1}. {row.name}
                </li>
              ))}
            </ol>
            <ul className="phlem-feed" aria-live="polite">
              {feed.map((f) => (
                <li key={f.id}>{f.text}</li>
              ))}
            </ul>
            <button
              type="button"
              className="phlem-split"
              aria-label="Split"
              onPointerDown={(e) => {
                e.preventDefault();
                live.current.splitEdge = true;
              }}
            >
              ✂ split
            </button>
          </>
        ) : null}

        {phase === "menu" ? (
          <div className="phlem-overlay">
            <p className="eyebrow">Phlem.io</p>
            <h2>Eat or be eaten</h2>
            <p className="menu-blurb">
              A single-player agar arena. Everyone else in the lobby is named
              after an extreme demon from the AREDL, and none of them know
              you&apos;re the only human here.
            </p>
            <form
              className="phlem-form"
              onSubmit={(e) => {
                e.preventDefault();
                start();
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="your name"
                maxLength={24}
                aria-label="Player name"
              />
              <button type="submit" className="menu-open">
                Play
              </button>
            </form>
            <p className="phlem-hint">
              Move with the mouse or a finger · Space or the button to split ·
              green spiky things pop you
            </p>
          </div>
        ) : null}

        {phase === "eaten" && obit ? (
          <div className="phlem-overlay">
            <p className="eyebrow">Absorbed</p>
            <h2>{obit.by} ate you</h2>
            <p className="menu-blurb">
              Peak mass {obit.mass} · survived {obit.time}s
            </p>
            <div className="phlem-form">
              <button type="button" className="menu-open" onClick={respawn}>
                Respawn
              </button>
              <button type="button" className="menu-open phlem-quiet" onClick={() => setPhase("menu")}>
                Menu
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── drawing, all of it ────────────────────────────────────────────────────

function draw(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  sim: PhlemSim | null,
  cam: { x: number; y: number; zoom: number },
): void {
  // The classic light arena. The site is dark; the dish is not.
  ctx.fillStyle = "#f2f5f8";
  ctx.fillRect(0, 0, width, height);
  if (!sim) return;

  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  const viewW = width / cam.zoom;
  const viewH = height / cam.zoom;
  const x0 = cam.x - viewW / 2;
  const y0 = cam.y - viewH / 2;

  // Grid, then the dish edge.
  ctx.strokeStyle = "#dde3e9";
  ctx.lineWidth = 1 / cam.zoom;
  const STEP = 60;
  ctx.beginPath();
  for (let gx = Math.floor(x0 / STEP) * STEP; gx < x0 + viewW; gx += STEP) {
    ctx.moveTo(gx, y0);
    ctx.lineTo(gx, y0 + viewH);
  }
  for (let gy = Math.floor(y0 / STEP) * STEP; gy < y0 + viewH; gy += STEP) {
    ctx.moveTo(x0, gy);
    ctx.lineTo(x0 + viewW, gy);
  }
  ctx.stroke();
  ctx.strokeStyle = "#b8c2cc";
  ctx.lineWidth = 6 / cam.zoom;
  ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  // Pellets. Cheap circles, culled to the view.
  for (const pe of sim.pellets) {
    if (pe.x < x0 - 20 || pe.x > x0 + viewW + 20 || pe.y < y0 - 20 || pe.y > y0 + viewH + 20)
      continue;
    ctx.fillStyle = `hsl(${pe.hue} 75% 58%)`;
    ctx.beginPath();
    ctx.arc(pe.x, pe.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // Every piece in the world, smallest first so giants overlap them.
  type Drawn = { x: number; y: number; r: number; hue: number; name: string; me: boolean };
  const drawn: Drawn[] = [];
  for (const a of sim.actors) {
    for (const p of a.pieces) {
      drawn.push({ x: p.x, y: p.y, r: radiusOf(p.mass), hue: a.hue, name: a.name, me: a.isPlayer });
    }
  }
  drawn.sort((a, b) => a.r - b.r);
  for (const d of drawn) {
    if (
      d.x + d.r < x0 ||
      d.x - d.r > x0 + viewW ||
      d.y + d.r < y0 ||
      d.y - d.r > y0 + viewH
    )
      continue;
    ctx.fillStyle = `hsl(${d.hue} 68% 54%)`;
    ctx.strokeStyle = `hsl(${d.hue} 68% 40%)`;
    ctx.lineWidth = Math.max(3, d.r * 0.06);
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Names once a blob is big enough to carry one, agar-style.
    const px = d.r * cam.zoom;
    if (px > 18) {
      const size = clamp(d.r * 0.42, 12 / cam.zoom, d.r * 0.5);
      ctx.font = `700 ${size}px Arial, Helvetica, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = size * 0.14;
      ctx.strokeStyle = "rgba(10, 16, 28, 0.75)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(d.name, d.x, d.y);
      ctx.fillText(d.name, d.x, d.y);
    }
  }

  // Viruses last: in the real game you hide UNDER them, so they sit on top.
  for (const v of sim.viruses) {
    const r = radiusOf(v.mass);
    if (v.x + r < x0 || v.x - r > x0 + viewW || v.y + r < y0 || v.y - r > y0 + viewH) continue;
    drawVirus(ctx, v.x, v.y, r);
  }

  ctx.restore();
}

/** The green mine: a hand-drawn spiky ring, nothing extracted from anywhere. */
function drawVirus(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const teeth = 24;
  ctx.beginPath();
  for (let i = 0; i <= teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.86;
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#5fd23c";
  ctx.fill();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = "#3f9e26";
  ctx.stroke();
}
