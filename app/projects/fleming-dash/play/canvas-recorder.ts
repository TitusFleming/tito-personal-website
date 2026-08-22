// A headless CanvasRenderingContext2D that records what was drawn.
//
// Rendering was the one part of this project with no tests at all, which is why
// a batch of "it looks wrong" bugs could survive a green suite: an inverted
// spike, a ship drawn around the wrong origin and a camera that showed empty
// sky are all invisible to a simulation test.
//
// This implements the subset of the 2D context the renderer actually uses and
// tracks the transform stack, so a test can ask where a shape ACTUALLY landed
// in screen space after every translate/rotate/scale. That turns "does this
// look right" into an assertion, and it keeps working for any level.

export type Pt = { x: number; y: number };

export type Shape =
  | { kind: "path"; op: "fill" | "stroke"; points: Pt[]; style: string }
  /**
   * Four transformed corners, not two.
   *
   * A rect under a rotated transform is no longer axis aligned, so storing an
   * opposite pair loses the rotation entirely — a rotated cube came back as a
   * skewed bounding box. Corners survive any transform.
   */
  | { kind: "rect"; op: "fill" | "stroke"; points: Pt[]; style: string }
  | { kind: "text"; text: string; at: Pt }
  | { kind: "arc"; at: Pt; r: number; style: string };

/** Column-major 2D affine transform, matching canvas semantics. */
type M = [number, number, number, number, number, number];

const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

export class CanvasRecorder {
  shapes: Shape[] = [];
  fillStyle: string | { toString(): string } = "#000";
  strokeStyle: string | { toString(): string } = "#000";
  lineWidth = 1;
  font = "";
  lineCap = "";
  lineJoin = "";
  textAlign = "";
  textBaseline = "";
  globalAlpha = 1;

  private m: M = [1, 0, 0, 1, 0, 0];
  private stack: M[] = [];
  /** Subpaths. moveTo starts a new one — flattening them joins unrelated strokes. */
  private path: Pt[][] = [];

  /** Map a point from the current local space into device space. */
  private toDevice(x: number, y: number): Pt {
    return { x: this.m[0] * x + this.m[2] * y + this.m[4], y: this.m[1] * x + this.m[3] * y + this.m[5] };
  }

  save() { this.stack.push([...this.m] as M); }
  restore() { const m = this.stack.pop(); if (m) this.m = m; }
  translate(x: number, y: number) { this.m = mul(this.m, [1, 0, 0, 1, x, y]); }
  scale(x: number, y: number) { this.m = mul(this.m, [x, 0, 0, y, 0, 0]); }
  rotate(a: number) {
    const c = Math.cos(a), s = Math.sin(a);
    this.m = mul(this.m, [c, s, -s, c, 0, 0]);
  }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.m = [a, b, c, d, e, f]; }

  beginPath() { this.path = []; }
  moveTo(x: number, y: number) { this.path.push([this.toDevice(x, y)]); }
  lineTo(x: number, y: number) { this.current().push(this.toDevice(x, y)); }
  closePath() {}
  quadraticCurveTo(_cx: number, _cy: number, x: number, y: number) { this.current().push(this.toDevice(x, y)); }

  private current(): Pt[] {
    if (!this.path.length) this.path.push([]);
    return this.path[this.path.length - 1];
  }

  private emit(op: "fill" | "stroke", style: string) {
    for (const sub of this.path) {
      if (sub.length) this.shapes.push({ kind: "path", op, points: [...sub], style });
    }
  }
  /**
   * Arcs are FLATTENED INTO THE CURRENT PATH, not recorded as separate circles.
   *
   * A real context treats arc() as path geometry, so a capsule built from two
   * lines and two arcs is one closed shape. Recording the arcs separately
   * dropped them from the path and left a sliver plus two stray circles — which
   * made a correctly drawn ship look broken in the preview and hid whether it
   * was actually correct.
   */
  arc(x: number, y: number, r: number, start = 0, end = Math.PI * 2, ccw = false) {
    this.sample((t) => [x + r * Math.cos(t), y + r * Math.sin(t)], start, end, ccw);
  }

  ellipse(x: number, y: number, rx: number, ry = rx, _rotation = 0, start = 0, end = Math.PI * 2, ccw = false) {
    void _rotation;
    this.sample((t) => [x + rx * Math.cos(t), y + ry * Math.sin(t)], start, end, ccw);
  }

  private sample(at: (t: number) => [number, number], start: number, end: number, ccw: boolean) {
    const a0 = start;
    let a1 = end;
    if (ccw && a1 > a0) a1 -= Math.PI * 2;
    if (!ccw && a1 < a0) a1 += Math.PI * 2;
    const steps = Math.max(6, Math.ceil((Math.abs(a1 - a0) / (Math.PI * 2)) * 32));
    const target = this.current();
    for (let i = 0; i <= steps; i++) {
      const [x, y] = at(a0 + ((a1 - a0) * i) / steps);
      target.push(this.toDevice(x, y));
    }
  }

  fill() { this.emit("fill", String(this.fillStyle)); }
  stroke() { this.emit("stroke", String(this.strokeStyle)); }

  private corners(x: number, y: number, w: number, h: number): Pt[] {
    return [
      this.toDevice(x, y),
      this.toDevice(x + w, y),
      this.toDevice(x + w, y + h),
      this.toDevice(x, y + h),
    ];
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.shapes.push({ kind: "rect", op: "fill", points: this.corners(x, y, w, h), style: String(this.fillStyle) });
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.shapes.push({ kind: "rect", op: "stroke", points: this.corners(x, y, w, h), style: String(this.strokeStyle) });
  }

  fillText(text: string, x: number, y: number) { this.shapes.push({ kind: "text", text, at: this.toDevice(x, y) }); }
  measureText(t: string) { return { width: t.length * 8 }; }
  setLineDash() {}
  /** Clipping affects pixels, not geometry, so the recorder ignores it. */
  clip() {}
  /**
   * Gradients are assigned straight to fillStyle, so the recorder needs one
   * that behaves like a colour when stringified. It reports its first stop,
   * which is the colour that actually identifies the shape in a test.
   */
  createLinearGradient() {
    let first = "#000";
    return {
      addColorStop(_o: number, c: string) { if (first === "#000") first = c; },
      toString() { return first; },
    };
  }

  /** Triangles drawn with a given fill colour — how spikes are found. */
  triangles(style: string): Pt[][] {
    return this.shapes
      .filter((s): s is Extract<Shape, { kind: "path" }> => s.kind === "path" && s.op === "fill" && s.style === style)
      .map((s) => s.points)
      .filter((p) => p.length === 3);
  }

  /**
   * Shapes with at least one point inside the canvas.
   *
   * The distinction that matters: draw() emits everything in the visible
   * COLUMNS regardless of height, so a shape far above or below the viewport is
   * still recorded. Asserting on `shapes` therefore proves an object exists,
   * not that a player can see it — which is exactly how an off-screen coin
   * passed as rendered.
   */
  visible(w: number, h: number): Shape[] {
    return this.shapes.filter((s) => {
      const pts = s.kind === "path" || s.kind === "rect" ? s.points : [s.at];
      return pts.some((p) => p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h);
    });
  }

  /** The device-space bounding box of everything recorded. */
  bounds() {
    const xs: number[] = [];
    const ys: number[] = [];
    for (const s of this.shapes) {
      const pts = s.kind === "path" || s.kind === "rect" ? s.points : [s.at];
      for (const p of pts) { xs.push(p.x); ys.push(p.y); }
    }
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
  }

  /** Cast for handing to draw(), which wants a real 2D context. */
  asContext(): CanvasRenderingContext2D {
    return this as unknown as CanvasRenderingContext2D;
  }
}
