"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from "./engine/constants.ts";
import { compileLevel } from "./engine/level.ts";
import { createSim, progressPercent, resetSim, stepSim } from "./engine/simulate.ts";
import type { LevelDoc, SimEvent, SimState } from "./engine/types.ts";
import { createInput, type Input } from "./play/input.ts";
import { createCamera, draw, updateCamera, type Camera, type Snapshot } from "./play/renderer.ts";
import {
  loadPlayer,
  loadProgress,
  mergeAttempt,
  saveName,
  saveProgress,
  type LevelProgress,
  type Player,
} from "./storage/local.ts";
import stereoMadness from "./levels/stereo-madness.json";

// The level is imported, not fetched: it is 20 KB of static data that the game
// cannot start without, so a network round trip would only add a loading state
// and a failure mode. resolveJsonModule is already on in tsconfig.

type Phase = "intro" | "playing" | "complete";

export default function FlemingDash() {
  const level = useMemo(() => compileLevel(stereoMadness as LevelDoc), []);

  const [phase, setPhase] = useState<Phase>("intro");
  const [player, setPlayer] = useState<Player | null>(null);
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [paused, setPaused] = useState(false);

  // Everything the loop touches is a ref. A setState per frame at 240 Hz would
  // be catastrophic, so React only ever hears about phase changes.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<SimState | null>(null);
  const camRef = useRef<Camera | null>(null);
  const inputRef = useRef<Input | null>(null);
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const prevRef = useRef<Snapshot>({ x: 0, y: 0, rot: 0 });
  const viewRef = useRef({ w: 960, h: 540 });
  const hitboxRef = useRef(false);
  const pausedRef = useRef(false);

  // HUD nodes are written to directly rather than rendered, for the same reason.
  const pctRef = useRef<HTMLSpanElement | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const attemptRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    // localStorage cannot be read during render: the server has no such thing,
    // so the first client render must match the server's (empty) output or
    // hydration breaks. That forces the read into an effect, which is exactly
    // the shape react-hooks/set-state-in-effect warns about. The warning is
    // correct in general and inapplicable here — this runs once on mount, sets
    // state that nothing else derives from, and cannot cascade.
    const p = loadPlayer();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayer(p);
    setNameDraft(p.name ?? "");
    setProgress(loadProgress()[level.id] ?? null);
  }, [level.id]);

  useEffect(() => {
    hitboxRef.current = showHitboxes;
  }, [showHitboxes]);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  /** Fold a finished attempt into local storage. Called on death and on completion. */
  const record = useCallback(
    (s: SimState, completed: boolean) => {
      const pct = completed ? 100 : progressPercent(s, level);
      const next = mergeAttempt(
        loadProgress()[level.id],
        level.rev,
        pct,
        completed,
        completed ? s.t : null,
      );
      saveProgress(level.id, next);
      setProgress(next);
    },
    [level],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sim = createSim(level);
    const cam = createCamera(level);
    const input = createInput(canvas);
    simRef.current = sim;
    camRef.current = cam;
    inputRef.current = input;
    accRef.current = 0;
    lastRef.current = performance.now();
    prevRef.current = { x: sim.x, y: sim.y, rot: sim.rot };

    // Backing store follows devicePixelRatio, capped at 2 — beyond that the
    // extra pixels cost more than they show.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      // A hidden tab, a display:none ancestor, or a measurement taken before
      // layout all report zero here. Writing that through would leave a 0x0
      // canvas — a permanently blank game that never recovers, because nothing
      // else triggers a resize. Bail and wait for the observer instead.
      if (w <= 0) return;
      const h = Math.round(w * (9 / 16));
      viewRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      // A resize clears the context transform, so it has to be re-applied.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const events: SimEvent[] = [];
    let finished = false;

    const frame = (now: number) => {
      rafRef.current = requestAnimationFrame(frame);

      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;

      // A hitch — tab switch, GC pause, closed lid — must not be simulated.
      // Replaying three seconds of physics with no input is a guaranteed death
      // the player never saw happen, which reads as the game cheating.
      if (dt > MAX_FRAME_DT || pausedRef.current) {
        accRef.current = 0;
      } else {
        accRef.current += dt;
      }

      let steps = 0;
      while (accRef.current >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        prevRef.current.x = sim.x;
        prevRef.current.y = sim.y;
        prevRef.current.rot = sim.rot;
        stepSim(sim, level, input.state, FIXED_DT, events);
        accRef.current -= FIXED_DT;
        steps++;
        if (sim.status !== "running") break;
      }
      if (steps === MAX_STEPS_PER_FRAME) accRef.current = 0;

      for (const e of events) {
        if (e.type === "death") {
          record(sim, false);
        } else if (e.type === "complete" && !finished) {
          finished = true;
          record(sim, true);
          setPhase("complete");
        }
      }
      events.length = 0;

      // Death and restart are handled inside the loop, so a retry costs zero
      // React renders and feels instant — which is the entire experience of
      // this genre.
      if (sim.status === "dead") {
        sim.deathTimer -= dt;
        if (sim.deathTimer <= 0) {
          resetSim(sim, level);
          prevRef.current = { x: sim.x, y: sim.y, rot: sim.rot };
        }
      }

      const { w, h } = viewRef.current;
      updateCamera(cam, sim, w, h, Math.min(dt, MAX_FRAME_DT));
      draw(
        ctx,
        sim,
        prevRef.current,
        level,
        cam,
        Math.min(accRef.current / FIXED_DT, 1),
        w,
        h,
        hitboxRef.current,
      );

      const pct = progressPercent(sim, level);
      if (pctRef.current) pctRef.current.textContent = `${pct}%`;
      if (barRef.current) barRef.current.style.width = `${pct}%`;
      if (attemptRef.current) attemptRef.current.textContent = String(sim.attempt);
    };

    rafRef.current = requestAnimationFrame(frame);

    const onHide = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      document.removeEventListener("visibilitychange", onHide);
      ro.disconnect();
      input.detach();
      simRef.current = null;
      inputRef.current = null;
    };
  }, [phase, level, record]);

  const start = () => {
    if (player) setPlayer(saveName(player, nameDraft));
    setPaused(false);
    setPhase("playing");
  };

  const best = progress?.rev === level.rev ? progress : null;

  if (phase === "intro") {
    return (
      <section className="fdash-shell" aria-labelledby="fdash-start">
        <p className="eyebrow">Level 1</p>
        <h2 id="fdash-start">{stereoMadness.name}</h2>
        <p className="fdash-note">
          Hold <kbd>Space</kbd>, click, or tap to jump. Hold it down and the cube
          keeps jumping. In the ship, holding makes you climb.
        </p>

        <label className="fdash-name-label" htmlFor="fdash-name">
          Your name
        </label>
        <div className="fdash-name-row">
          <input
            id="fdash-name"
            className="fdash-name-input"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") start();
            }}
            placeholder="anonymous"
            maxLength={24}
            autoComplete="off"
          />
          <button className="fdash-btn" type="button" onClick={start}>
            Play
          </button>
        </div>
        <p className="fdash-note fdash-note-quiet">
          No password, no email. Your progress is saved in this browser.
        </p>

        {best ? (
          <p className="fdash-best">
            Best so far: <strong>{best.bestPercent}%</strong> over {best.attempts}{" "}
            {best.attempts === 1 ? "attempt" : "attempts"}
            {best.completed ? " — completed" : ""}
          </p>
        ) : null}
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="fdash-shell" aria-labelledby="fdash-done">
        <p className="eyebrow">Complete</p>
        <h2 id="fdash-done">
          {player?.name ? `${player.name}, you cleared it.` : "You cleared it."}
        </h2>
        <p className="fdash-note">
          {stereoMadness.name} in {best?.attempts ?? 1}{" "}
          {(best?.attempts ?? 1) === 1 ? "attempt" : "attempts"}.
        </p>
        <button className="fdash-btn" type="button" onClick={() => setPhase("playing")}>
          Play again
        </button>
      </section>
    );
  }

  return (
    <section className="fdash-play" aria-label="Fleming Dash game">
      <div className="fdash-hud">
        <div className="fdash-hud-left">
          <span className="fdash-pct" ref={pctRef}>
            0%
          </span>
          <span className="fdash-hud-label">
            attempt <span ref={attemptRef}>1</span>
          </span>
        </div>
        <div className="fdash-hud-right">
          {best ? <span className="fdash-hud-label">best {best.bestPercent}%</span> : null}
          <button
            className="fdash-ghost-btn"
            type="button"
            onClick={() => setShowHitboxes((v) => !v)}
            aria-pressed={showHitboxes}
          >
            hitboxes
          </button>
          <button className="fdash-ghost-btn" type="button" onClick={() => setPhase("intro")}>
            quit
          </button>
        </div>
      </div>

      <div className="fdash-bar-track">
        <div className="fdash-bar" ref={barRef} />
      </div>

      <div className="fdash-canvas-wrap" ref={wrapRef}>
        <canvas className="fdash-canvas" ref={canvasRef} aria-label="Game viewport" />
        {paused ? (
          <button className="fdash-resume" type="button" onClick={() => setPaused(false)}>
            Paused — click to resume
          </button>
        ) : null}
      </div>

      <p className="fdash-note fdash-note-quiet">
        Level design by RobTop Games, imported from the original for this recreation.
      </p>
    </section>
  );
}
