"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { MapOverview, MapStateDetail } from "./types";

// The national frame. A selected state gets its own frame instead (see
// `view`), so a tall state isn't letterboxed inside a 1.6:1 box.
const WIDTH = 975;
const HEIGHT = 610;

// How much of the state frame the state itself fills, and the range the
// frame's aspect ratio is allowed to take before it starts letterboxing.
const STATE_FILL = 0.94;
const MIN_STATE_ASPECT = 0.8;
const MAX_STATE_ASPECT = 1.6;

// Muted party palette, desaturated to sit alongside the site's warm
// browns instead of election-night primaries. Mirrored in globals.css.
const DEM = "#587a9e";
const REP = "#a65848";
const IND = "#6f8264";
const NEUTRAL = "#c9b8a3";

type StateProps = { state: string; name: string };
type DistrictProps = { district: number };
type StateFeature = Feature<Geometry, StateProps>;
type DistrictFeature = Feature<Geometry, DistrictProps>;

function lerpColor(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16);
  const b = parseInt(to.slice(1), 16);
  const channel = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t);
  };
  return `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`;
}

function partyColor(party: string | null | undefined): string {
  if (party === "Democrat" || party === "Democratic") return DEM;
  if (party === "Republican") return REP;
  if (party) return IND;
  return NEUTRAL;
}

/** National fill: blend between the party colors by House delegation. */
function delegationColor(house: Record<string, number> | undefined): string {
  if (!house) return NEUTRAL;
  const dem = house["Democrat"] ?? 0;
  const rep = house["Republican"] ?? 0;
  if (dem + rep === 0) return NEUTRAL;
  return lerpColor(DEM, REP, rep / (dem + rep));
}

function delegationText(house: Record<string, number> | undefined): string {
  if (!house) return "";
  const parts = Object.entries(house)
    .sort((a, b) => b[1] - a[1])
    .map(([party, count]) => `${count} ${party}${count === 1 ? "" : "s"}`);
  return parts.join(", ");
}

type Tooltip = { x: number; y: number; lines: string[] };

type USMapProps = {
  selectedState: string | null;
  selectedDistrict: number | null;
  /** Districts to call out (e.g. everything a zip code touches). */
  highlightedDistricts: number[];
  stateDetail: MapStateDetail | null;
  onSelectState: (abbr: string) => void;
  onSelectDistrict: (district: number) => void;
  onBack: () => void;
};

export default function USMap({
  selectedState,
  selectedDistrict,
  highlightedDistricts,
  stateDetail,
  onSelectState,
  onSelectDistrict,
  onBack,
}: USMapProps) {
  const [states, setStates] = useState<StateFeature[] | null>(null);
  const [districts, setDistricts] = useState<{ state: string; features: DistrictFeature[] } | null>(null);
  const [overview, setOverview] = useState<MapOverview | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const districtCache = useRef(new Map<string, DistrictFeature[]>());
  const containerRef = useRef<HTMLDivElement | null>(null);

  const path = useMemo(() => {
    const projection = geoAlbersUsa().scale(1300).translate([WIDTH / 2, HEIGHT / 2]);
    return geoPath(projection);
  }, []);

  // State outlines: static asset, loads once, needed for first paint.
  useEffect(() => {
    let cancelled = false;
    fetch("/geo/states.topo.json")
      .then((res) => res.json())
      .then((topo: Topology<{ states: GeometryCollection<StateProps> }>) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.states) as FeatureCollection<Geometry, StateProps>;
        setStates(fc.features);
      })
      .catch(() => setGeoError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Delegation data for the national coloring. The map still renders
  // (neutral fills) if the backend is asleep or unreachable.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/yourElections/map/overview", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MapOverview | null) => {
        if (!cancelled && data && data.states) setOverview(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // District geometry for the selected state, lazy-fetched and cached.
  useEffect(() => {
    if (!selectedState) {
      setDistricts(null);
      return;
    }
    const cached = districtCache.current.get(selectedState);
    if (cached) {
      setDistricts({ state: selectedState, features: cached });
      return;
    }
    let cancelled = false;
    setDistricts(null);
    fetch(`/geo/districts/${selectedState}.topo.json`)
      .then((res) => res.json())
      .then((topo: Topology<{ districts: GeometryCollection<DistrictProps> }>) => {
        if (cancelled) return;
        const fc = feature(topo, topo.objects.districts) as FeatureCollection<Geometry, DistrictProps>;
        districtCache.current.set(selectedState, fc.features);
        setDistricts({ state: selectedState, features: fc.features });
      })
      .catch(() => setGeoError(true));
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

  const selectedFeature = useMemo(
    () => states?.find((f) => f.properties.state === selectedState) ?? null,
    [states, selectedState],
  );

  // Zoom-to-state as a group transform over nationally-projected paths.
  // The frame reshapes to the state's own proportions too, so the map keeps
  // filling its column now that the column is no wider than the panels
  // beside it — a wide national box would leave a selected state stranded
  // in empty space on either side.
  const view = useMemo(() => {
    if (!selectedFeature) return { w: WIDTH, h: HEIGHT, k: 1, tx: 0, ty: 0 };
    const [[x0, y0], [x1, y1]] = path.bounds(selectedFeature);
    const dx = x1 - x0;
    const dy = y1 - y0;
    const aspect = Math.min(
      MAX_STATE_ASPECT,
      Math.max(MIN_STATE_ASPECT, dx / dy),
    );
    const h = HEIGHT;
    const w = h * aspect;
    const k = Math.min(12, STATE_FILL / Math.max(dx / w, dy / h));
    return {
      w,
      h,
      k,
      tx: w / 2 - (k * (x0 + x1)) / 2,
      ty: h / 2 - (k * (y0 + y1)) / 2,
    };
  }, [selectedFeature, path]);

  const centroids = useMemo(() => {
    const result = new Map<string, [number, number]>();
    for (const f of states ?? []) {
      const c = path.centroid(f);
      if (!Number.isNaN(c[0])) result.set(f.properties.state, c);
    }
    return result;
  }, [states, path]);

  const incumbentsByDistrict = useMemo(() => {
    const result = new Map<number, { name: string; party: string } | null>();
    for (const d of stateDetail?.districts ?? []) {
      result.set(
        d.district,
        d.incumbent ? { name: d.incumbent.full_name, party: d.incumbent.party } : null,
      );
    }
    return result;
  }, [stateDetail]);

  function moveTooltip(event: React.MouseEvent, lines: string[]) {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setTooltip({
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      lines,
    });
  }

  function stateTooltip(event: React.MouseEvent, f: StateFeature) {
    const abbr = f.properties.state;
    const info = overview?.states[abbr];
    const lines = [f.properties.name];
    if (info) {
      lines.push(`House: ${delegationText(info.house)}`);
      const senParties = delegationText(
        info.senators.reduce<Record<string, number>>((acc, s) => {
          acc[s.party] = (acc[s.party] ?? 0) + 1;
          return acc;
        }, {}),
      );
      if (senParties) lines.push(`Senate: ${senParties}`);
      if (info.senate_race_2026) lines.push("Senate seat up in 2026");
    }
    moveTooltip(event, lines);
  }

  function districtTooltip(event: React.MouseEvent, f: DistrictFeature) {
    const n = f.properties.district;
    const atLarge = districts !== null && districts.features.length === 1;
    const label = atLarge ? "At-Large district" : `District ${n}`;
    const incumbent = incumbentsByDistrict.get(n);
    const lines = [label];
    if (incumbent === null) lines.push("Seat is vacant");
    if (incumbent) lines.push(`${incumbent.name} (${incumbent.party})`);
    moveTooltip(event, lines);
  }

  if (geoError) {
    return (
      <div className="elections-status">
        <p className="eyebrow">Map unavailable</p>
        <p>The map data failed to load. Refresh the page to try again.</p>
      </div>
    );
  }

  const inStateView = selectedState !== null;
  const showDistricts = inStateView && districts?.state === selectedState;
  const stateName = selectedFeature?.properties.name ?? selectedState;

  return (
    <div className="us-map" ref={containerRef}>
      {inStateView ? (
        <div className="map-breadcrumb">
          <button type="button" onClick={onBack}>
            ← United States
          </button>
          <span>{stateName}</span>
        </div>
      ) : null}

      {states === null ? (
        <div className="map-loading">
          <div className="pulse-loading" />
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${view.w} ${view.h}`}
          role="img"
          aria-label={
            inStateView
              ? `Map of ${stateName} congressional districts`
              : "Map of the United States, colored by each state's House delegation"
          }
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <pattern id="vacant-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill={NEUTRAL} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--card)" strokeWidth="2" />
            </pattern>
          </defs>

          <g
            className="map-zoom"
            style={{
              transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.k})`,
              transformOrigin: "0 0",
            }}
          >
            {states.map((f) => {
              const abbr = f.properties.state;
              const isSelected = abbr === selectedState;
              const info = overview?.states[abbr];
              // Alaska and Hawaii sit at made-up inset positions in an
              // Albers USA projection, so as backdrop they can drift into
              // a zoomed frame — Hawaii lands in the Gulf beside Texas.
              // They're only drawn when they're the state being viewed.
              if (inStateView && !isSelected && (abbr === "AK" || abbr === "HI")) {
                return null;
              }
              return (
                <path
                  key={abbr}
                  d={path(f) ?? undefined}
                  className={
                    inStateView
                      ? isSelected
                        ? "map-state selected"
                        : "map-state backdrop"
                      : `map-state${info?.senate_race_2026 ? " senate-race" : ""}`
                  }
                  fill={
                    inStateView
                      ? isSelected
                        ? NEUTRAL
                        : "var(--tan)"
                      : delegationColor(info?.house)
                  }
                  role={inStateView ? undefined : "button"}
                  aria-label={inStateView ? undefined : `View ${f.properties.name}`}
                  tabIndex={inStateView ? undefined : 0}
                  onClick={inStateView ? undefined : () => onSelectState(abbr)}
                  onKeyDown={
                    inStateView
                      ? undefined
                      : (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onSelectState(abbr);
                          }
                        }
                  }
                  onMouseMove={
                    inStateView ? undefined : (event) => stateTooltip(event, f)
                  }
                />
              );
            })}

            {/* Senate-race badges, national view only. */}
            {!inStateView && overview
              ? states.map((f) => {
                  const abbr = f.properties.state;
                  if (!overview.states[abbr]?.senate_race_2026) return null;
                  const c = centroids.get(abbr);
                  if (!c) return null;
                  return (
                    <circle
                      key={`badge-${abbr}`}
                      className="map-senate-badge"
                      cx={c[0]}
                      cy={c[1]}
                      r={3.5}
                    />
                  );
                })
              : null}

            {showDistricts
              ? districts!.features.map((f) => {
                  const n = f.properties.district;
                  const incumbent = incumbentsByDistrict.get(n);
                  const fill =
                    incumbent === null
                      ? "url(#vacant-hatch)"
                      : incumbent
                        ? partyColor(incumbent.party)
                        : NEUTRAL;
                  const classes = ["map-district"];
                  if (n === selectedDistrict) classes.push("selected");
                  if (highlightedDistricts.includes(n)) classes.push("highlighted");
                  return (
                    <path
                      key={n}
                      d={path(f) ?? undefined}
                      className={classes.join(" ")}
                      fill={fill}
                      role="button"
                      aria-label={`View races for district ${n}`}
                      tabIndex={0}
                      onClick={() => onSelectDistrict(n)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectDistrict(n);
                        }
                      }}
                      onMouseMove={(event) => districtTooltip(event, f)}
                    />
                  );
                })
              : null}

            {/* District numbers, only where they fit at the current zoom. */}
            {showDistricts && districts!.features.length > 1
              ? districts!.features.map((f) => {
                  const area = path.area(f) * view.k * view.k;
                  if (area < 1200) return null;
                  const c = path.centroid(f);
                  if (Number.isNaN(c[0])) return null;
                  return (
                    <text
                      key={`label-${f.properties.district}`}
                      className="map-district-label"
                      x={c[0]}
                      y={c[1]}
                      fontSize={13 / view.k}
                    >
                      {f.properties.district}
                    </text>
                  );
                })
              : null}
          </g>
        </svg>
      )}

      {inStateView && !showDistricts && states !== null ? (
        <p className="map-hint">Loading districts…</p>
      ) : null}

      {tooltip ? (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}
        >
          {tooltip.lines.map((line, i) =>
            i === 0 ? <strong key={line}>{line}</strong> : <span key={line}>{line}</span>,
          )}
        </div>
      ) : null}

      <div className="map-legend">
        <span>
          <i style={{ background: DEM }} /> Democrat
        </span>
        <span>
          <i style={{ background: REP }} /> Republican
        </span>
        <span>
          <i style={{ background: IND }} /> Independent / other
        </span>
        <span>
          <i className="legend-hatch" /> Vacant seat
        </span>
        {!inStateView ? (
          <span>
            <i className="legend-badge" /> Senate seat up in 2026
          </span>
        ) : null}
        <p>
          Colored by the current representative&apos;s party, not partisan
          lean. Boundaries reflect current (119th Congress) districts.
        </p>
      </div>
    </div>
  );
}
