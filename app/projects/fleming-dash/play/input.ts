// Keyboard, mouse and touch, reduced to two booleans.
//
// Deliberately not a React hook and not a component: input has to be readable
// by the game loop at 240 Hz, and routing it through React state would mean a
// render per keypress.

import type { InputState } from "../engine/types.ts";

// Jump only. The single-purpose control keys (pause, practice, checkpoints,
// fullscreen, mute) are handled in the component so they can reach React state.
const KEYS = new Set(["Space", "ArrowUp", "KeyW"]);

export type Input = {
  state: InputState;
  detach: () => void;
};

export function createInput(target: HTMLElement): Input {
  const state: InputState = { held: false, ringArmed: false };

  // A Set of sources rather than a single boolean, because otherwise this bug
  // appears and is maddening to find: hold space, tap the screen, release the
  // tap — and the cube stops jumping while space is still physically down.
  const sources = new Set<string>();

  const press = (id: string) => {
    const wasEmpty = sources.size === 0;
    sources.add(id);
    state.held = true;
    // Re-arm only on a fresh press, so holding through two rings fires the
    // first and not the second.
    if (wasEmpty) state.ringArmed = true;
  };

  const release = (id: string) => {
    sources.delete(id);
    if (sources.size === 0) {
      state.held = false;
      state.ringArmed = false;
    }
  };

  const clearAll = () => {
    sources.clear();
    state.held = false;
    state.ringArmed = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!KEYS.has(e.code) || e.repeat) return;
    // Only swallow the key while the game owns it, so the page still scrolls
    // normally when it doesn't.
    e.preventDefault();
    press(`key:${e.code}`);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!KEYS.has(e.code)) return;
    release(`key:${e.code}`);
  };

  const onPointerDown = (e: PointerEvent) => {
    e.preventDefault();
    // Capture so releasing outside the canvas still counts as a release.
    target.setPointerCapture?.(e.pointerId);
    press(`ptr:${e.pointerId}`);
  };

  const onPointerUp = (e: PointerEvent) => release(`ptr:${e.pointerId}`);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  target.addEventListener("pointerdown", onPointerDown);
  target.addEventListener("pointerup", onPointerUp);
  target.addEventListener("pointercancel", onPointerUp);
  // A key held at the moment focus is lost would otherwise stick forever.
  window.addEventListener("blur", clearAll);
  document.addEventListener("visibilitychange", clearAll);

  return {
    state,
    detach() {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("pointerdown", onPointerDown);
      target.removeEventListener("pointerup", onPointerUp);
      target.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", clearAll);
      document.removeEventListener("visibilitychange", clearAll);
      clearAll();
    },
  };
}
