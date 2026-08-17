"use client";

import { useEffect, useRef } from "react";
import {
  ACESFilmicToneMapping,
  Box3,
  DirectionalLight,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Sphere,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { applyEmphasis, applyExplode, buildEngine } from "./build-engine";

type EngineCanvasProps = {
  explode: number;
  selectedId: string | null;
  hoveredId: string | null;
  autoRotate: boolean;
  reducedMotion: boolean;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onUnavailable: () => void;
};

/** Imperative handle the small prop-effects use to poke the already-built
 *  scene. The scene effect itself has a [] dep array — rebuilding a WebGL
 *  context on every parent render would be catastrophic — so props cannot
 *  reach it any other way. */
type SceneHandle = {
  setExplode: (t: number) => void;
  setEmphasis: (selected: string | null, hovered: string | null) => void;
  setAutoRotate: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
};

export default function EngineCanvas({
  explode,
  selectedId,
  hoveredId,
  autoRotate,
  reducedMotion,
  onSelect,
  onHover,
  onUnavailable,
}: EngineCanvasProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<SceneHandle | null>(null);

  // Callback props travel through refs, kept fresh by their own tiny effect,
  // so the scene effect can close over a stable reference forever.
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  const onUnavailableRef = useRef(onUnavailable);
  useEffect(() => {
    onSelectRef.current = onSelect;
    onHoverRef.current = onHover;
    onUnavailableRef.current = onUnavailable;
  }, [onSelect, onHover, onUnavailable]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    // matchMedia lives in the effect, never the render body — this component
    // is inside a page that server-renders, and reading window during render
    // is a hydration mismatch.
    const coarse = window.matchMedia("(pointer: coarse)").matches;

    // three throws out of the constructor when a context can't be created:
    // blocked GPU, headless browser, or the ~16-context ceiling after enough
    // tab churn. Catch it rather than letting it take the whole page down.
    let renderer: WebGLRenderer;
    try {
      // Deliberately NOT passing a canvas from JSX. Cleanup has to call
      // forceContextLoss(), and that permanently poisons the element it ran
      // on — getContext() afterwards hands back the same, still-lost context
      // forever. Under Strict Mode's mount/unmount/mount that means the
      // second mount can never get a live context and the page falls back to
      // "WebGL unavailable" on a machine that supports it perfectly well.
      // Letting three make its own canvas gives every mount a fresh element.
      renderer = new WebGLRenderer({
        antialias: !coarse,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      onUnavailableRef.current();
      return;
    }

    const canvas = renderer.domElement;
    canvas.className = "engine-canvas";
    canvas.tabIndex = 0;
    canvas.setAttribute("role", "img");
    canvas.setAttribute(
      "aria-label",
      "Three-dimensional model of a Cummins NTC-400 Big Cam III diesel engine",
    );
    canvas.setAttribute("aria-describedby", "engine-canvas-help");
    stage.appendChild(canvas);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const scene = new Scene();

    // MeshStandardMaterial at high metalness has nothing to reflect without an
    // environment map — it renders near-black, and the reflex fix (dropping
    // metalness) is exactly what makes cast iron look like grey plastic.
    // RoomEnvironment is a procedural studio box: no downloaded asset, ~20ms
    // once, and it gives curved surfaces specular breakup that moves as you
    // orbit. NOTE: the r185 constructor takes no arguments.
    const pmrem = new PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Environment-only lighting is form-accurate but reads flat; one key light
    // puts a directional highlight back on the machined surfaces.
    const key = new DirectionalLight(0xfff3e0, 1.25);
    key.position.set(-6, 10, 8);
    scene.add(key);

    const engine = buildEngine();
    scene.add(engine.root);

    const camera = new PerspectiveCamera(38, 1, 0.1, 500);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false; // panning an exploded assembly just loses it
    controls.autoRotateSpeed = 0.7;

    // OrbitControls.connect() sets domElement.style.touchAction = 'none'
    // inline at runtime, which swallows any thumb-scroll that starts on the
    // canvas. No stylesheet rule survives that, so on touch devices we stay
    // disconnected until the user explicitly asks for the model.
    if (coarse) controls.disconnect();

    // Frame the EXPLODED bounds, not the assembled ones — otherwise the model
    // walks out of frame as the slider moves and the user has to zoom out.
    applyExplode(engine.nodes, 1);
    const sphere = new Box3().setFromObject(engine.root).getBoundingSphere(new Sphere());
    applyExplode(engine.nodes, explode);

    const fit = sphere.radius / Math.sin((camera.fov * Math.PI) / 360);
    camera.position
      .copy(sphere.center)
      .add(new Vector3(1, 0.45, 1.15).normalize().multiplyScalar(fit * 1.1));
    controls.target.copy(sphere.center);
    controls.minDistance = fit * 0.3;
    controls.maxDistance = fit * 2.4;
    controls.update();

    // ── Interaction ────────────────────────────────────────────
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const pointerPos = { x: 0, y: 0, inside: false };
    let downAt: { x: number; y: number; t: number } | null = null;
    let lastHoverId: string | null = null;
    let dirty = true;

    let explodeTarget = explode;
    let explodeCurrent = explode;
    let motionReduced = reducedMotion;

    function pickAt(clientX: number, clientY: number): string | null {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // Non-recursive against the flat pickable list — we already know every
      // candidate, so there's no reason to walk the graph.
      const hit = raycaster.intersectObjects(engine.pickables, false)[0];
      return hit ? (hit.object.userData.partId as string) : null;
    }

    const handlePointerDown = (event: PointerEvent) => {
      downAt = { x: event.clientX, y: event.clientY, t: performance.now() };
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      const held = performance.now() - downAt.t;
      downAt = null;
      // A pointerup that ended an orbit is not a click on whatever happens to
      // be under the cursor when the drag stopped.
      if (moved > 5 || held > 400) return;
      onSelectRef.current(pickAt(event.clientX, event.clientY));
    };

    const handlePointerMove = (event: PointerEvent) => {
      pointerPos.x = event.clientX;
      pointerPos.y = event.clientY;
      pointerPos.inside = true;
    };

    const handlePointerLeave = () => {
      pointerPos.inside = false;
    };

    // Arrow keys orbit the focused canvas. OrbitControls only binds keys to
    // panning, so drive the camera through a Spherical around the existing
    // target and let controls pick it up from there.
    const spherical = new Spherical();
    const offset = new Vector3();
    const handleKeyDown = (event: KeyboardEvent) => {
      const step = Math.PI / 24;
      let dTheta = 0;
      let dPhi = 0;
      if (event.key === "ArrowLeft") dTheta = -step;
      else if (event.key === "ArrowRight") dTheta = step;
      else if (event.key === "ArrowUp") dPhi = -step;
      else if (event.key === "ArrowDown") dPhi = step;
      else return;

      event.preventDefault(); // don't scroll the page out from under the model
      offset.copy(camera.position).sub(controls.target);
      spherical.setFromVector3(offset);
      spherical.theta += dTheta;
      spherical.phi = Math.max(0.15, Math.min(Math.PI - 0.15, spherical.phi + dPhi));
      camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
      dirty = true;
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("keydown", handleKeyDown);

    // A lost context is more common on mobile than people expect — the OS
    // reclaims the GPU under memory pressure and the canvas goes black.
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onUnavailableRef.current();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost);

    // ── Resize ─────────────────────────────────────────────────
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      // A zero-size first callback puts NaN in the projection matrix and the
      // canvas stays black forever, with nothing in the console.
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); // false: CSS owns the box
      dirty = true;
    });
    // Observe the stage, not the window: the layout reflows at 900px without
    // any window resize event.
    observer.observe(stage);

    // ── Loop ───────────────────────────────────────────────────
    renderer.setAnimationLoop(() => {
      const cameraMoved = controls.update();

      if (Math.abs(explodeCurrent - explodeTarget) > 0.0008) {
        explodeCurrent = motionReduced
          ? explodeTarget
          : explodeCurrent + (explodeTarget - explodeCurrent) * 0.18;
        applyExplode(engine.nodes, explodeCurrent);
        dirty = true;
      }

      // Hover is raycast once per frame from a stored pointer position; a
      // setState per pointermove would re-render the part list 60x a second.
      if (!coarse) {
        const id = pointerPos.inside ? pickAt(pointerPos.x, pointerPos.y) : null;
        if (id !== lastHoverId) {
          lastHoverId = id;
          canvas.style.cursor = id ? "pointer" : "grab";
          onHoverRef.current(id);
        }
      }

      if (!cameraMoved && !dirty) return;
      dirty = false;
      renderer.render(scene, camera);
    });

    handleRef.current = {
      setExplode: (t) => {
        explodeTarget = t;
      },
      setEmphasis: (selected, hovered) => {
        applyEmphasis(engine.nodes, engine.sets, selected, hovered);
        dirty = true;
      },
      setAutoRotate: (on) => {
        controls.autoRotate = on;
      },
      setReducedMotion: (on) => {
        motionReduced = on;
      },
    };

    // ── Teardown ───────────────────────────────────────────────
    // Strict Mode is on by default in the App Router, so this effect mounts,
    // unmounts and mounts again in dev. Anything missed here leaks a whole
    // WebGL context per reload, browsers cap out around 16, and the page then
    // goes black in a way that looks like a code bug rather than a leak.
    return () => {
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("keydown", handleKeyDown);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      controls.dispose();
      for (const geometry of engine.geometries) geometry.dispose();
      for (const material of engine.materials) material.dispose();
      envRT.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      handleRef.current = null;
    };
    // Built once. Prop changes are pushed through handleRef by the effects
    // below; `explode` and `reducedMotion` are read here only as initial values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    handleRef.current?.setExplode(explode);
  }, [explode]);

  useEffect(() => {
    handleRef.current?.setEmphasis(selectedId, hoveredId);
  }, [selectedId, hoveredId]);

  useEffect(() => {
    handleRef.current?.setAutoRotate(autoRotate && !reducedMotion);
  }, [autoRotate, reducedMotion]);

  useEffect(() => {
    handleRef.current?.setReducedMotion(reducedMotion);
  }, [reducedMotion]);

  return (
    // The canvas is created and appended by the effect, not rendered here —
    // see the note on forceContextLoss above.
    <div className="engine-stage" ref={stageRef}>
      <p className="visually-hidden" id="engine-canvas-help">
        Drag to rotate. With the model focused, arrow keys rotate it. Every part
        is also listed as a button below the model.
      </p>
    </div>
  );
}
