// How each object looks, one function per kind.
//
// Separated from renderer.ts on purpose. The renderer decides WHERE things go
// (camera, culling, layer order); this decides WHAT they look like. A new
// object type gets a function here and is drawn correctly in every level
// forever, without anybody editing the draw loop.
//
// Every function works in WORLD units inside the renderer's scaled transform,
// and takes the object's own box. Nothing here knows about the level, the
// camera, or the player's size — so a mini portal, a new level, or a rescaled
// viewport all come out right for free.
//
// Line widths are in world units. The scene is drawn at roughly 1.6x, so 1.5
// here lands near 2.5 screen px: a crisp edge rather than the chunky 3px
// outlines that made dense spike runs read as a black smear.

const EDGE = 1.5;

/**
 * The three colours the site's menu backdrop is built from.
 *
 * Kept as named constants rather than inlined so the shared origin is obvious:
 * if the menu is retinted, these move with it and the game follows.
 */
const MENU_BODY = "#7EE63F";
const MENU_ACCENT = "#5FE0F5";
const MENU_OUTLINE = "#0B1220";

export const PALETTE = {
  block: MENU_OUTLINE,
  blockEdge: "#FFFFFF",
  blockInner: "#1B2438",
  spike: MENU_OUTLINE,
  spikeEdge: "#FFFFFF",
  spikeGloss: "#27324A",
  // Shared with the site's menu backdrop (app/gd-background.tsx), which uses
  // the same body green, cyan accent and near-black outline. The icon in the
  // game and the icons bouncing around the homepage are now the same object,
  // so the two do not read as two different products.
  //
  // Only the ICON palette is shared. Sky and ground come from each level's own
  // colour triggers (engine/palette.ts) and must not be overridden here — those
  // are level data, not theme.
  player: MENU_BODY,
  playerInner: MENU_ACCENT,
  playerEdge: MENU_OUTLINE,
  shipHull: MENU_BODY,
  shipTrim: MENU_ACCENT,
  pad: "#FFD23F",
  padPink: "#C77DFF",
  padRed: "#FF6B5B",
  padBlue: MENU_ACCENT,
  ring: "#FFD23F",
  pit: "#071A45",
} as const;

export const PORTAL_COLORS: Record<string, string> = {
  cube: MENU_BODY,
  ship: "#C77DFF",
  ball: "#FF9F45",
  ufo: MENU_ACCENT,
  wave: "#3DDC97",
  gravity: "#FF6B5B",
  size: MENU_ACCENT,
  speed: "#C77DFF",
};

/**
 * A spike, drawn as a crisp isoceles triangle filling its cell.
 *
 * Called with the origin already at the cell CENTRE and rotation applied, so
 * one shape serves all four orientations and the caller owns placement.
 *
 * The base is inset a hair so neighbouring spikes in a run keep a visible seam
 * instead of merging into one black band, and the gloss face gives the bevel
 * the real game's spikes have. There are no magic pixel fudges: everything is a
 * fraction of the cell, so a half-size spike is still correctly proportioned.
 */
export function drawSpike(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const half = w / 2;
  const halfH = h / 2;
  const baseInset = w * 0.04;
  const apex = -halfH + h * 0.03;

  ctx.beginPath();
  ctx.moveTo(-half + baseInset, halfH);
  ctx.lineTo(0, apex);
  ctx.lineTo(half - baseInset, halfH);
  ctx.closePath();
  ctx.fillStyle = PALETTE.spike;
  ctx.fill();

  // Lit left face, so a spike reads as a solid object rather than a hole.
  ctx.beginPath();
  ctx.moveTo(-half + baseInset, halfH);
  ctx.lineTo(0, apex);
  ctx.lineTo(0, halfH);
  ctx.closePath();
  ctx.fillStyle = PALETTE.spikeGloss;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-half + baseInset, halfH);
  ctx.lineTo(0, apex);
  ctx.lineTo(half - baseInset, halfH);
  ctx.closePath();
  ctx.strokeStyle = PALETTE.spikeEdge;
  ctx.lineWidth = EDGE * Math.min(1, w / 30);
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** A solid block: dark face, lighter inner panel, bright border. */
export function drawBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  ctx.fillStyle = PALETTE.block;
  ctx.fillRect(x, y, w, h);
  const pad = Math.min(w, h) * 0.16;
  if (w > pad * 2 && h > pad * 2) {
    ctx.fillStyle = PALETTE.blockInner;
    ctx.fillRect(x + pad, y + pad, w - pad * 2, h - pad * 2);
  }
  ctx.strokeStyle = PALETTE.blockEdge;
  ctx.lineWidth = EDGE;
  ctx.strokeRect(x + EDGE / 2, y + EDGE / 2, w - EDGE, h - EDGE);
}

/**
 * A portal: an upright capsule with a bright ring, as in the real game.
 *
 * Colour is looked up by family, so a new portal type is one entry in
 * PORTAL_COLORS and needs no code here. It was previously a flat translucent
 * rectangle, which read as a UI element rather than as part of the world.
 */
export function drawPortal(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  kind: string,
): void {
  const color = PORTAL_COLORS[kind] ?? PALETTE.blockEdge;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // A GD portal is a tall, narrow oval ring standing on the floor — much
  // taller than it is wide, with a dark core and a bright rim.
  const rx = w * 0.46;
  const ry = h * 0.48;

  // Dark core, so the ring reads against any background colour.
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.82, ry * 0.86, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(6, 10, 26, 0.55)";
  ctx.fill();

  // Outer rim, thick and bright.
  ctx.strokeStyle = color;
  ctx.lineWidth = w * 0.16;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner rim, thinner, giving the ring depth.
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = w * 0.05;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.72, ry * 0.78, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Base plates, top and bottom, which is how the real portal is anchored.
  ctx.fillStyle = color;
  const pw = w * 0.62;
  const ph = h * 0.045;
  ctx.fillRect(cx - pw / 2, y, pw, ph);
  ctx.fillRect(cx - pw / 2, y + h - ph, pw, ph);
}

const PAD_COLORS: Record<string, string> = {
  yellow: PALETTE.pad,
  pink: PALETTE.padPink,
  red: PALETTE.padRed,
  blue: PALETTE.padBlue,
};

/** A pad: a low dome sitting on the surface, coloured by strength. */
export function drawPad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const c = PAD_COLORS[color] ?? PALETTE.pad;
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w * 0.42, h * 1.15, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = EDGE * 0.7;
  ctx.stroke();
}

/** A ring: a coloured torus you click through. */
export function drawRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  const c = PAD_COLORS[color] ?? PALETTE.ring;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.strokeStyle = c;
  ctx.lineWidth = EDGE * 2;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = EDGE * 0.6;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.32, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * A secret coin: a ring with a bright core, dimmed once taken.
 *
 * A collected coin keeps its outline rather than vanishing, so a route you
 * already cleared still reads on screen.
 */
export function drawCoin(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  taken: boolean,
  phase: number,
): void {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) * 0.38;

  // Spun about its vertical axis: the face squashes to an edge and back. That
  // motion is what separates a coin from a jump orb at a glance — an orb is a
  // static hollow ring, a coin is a solid disc turning over.
  const turn = Math.cos(phase);
  const squash = Math.abs(turn);
  const rx = Math.max(r * 0.1, r * squash);

  ctx.save();
  if (taken) ctx.globalAlpha = 0.3;

  const face = taken ? "#6E6A5E" : "#FFD23F";
  const rim = taken ? "#3E3B34" : "#C98A00";

  // Rim first, a touch larger and offset down, so the disc has thickness.
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.1, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();

  // Face.
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.playerEdge;
  ctx.lineWidth = EDGE * 0.9;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, r, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Inner motif, only legible once the face has turned far enough to hold it.
  if (squash > 0.35) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = EDGE * 0.8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.55, r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.2, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // A bright sliver as it passes edge-on, so the spin reads even when thin.
  if (squash < 0.25 && !taken) {
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = EDGE * 0.7;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.9);
    ctx.lineTo(cx, cy + r * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The cube. Origin at its centre, rotation already applied.
 *
 * Proportions are fractions of the box, so the mini cube is the same icon at
 * half scale rather than a 30px design squeezed into 15px.
 */
export function drawCube(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const edge = w * 0.09;
  const inset = w * 0.26;
  ctx.fillStyle = PALETTE.player;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  // Cyan inset, ringed by the body colour and then by the outline — the three
  // bands the default icon is made of.
  ctx.fillStyle = PALETTE.playerEdge;
  ctx.fillRect(-w / 2 + inset, -h / 2 + inset, w - inset * 2, h - inset * 2);
  const ci = inset + edge;
  ctx.fillStyle = PALETTE.playerInner;
  ctx.fillRect(-w / 2 + ci, -h / 2 + ci, w - ci * 2, h - ci * 2);
  ctx.strokeStyle = PALETTE.playerEdge;
  ctx.lineWidth = edge;
  ctx.lineJoin = "round";
  ctx.strokeRect(-w / 2 + edge / 2, -h / 2 + edge / 2, w - edge, h - edge);
}

/**
 * The ship, copied from the game's default icon sheet.
 *
 * The shape there is specific and nothing like the aircraft this used to draw:
 * a long horizontal lime capsule, a cyan exhaust block jutting out of the stern
 * on the left, a cyan stripe running forward along the hull, and the cube
 * riding on top slightly aft of centre. Heavy near-black outline throughout,
 * same lime and cyan as every other icon.
 *
 * Origin is the hitbox centre, which is also the rotation pivot. Every number
 * is a fraction of the hitbox, so a mini ship is the same craft at half size.
 */
export function drawShip(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const hw = w / 2;
  const hh = h / 2;
  const edge = h * 0.13;
  const deck = -hh * 0.35;         // hull roof, where the rider sits
  const keel = hh;                 // hull underside
  const r = (keel - deck) / 2;     // capsule end radius

  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = PALETTE.playerEdge;
  ctx.lineWidth = edge;

  // Exhaust block, jutting out of the stern.
  const ex0 = -hw * 1.16;
  const ey0 = deck + (keel - deck) * 0.18;
  const ew = hw * 0.42;
  const eh = (keel - deck) * 0.62;
  ctx.fillStyle = PALETTE.shipTrim;
  ctx.fillRect(ex0, ey0, ew, eh);
  ctx.strokeRect(ex0, ey0, ew, eh);

  // Hull: a horizontal capsule, rounded at both ends.
  ctx.beginPath();
  ctx.moveTo(-hw * 0.78 + r, deck);
  ctx.lineTo(hw - r, deck);
  ctx.arc(hw - r, deck + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(-hw * 0.78 + r, keel);
  ctx.arc(-hw * 0.78 + r, deck + r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fillStyle = PALETTE.shipHull;
  ctx.fill();

  // Cyan stripe along the hull, stern to just forward of the rider.
  ctx.save();
  ctx.clip();
  ctx.fillStyle = PALETTE.shipTrim;
  ctx.fillRect(-hw, deck + (keel - deck) * 0.32, hw * 1.5, (keel - deck) * 0.36);
  ctx.restore();
  ctx.stroke();

  // The rider, seated on the deck slightly aft of centre.
  const side = h * 0.98;
  ctx.save();
  ctx.translate(-hw * 0.16, deck - side / 2 + edge * 0.4);
  drawCube(ctx, side, side);
  ctx.restore();
}
