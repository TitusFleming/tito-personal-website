"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ENGINE_PARTS, PICKABLE_PARTS } from "./engine-parts";

const MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// ssr:false is a hard error inside a Server Component in Next 16, which is
// most of why this file exists separately from page.tsx. It also keeps three
// out of the page's initial chunk entirely — engine-canvas is its only
// importer, so the ~165 KB only lands when this component mounts.
const EngineCanvas = dynamic(() => import("./engine-canvas"), {
  ssr: false,
  loading: () => <div className="engine-stage" />,
});

function explodeHeadline(t: number): string {
  if (t < 0.02) return "Assembled";
  if (t < 0.45) return "Coming apart";
  if (t < 0.9) return "Opening up";
  return "Suspended";
}

export default function EngineExplorer() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [explode, setExplode] = useState(0.35);
  const [autoRotate, setAutoRotate] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);

  // A media query is an external store, so subscribing to it this way keeps
  // the value correct without a setState-in-effect. The third argument is the
  // server snapshot: assume motion is fine during SSR and let the client
  // correct it on hydration.
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(MOTION_QUERY).matches,
    () => false,
  );

  // Deep links without touching the router: /projects/cummins#part-crankshaft
  // preselects a part. This has to be an effect rather than a lazy useState
  // initializer — the component server-renders, so reading location during
  // render would hydrate mismatched. The rule below guards against cascading
  // renders; a single mount-time read of a browser-only value has no cascade.
  useEffect(() => {
    const hash = window.location.hash.replace("#part-", "");
    if (hash && ENGINE_PARTS.some((part) => part.id === hash)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      setSelectedId(hash);
    }
  }, []);

  const selected = ENGINE_PARTS.find((part) => part.id === selectedId) ?? null;

  return (
    <section className="pulse-shell" aria-label="Interactive engine model">
      <div className="pulse-controls">
        <div>
          <p className="eyebrow">Exploded view</p>
          <h2>{explodeHeadline(explode)}</h2>
        </div>
        {webglFailed ? null : (
          <label className="engine-explode-control">
            <span>Explode · {Math.round(explode * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={explode}
              onChange={(event) => setExplode(Number(event.target.value))}
              aria-valuetext={`${Math.round(explode * 100)} percent apart`}
            />
          </label>
        )}
      </div>

      {webglFailed ? (
        <div className="elections-status">
          <p className="eyebrow">3D view unavailable</p>
          <p>
            Your browser couldn&apos;t start WebGL, so the model can&apos;t
            render. Every part is still listed below.
          </p>
        </div>
      ) : (
        <EngineCanvas
          explode={explode}
          selectedId={selectedId}
          selectedPart={selected}
          hoveredId={hoveredId}
          autoRotate={autoRotate}
          reducedMotion={reducedMotion}
          onSelect={setSelectedId}
          onHover={setHoveredId}
          onUnavailable={() => setWebglFailed(true)}
        />
      )}

      {/* Screen-reader mirror of the callout, which is positioned imperatively
          and lives over a canvas. */}
      <div className="visually-hidden" id="engine-part-detail" aria-live="polite">
        {selected ? `${selected.name}. ${selected.blurb}` : ""}
      </div>

      {webglFailed ? null : (
        <div className="engine-toolbar">
          <button
            type="button"
            className="engine-ghost-btn"
            aria-pressed={autoRotate}
            onClick={() => setAutoRotate((on) => !on)}
          >
            {autoRotate ? "Stop rotating" : "Rotate slowly"}
          </button>
          <button
            type="button"
            className="engine-ghost-btn"
            onClick={() => setSelectedId(null)}
            disabled={selectedId === null}
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="engine-layout">
        <ul className="engine-part-list" aria-label="Engine parts">
          {PICKABLE_PARTS.map((part) => (
            <li key={part.id}>
              <button
                type="button"
                id={`part-${part.id}`}
                className={`engine-part-button${part.id === selectedId ? " selected" : ""}`}
                aria-pressed={part.id === selectedId}
                aria-controls="engine-part-detail"
                onClick={() => setSelectedId(part.id === selectedId ? null : part.id)}
                onMouseEnter={() => setHoveredId(part.id)}
                onMouseLeave={() => setHoveredId(null)}
                // Wiring focus to hover is the good part: a keyboard user
                // tabbing this list watches parts light up in the model one at
                // a time, the same as a mouse user.
                onFocus={() => setHoveredId(part.id)}
                onBlur={() => setHoveredId(null)}
              >
                <span className="engine-part-name">{part.name}</span>
                {part.placements.length > 1 ? (
                  <span className="engine-part-count">×{part.placements.length}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
