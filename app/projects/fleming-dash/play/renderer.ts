// Canvas 2D renderer.
//
// Impure by definition, and deliberately kept away from the engine: nothing in
// here can affect the simulation, so tuning how the game looks can never change
// how it plays (or break a replay tape).
//
// There are no image assets. Geometry Dash's art is geometric, so the cube,
// ship, blocks and spikes are all rects and triangles — which means nothing had
// to be extracted from the game to draw them, and the site keeps its property
// of shipping no binary art.
//
// Colours mirror app/globals.css. Kept as constants here rather than read from
// CSS because the loop must not touch getComputedStyle at 240 Hz.

import {
  CAM_ANCHOR_FRAC,
  CAM_K_CUBE,
  CAM_K_SHIP,
  CAM_Y_DEADZONE_FRAC,
  SPIKE_BOX,
  TILE,
  expSmooth,
} from "../engine/constants.ts";
import { playerBox, playerHazardBox } from "../engine/collision.ts";
import type { CompiledLevel, SimState } from "../engine/types.ts";

const COLORS = {
  sky: "#f1e6d6",
  skyDeep: "#e4d2bc",
  grid: "#d6c5b1",
  ground: "#4e3629",
  groundEdge: "#2a211c",
  block: "#4e3629",
  blockFace: "#6d5d51",
  spike: "#c00404",
  player: "#c00404",
  playerInner: "#fffaf0",
  ship: "#4e3629",
  portalShip: "#2f6f6a",
  portalCube: "#587a9e",
  pad: "#b07a00",
  ring: "#b07a00",
  hitbox: "#2d7a2d",
} as const;

export type Camera = { x: number; y: number };

export function createCamera(level: CompiledLevel): Camera {
  return { x: -TILE * 4, y: level.spawn.y };
}

export function updateCamera(
  cam: Camera,
  s: SimState,
  viewW: number,
  viewH: number,
  dt: number,
): void {
  cam.x = s.x - viewW * CAM_ANCHOR_FRAC;

  // A dead band, so the camera sits perfectly still in cube mode — which is
  // what the real game looks like — and only follows when the player genuinely
  // leaves the middle of the screen, as they do in ship sections.
  const band = viewH * CAM_Y_DEADZONE_FRAC;
  const k = s.mode === "ship" ? CAM_K_SHIP : CAM_K_CUBE;
  let target = cam.y;
  if (s.y > cam.y + band) target = s.y - band;
  else if (s.y < cam.y - band) target = s.y + band;
  cam.y = expSmooth(cam.y, target, k, dt);
}

/** Interpolated player position, so 120 Hz displays get smooth motion between sim steps. */
export type Snapshot = { x: number; y: number; rot: number };

export function draw(
  ctx: CanvasRenderingContext2D,
  s: SimState,
  prev: Snapshot,
  level: CompiledLevel,
  cam: Camera,
  alpha: number,
  viewW: number,
  viewH: number,
  showHitboxes = false,
): void {
  const px = prev.x + (s.x - prev.x) * alpha;
  const py = prev.y + (s.y - prev.y) * alpha;
  const prot = prev.rot + (s.rot - prev.rot) * alpha;

  const sx = (wx: number) => wx - cam.x;
  const sy = (wy: number) => viewH / 2 - (wy - cam.y);

  // ── background ───────────────────────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, COLORS.skyDeep);
  grad.addColorStop(1, COLORS.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);

  // Parallax vertical rules, echoing the site's own line motif.
  ctx.strokeStyle = COLORS.grid;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  const par = cam.x * 0.4;
  ctx.beginPath();
  for (let gx = Math.floor(par / 72) * 72; gx < par + viewW + 72; gx += 72) {
    const x = Math.round(gx - par) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewH);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── level geometry ───────────────────────────────────────────────────────
  const lo = Math.max(0, Math.floor(cam.x / TILE) - 1);
  const hi = Math.min(level.columns.length - 1, Math.floor((cam.x + viewW) / TILE) + 1);

  // Ground band, drawn per column so a zone's raised floor shows up.
  ctx.fillStyle = COLORS.ground;
  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;
    const top = sy(col.groundY);
    ctx.fillRect(sx(gx * TILE), top, TILE + 1, viewH - top);
  }
  ctx.strokeStyle = COLORS.groundEdge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;
    ctx.moveTo(sx(gx * TILE), sy(col.groundY));
    ctx.lineTo(sx((gx + 1) * TILE), sy(col.groundY));
  }
  ctx.stroke();

  const drawn = new Set<string>();
  for (let gx = lo; gx <= hi; gx++) {
    const col = level.columns[gx];
    if (!col) continue;

    for (const r of col.solids) {
      // Spans register in several columns; draw each rect once.
      const key = `${r.x},${r.y}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      const x = sx(r.x);
      const y = sy(r.y + r.h);
      ctx.fillStyle = COLORS.block;
      ctx.fillRect(x, y, r.w, r.h);
      ctx.fillStyle = COLORS.blockFace;
      ctx.fillRect(x + 3, y + 3, r.w - 6, 3);
      ctx.strokeStyle = COLORS.groundEdge;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, r.w - 1.5, r.h - 1.5);
    }

    for (const hz of col.hazards) {
      const key = `h${hz.x},${hz.y}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      // Draw the spike from its cell, not its (much smaller) lethal rect — the
      // gap between the two is the forgiveness, and it should be visible.
      const cellX = Math.floor(hz.x / TILE) * TILE;
      const cellY = Math.floor(hz.y / TILE) * TILE;
      ctx.fillStyle = COLORS.spike;
      ctx.beginPath();
      ctx.moveTo(sx(cellX + 2), sy(cellY));
      ctx.lineTo(sx(cellX + TILE / 2), sy(cellY + TILE - 3));
      ctx.lineTo(sx(cellX + TILE - 2), sy(cellY));
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = COLORS.groundEdge;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const t of col.triggers) {
      const key = `t${t.id}`;
      if (drawn.has(key)) continue;
      drawn.add(key);

      const x = sx(t.box.x);
      const y = sy(t.box.y + t.box.h);
      if (t.kind === "ship" || t.kind === "cube") {
        ctx.fillStyle = t.kind === "ship" ? COLORS.portalShip : COLORS.portalCube;
        ctx.globalAlpha = 0.28;
        ctx.fillRect(x, y, t.box.w, t.box.h);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = t.kind === "ship" ? COLORS.portalShip : COLORS.portalCube;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 1.5, y + 1.5, t.box.w - 3, t.box.h - 3);
      } else if (t.kind === "pad") {
        ctx.fillStyle = COLORS.pad;
        ctx.fillRect(x + 2, y, t.box.w - 4, t.box.h);
      } else {
        ctx.strokeStyle = COLORS.ring;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + t.box.w / 2, y + t.box.h / 2, TILE * 0.32, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // ── player ───────────────────────────────────────────────────────────────
  const box = playerBox(s);
  ctx.save();
  ctx.translate(sx(px), sy(py));
  ctx.rotate(-prot);

  if (s.mode === "ship") {
    ctx.fillStyle = COLORS.ship;
    ctx.beginPath();
    ctx.moveTo(-box.w / 2, -box.h / 2);
    ctx.lineTo(box.w / 2, 0);
    ctx.lineTo(-box.w / 2, box.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-box.w / 2 + 4, -4, 8, 8);
  } else {
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(-box.w / 2, -box.h / 2, box.w, box.h);
    ctx.fillStyle = COLORS.playerInner;
    ctx.fillRect(-box.w / 2 + 7, -box.h / 2 + 7, box.w - 14, box.h - 14);
    ctx.strokeStyle = COLORS.groundEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(-box.w / 2 + 1, -box.h / 2 + 1, box.w - 2, box.h - 2);
  }
  ctx.restore();

  // ── debug ────────────────────────────────────────────────────────────────
  // Not polish — this is the instrument the forgiveness constants get tuned
  // with, so it exists from the start rather than being added at the end.
  if (showHitboxes) {
    const kill = playerHazardBox(s);
    ctx.strokeStyle = COLORS.hitbox;
    ctx.lineWidth = 1;
    ctx.strokeRect(sx(box.x), sy(box.y + box.h), box.w, box.h);
    ctx.strokeStyle = COLORS.spike;
    ctx.strokeRect(sx(kill.x), sy(kill.y + kill.h), kill.w, kill.h);

    for (let gx = lo; gx <= hi; gx++) {
      const col = level.columns[gx];
      if (!col) continue;
      for (const hz of col.hazards) {
        ctx.strokeRect(sx(hz.x), sy(hz.y + hz.h), hz.w, hz.h);
      }
    }
  }
}

export { SPIKE_BOX };
