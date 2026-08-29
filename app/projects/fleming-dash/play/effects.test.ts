// The death burst. Presentation only, but it still has to behave: leaking
// particles into the next attempt, or outliving the death freeze, both show up
// on screen as the game being broken.

import { test } from "node:test";
import assert from "node:assert/strict";
import { DEATH_FREEZE } from "../engine/constants.ts";
import { Effects } from "./effects.ts";

const COLORS = ["#7EE63F", "#5FE0F5"] as const;

test("a burst produces debris, and nothing exists before one", () => {
  const fx = new Effects();
  assert.equal(fx.active, false, "no debris before a death");
  fx.burst(300, 15, COLORS);
  assert.equal(fx.active, true);
});

test("the burst is finished within the death freeze", () => {
  // If debris outlives the freeze it is still on screen when the retry starts,
  // which reads as the previous attempt bleeding into the new one.
  const fx = new Effects();
  fx.burst(300, 15, COLORS);
  for (let i = 0; i < Math.ceil((DEATH_FREEZE + 0.25) / (1 / 60)); i++) fx.update(1 / 60);
  assert.equal(fx.active, false, "debris outlived the freeze");
});

test("clear drops everything at once, for an instant retry", () => {
  const fx = new Effects();
  fx.burst(300, 15, COLORS);
  fx.clear();
  assert.equal(fx.active, false);
});

test("the burst is deterministic, so a replay looks the way it played", () => {
  const shape = () => {
    const fx = new Effects();
    fx.burst(300, 15, COLORS);
    const seen: string[] = [];
    const ctx = {
      save() {}, restore() {}, translate(x: number, y: number) { seen.push(`t${x.toFixed(2)},${y.toFixed(2)}`); },
      rotate(a: number) { seen.push(`r${a.toFixed(3)}`); },
      fillRect() {}, beginPath() {}, arc() {}, stroke() {},
      set globalAlpha(_v: number) {}, set fillStyle(_v: string) {},
      set strokeStyle(_v: string) {}, set lineWidth(_v: number) {},
    } as unknown as CanvasRenderingContext2D;
    for (let i = 0; i < 6; i++) fx.update(1 / 60);
    fx.draw(ctx, (x) => x, (y) => y);
    return seen.join("|");
  };
  assert.equal(shape(), shape());
});

test("two deaths at different places produce different debris", () => {
  // The seed comes from the death position, so a burst is not the same shape
  // every single time.
  const at = (x: number) => {
    const fx = new Effects();
    fx.burst(x, 15, COLORS);
    let n = 0;
    for (let i = 0; i < 3; i++) { fx.update(1 / 60); n += fx.active ? 1 : 0; }
    return `${x}:${n}`;
  };
  assert.notEqual(at(300), at(900));
});
