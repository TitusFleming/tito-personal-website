"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { FIXED_DT, MAX_FRAME_DT, MAX_STEPS_PER_FRAME } from "./engine/constants.ts";
import { compileLevel } from "./engine/world.ts";
import { Checkpoint, Simulation } from "./engine/simulate.ts";
import type { SimEvent } from "./engine/types.ts";
import { createInput, type Input } from "./play/input.ts";
import { createMusic, type Music } from "./play/audio.ts";
import { createSfx, type Sfx } from "./play/sfx.ts";
import { Effects } from "./play/effects.ts";
import { PALETTE } from "./play/sprites.ts";
import {
  createCamera,
  draw,
  interpolate,
  snapCamera,
  updateCamera,
  type Camera,
  type Snapshot,
} from "./play/renderer.ts";
import {
  loadPlayer,
  loadProgress,
  mergeAttempt,
  saveName,
  saveProgress,
  type LevelProgress,
  type Player,
} from "./storage/local.ts";
import { LEVELS, type LevelEntry } from "./levels/index.ts";

type Phase = "start" | "playing" | "complete";

/** Debris takes the icon's own colours, so the burst reads as the icon breaking. */
const EXPLOSION_COLORS = [
  PALETTE.player,
  PALETTE.playerInner,
  PALETTE.player,
  "#FFFFFF",
] as const;

export default function FlemingDash() {
  const [entry, setEntry] = useState<LevelEntry>(LEVELS[0]);
  const level = useMemo(() => compileLevel(entry.doc), [entry]);

  const [phase, setPhase] = useState<Phase>("start");
  const [player, setPlayer] = useState<Player | null>(null);
  const [progress, setProgress] = useState<LevelProgress | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [paused, setPaused] = useState(false);
  const [practice, setPractice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showHitboxes, setShowHitboxes] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [cpCount, setCpCount] = useState(0);

  // Everything the loop touches is a ref: a setState per frame at 240 Hz would
  // be catastrophic, so React only hears about phase and toggle changes.
  const shellRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const camRef = useRef<Camera | null>(null);
  const inputRef = useRef<Input | null>(null);
  const musicRef = useRef<Music | null>(null);
  const sfxRef = useRef<Sfx | null>(null);
  const effectsRef = useRef<Effects>(new Effects());
  const rafRef = useRef<number | null>(null);
  const accRef = useRef(0);
  const lastRef = useRef(0);
  const prevRef = useRef<Snapshot>({ x: 0, y: 0, rot: 0 });
  const viewRef = useRef({ w: 960, h: 540 });

  const pausedRef = useRef(false);
  const practiceRef = useRef(false);
  const hitboxRef = useRef(false);
  const checkpointsRef = useRef<Checkpoint[]>([]);

  useEffect(() => {
    const p = loadPlayer();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayer(p);
    setNameDraft(p.name ?? "");
    setProgress(loadProgress()[level.id] ?? null);
  }, [level.id]);

  useEffect(() => {
    pausedRef.current = paused;
    // The music is part of the game state, not background ambience — a paused
    // game with the track still running desyncs the moment you resume.
    if (paused) musicRef.current?.pause();
    else musicRef.current?.resume();
  }, [paused]);
  useEffect(() => {
    hitboxRef.current = showHitboxes;
  }, [showHitboxes]);
  useEffect(() => {
    practiceRef.current = practice;
  }, [practice]);

  /**
   * Leaving practice drops every checkpoint.
   *
   * Done here rather than in an effect on `practice` so the state change and
   * its consequence happen in one event, instead of a render that then triggers
   * another render.
   */
  const togglePractice = useCallback(() => {
    setPractice((was) => {
      if (was) {
        checkpointsRef.current = [];
        setCpCount(0);
      }
      return !was;
    });
  }, []);
  useEffect(() => {
    musicRef.current?.setMuted(muted);
    sfxRef.current?.setMuted(muted);
  }, [muted]);

  const record = useCallback(
    (sim: Simulation, completed: boolean) => {
      // Practice runs must never touch the record. Beating the level with
      // checkpoints is not beating the level, and letting it write a best would
      // quietly make the real percentage meaningless.
      if (practiceRef.current) return;
      const pct = completed ? 100 : sim.progressPercent();
      const next = mergeAttempt(
        loadProgress()[level.id],
        level.rev,
        pct,
        completed,
        completed ? sim.t : null,
      );
      saveProgress(level.id, next);
      setProgress(next);
    },
    [level],
  );

  const placeCheckpoint = useCallback(() => {
    const s = simRef.current;
    if (!s || !practiceRef.current || s.status !== "running") return;
    checkpointsRef.current.push(Checkpoint.capture(s.player));
    setCpCount(checkpointsRef.current.length);
  }, []);

  const removeCheckpoint = useCallback(() => {
    if (!practiceRef.current) return;
    checkpointsRef.current.pop();
    setCpCount(checkpointsRef.current.length);
  }, []);

  const restartLevel = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    checkpointsRef.current = [];
    setCpCount(0);
    // Hand it to the loop's own death/respawn path rather than mutating the
    // simulation from a click handler mid-frame.
    sim.status = "dead";
    sim.deathTimer = 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onFs = () => setIsFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── the loop ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sim = new Simulation(level);
    const cam = createCamera(level);
    const input = createInput(canvas);
    simRef.current = sim;
    camRef.current = cam;
    inputRef.current = input;
    accRef.current = 0;
    lastRef.current = performance.now();
    prevRef.current = { x: sim.player.x, y: sim.player.y, rot: sim.player.rot };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      // Zero here means a hidden tab or a measurement before layout. Writing it
      // through leaves a 0x0 canvas that never recovers, since nothing else
      // triggers a resize.
      if (w <= 0 || h <= 0) return;
      viewRef.current = { w, h };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
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
      // Replaying seconds of physics with no input is a guaranteed death the
      // player never saw, which reads as the game cheating.
      if (dt > MAX_FRAME_DT || pausedRef.current) accRef.current = 0;
      else accRef.current += dt;

      let steps = 0;
      while (accRef.current >= FIXED_DT && steps < MAX_STEPS_PER_FRAME) {
        prevRef.current.x = sim.player.x;
        prevRef.current.y = sim.player.y;
        prevRef.current.rot = sim.player.rot;
        // Not broken out of on death: step() becomes a cheap death-clock drain,
        // and letting it run keeps that clock ticking at the fixed rate. The
        // freeze used to be drained here at the fixed rate AND again below at
        // the real frame rate, so half a second of freeze lasted a quarter.
        sim.step(input.state, FIXED_DT, events);
        accRef.current -= FIXED_DT;
        steps++;
      }
      if (steps === MAX_STEPS_PER_FRAME) accRef.current = 0;

      for (const e of events) {
        if (e.type === "death") {
          record(sim, false);
          // The track stops on the frame of contact rather than fading out with
          // the freeze — the run ended, and hearing it continue over a dead
          // player reads as a bug.
          musicRef.current?.cut();
          sfxRef.current?.play("explode");
          effectsRef.current.burst(e.x, e.y, EXPLOSION_COLORS);
        }
        else if (e.type === "complete" && !finished) {
          finished = true;
          record(sim, true);
          setPhase("complete");
        }
      }
      events.length = 0;

      // Death and respawn happen inside the loop, so a retry costs zero React
      // renders and feels instant — which is the whole experience of this genre.
      if (sim.status === "dead") {
        if (sim.deathTimer <= 0) {
          const cps = checkpointsRef.current;
          if (practiceRef.current && cps.length > 0) {
            sim.restore(cps[cps.length - 1]);
          } else {
            sim.reset();
          }
          prevRef.current = { x: sim.player.x, y: sim.player.y, rot: sim.player.rot };
          effectsRef.current.clear();
          // Snap rather than ease, or the camera slides across the level after
          // every death and the first half-second of every attempt is unreadable.
          snapCamera(cam, sim.player, level, viewRef.current.w, viewRef.current.h);
          // The level is choreographed to the track, so a run starting mid-song
          // has every jump cue in the wrong place. A practice respawn is not a
          // fresh run, so it keeps playing.
          if (!practiceRef.current || checkpointsRef.current.length === 0) {
            musicRef.current?.restart();
          }
        }
      }

      const { w, h } = viewRef.current;
      // Interpolate ONCE, then hand the same snapshot to the camera and the
      // draw. The camera has no access to the raw simulation position, which is
      // what stops the world scrolling in whole-step lumps.
      effectsRef.current.update(Math.min(dt, MAX_FRAME_DT));
      const view = interpolate(prevRef.current, sim.player, accRef.current / FIXED_DT);
      updateCamera(cam, sim.player, view, level, w, h, Math.min(dt, MAX_FRAME_DT));
      draw(ctx, sim.player, view, level, cam, w, h, {
        palette: sim.palette,
        percent: sim.progressPercent(),
        attempt: sim.attempt,
        practice: practiceRef.current,
        checkpoints: checkpointsRef.current,
        showHitboxes: hitboxRef.current,
        effects: effectsRef.current,
        // The player is drawn only while alive: once it explodes, the debris is
        // the player.
        hidePlayer: sim.status === "dead",
      });
    };
    rafRef.current = requestAnimationFrame(frame);

    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setPaused((p) => !p);
      // Practice is reachable only from the pause menu now.
      else if (e.code === "KeyP") setPaused(true);
      else if (e.code === "KeyZ") placeCheckpoint();
      else if (e.code === "KeyC") removeCheckpoint();
      else if (e.code === "KeyF") toggleFullscreen();
      else if (e.code === "KeyM") setMuted((m) => !m);
      else if (e.code === "KeyH") setShowHitboxes((v) => !v);
    };
    window.addEventListener("keydown", onKey);

    const onHide = () => {
      if (document.visibilityState === "hidden") setPaused(true);
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      ro.disconnect();
      input.detach();
      simRef.current = null;
      inputRef.current = null;
    };
  }, [phase, level, record, placeCheckpoint, removeCheckpoint, toggleFullscreen]);

  const start = () => {
    if (player) setPlayer(saveName(player, nameDraft));
    if (!musicRef.current) musicRef.current = createMusic(entry.audio);
    if (!sfxRef.current) sfxRef.current = createSfx();
    // Primed inside the click, while a user gesture is still active.
    sfxRef.current.unlock();
    sfxRef.current.setMuted(muted);
    // Must be inside the click handler: browsers keep an AudioContext suspended
    // until a real user gesture.
    void musicRef.current.start();
    musicRef.current.setMuted(muted);
    setPaused(false);
    setPhase("playing");
  };

  const best = progress?.rev === level.rev ? progress : null;

  return (
    <div className={`fdash-shell${isFull ? " fdash-shell-full" : ""}`} ref={shellRef}>
      <div className="fdash-canvas-wrap" ref={wrapRef}>
        {phase === "playing" ? (
          <canvas className="fdash-canvas" ref={canvasRef} aria-label="Fleming Dash viewport" />
        ) : null}

        {phase === "start" ? (
          <div className="fdash-overlay">
            <p className="fdash-over-eyebrow">Level {entry.number}</p>
            <h2 className="fdash-over-title">{entry.name}</h2>
            <div className="fdash-level-row">
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  className={`fdash-level-btn${l.id === entry.id ? " fdash-level-btn-on" : ""}`}
                  aria-pressed={l.id === entry.id}
                  onClick={() => setEntry(l)}
                >
                  {l.number}. {l.name}
                </button>
              ))}
            </div>
            <div className="fdash-name-row">
              <input
                className="fdash-name-input"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") start();
                }}
                placeholder="your name"
                maxLength={24}
                autoComplete="off"
                aria-label="Your name"
              />
              <button className="fdash-btn" type="button" onClick={start}>
                Play
              </button>
            </div>
            {best ? (
              <p className="fdash-over-note">
                Best {best.bestPercent}% · {best.attempts} attempts
              </p>
            ) : null}
            <p className="fdash-over-keys">
              Space / Click to jump · Esc pause · P practice · F fullscreen
            </p>
          </div>
        ) : null}

        {phase === "complete" ? (
          <div className="fdash-overlay">
            <p className="fdash-over-eyebrow">Complete</p>
            <h2 className="fdash-over-title">
              {player?.name ? `${player.name} cleared it` : "Cleared"}
            </h2>
            <button className="fdash-btn" type="button" onClick={() => setPhase("playing")}>
              Play again
            </button>
          </div>
        ) : null}

        {phase === "playing" && paused ? (
          <div className="fdash-overlay">
            <p className="fdash-over-eyebrow">Paused</p>
            <h2 className="fdash-over-title">{entry.name}</h2>
            <div className="fdash-circle-row">
              <button
                className="fdash-circle"
                type="button"
                onClick={() => setPaused(false)}
                aria-label="Resume"
                title="Resume"
              >
                <span aria-hidden="true">&#9654;</span>
              </button>
              <button
                className="fdash-circle"
                type="button"
                onClick={() => {
                  restartLevel();
                  setPaused(false);
                }}
                aria-label="Restart level"
                title="Restart level"
              >
                <span aria-hidden="true">&#8635;</span>
              </button>
              <button
                className={`fdash-circle${practice ? " fdash-circle-on" : ""}`}
                type="button"
                onClick={togglePractice}
                aria-pressed={practice}
                aria-label={practice ? "Exit practice mode" : "Enter practice mode"}
                title={practice ? "Exit practice mode" : "Enter practice mode"}
              >
                <span aria-hidden="true">&#9873;</span>
              </button>
            </div>
            <p className="fdash-over-note">
              {practice ? `Practice mode \u00b7 ${cpCount} checkpoints` : "Normal mode"}
            </p>
            <p className="fdash-over-keys">
              {practice
                ? "Z place checkpoint \u00b7 C remove \u00b7 Esc resume"
                : "Esc resume \u00b7 F fullscreen \u00b7 M mute"}
            </p>
          </div>
        ) : null}

        {phase === "playing" ? (
          <div className="fdash-controls">
            <button className="fdash-ghost-btn" type="button" onClick={() => setPaused(true)}>
              Pause
            </button>
            {practice ? (
              <>
                <button className="fdash-ghost-btn" type="button" onClick={placeCheckpoint}>
                  + Checkpoint
                </button>
                <button className="fdash-ghost-btn" type="button" onClick={removeCheckpoint}>
                  &minus; Checkpoint
                </button>
              </>
            ) : null}
            <button
              className="fdash-ghost-btn"
              type="button"
              aria-pressed={showHitboxes}
              onClick={() => setShowHitboxes((v) => !v)}
            >
              Hitboxes
            </button>
            <button
              className="fdash-ghost-btn"
              type="button"
              aria-pressed={muted}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? "Unmute" : "Mute"}
            </button>
            <button className="fdash-ghost-btn" type="button" onClick={toggleFullscreen}>
              {isFull ? "Exit full" : "Fullscreen"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
