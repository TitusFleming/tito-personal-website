"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RacePanel from "./race-panel";
import USMap from "./us-map";
import type {
  ElectionScopeResponse,
  ElectionsByZipResponse,
  MapStateDetail,
} from "./types";

function isElectionsResponse(
  value: ElectionsByZipResponse | { detail?: string },
): value is ElectionsByZipResponse {
  return "races" in value && Array.isArray(value.races);
}

function formatElectionDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

/** Fetches one backend payload whenever the url changes; null url clears. */
function useBackendData<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setData(null);
    setLoading(true);
    fetch(url, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: T | null) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading };
}

export default function ElectionsLookup() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawState = searchParams.get("state")?.toUpperCase() ?? null;
  const selectedState = rawState && /^[A-Z]{2}$/.test(rawState) ? rawState : null;
  const rawDistrict = Number(searchParams.get("district"));
  const selectedDistrict =
    selectedState && Number.isInteger(rawDistrict) && rawDistrict >= 1
      ? rawDistrict
      : null;

  const setSelection = useCallback(
    (state: string | null, district: number | null) => {
      const params = new URLSearchParams();
      if (state) params.set("state", state);
      if (state && district) params.set("district", String(district));
      const query = params.toString();
      router.replace(query ? `?${query}` : "?", { scroll: false });
    },
    [router],
  );

  // Zip shortcut state.
  const [zipInput, setZipInput] = useState("");
  const [zipHint, setZipHint] = useState("");
  const [zipError, setZipError] = useState("");
  const [zipLoading, setZipLoading] = useState(false);
  const [slowWakeup, setSlowWakeup] = useState(false);
  const [highlighted, setHighlighted] = useState<{ state: string; districts: number[] }>({
    state: "",
    districts: [],
  });
  const wakeupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wakeupTimer.current) clearTimeout(wakeupTimer.current);
    };
  }, []);

  const { data: stateDetail } = useBackendData<MapStateDetail>(
    selectedState ? `/api/yourElections/map/state/${selectedState}` : null,
  );
  const { data: statewide, loading: statewideLoading } =
    useBackendData<ElectionScopeResponse>(
      selectedState ? `/api/yourElections/elections/statewide/${selectedState}` : null,
    );
  const { data: districtRaces, loading: districtLoading } =
    useBackendData<ElectionScopeResponse>(
      selectedState && selectedDistrict
        ? `/api/yourElections/elections/district/${selectedState}/${selectedDistrict}`
        : null,
    );

  async function lookupZip(zip: string) {
    setZipLoading(true);
    setZipError("");
    setZipHint("");
    setSlowWakeup(false);
    // The backend runs on a free tier that spins down when idle; if the
    // request takes a while, tell the user what's happening.
    wakeupTimer.current = setTimeout(() => setSlowWakeup(true), 4000);

    try {
      const response = await fetch(`/api/yourElections?zip=${zip}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as
        | ElectionsByZipResponse
        | { detail?: string };

      if (!response.ok || !isElectionsResponse(json)) {
        throw new Error(
          "detail" in json && json.detail
            ? json.detail
            : "Could not load election data.",
        );
      }

      if (!json.state) {
        throw new Error("We couldn't place that zip code on the map.");
      }

      const districts = json.districts ?? [];
      setHighlighted({ state: json.state, districts });
      if (districts.length === 1) {
        setSelection(json.state, districts[0]);
      } else {
        setSelection(json.state, null);
        if (districts.length > 1) {
          setZipHint(
            `Zip ${json.zip} spans districts ${districts.join(", ")} — pick yours on the map.`,
          );
        }
      }
    } catch (loadError) {
      setZipError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load election data.",
      );
    } finally {
      if (wakeupTimer.current) clearTimeout(wakeupTimer.current);
      setSlowWakeup(false);
      setZipLoading(false);
    }
  }

  function handleZipSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setZipError("Enter a 5-digit zip code.");
      return;
    }
    lookupZip(zip);
  }

  const stateName = stateDetail?.name ?? selectedState;
  const atLarge = stateDetail !== null && stateDetail.districts.length === 1;
  const selectedInfo =
    stateDetail?.districts.find((d) => d.district === selectedDistrict) ?? null;
  const electionScope = districtRaces ?? statewide;

  return (
    <section className="pulse-shell" aria-label="Interactive election map">
      <form className="elections-controls" onSubmit={handleZipSubmit}>
        <div>
          <p className="eyebrow">2026 primaries</p>
          <h2>{selectedState ? `${stateName}` : "Click your state, or jump by zip"}</h2>
          {electionScope ? (
            <p className="elections-date">
              Primary election day: {formatElectionDate(electionScope.election_date)}
            </p>
          ) : null}
        </div>
        <div className="elections-input-row">
          <label>
            <span>Zip code</span>
            <input
              value={zipInput}
              onChange={(event) => setZipInput(event.target.value)}
              inputMode="numeric"
              maxLength={5}
              placeholder="78701"
              aria-label="Zip code"
            />
          </label>
          <button type="submit" disabled={zipLoading}>
            {zipLoading ? "Looking up…" : "Look up"}
          </button>
        </div>
      </form>

      {zipLoading && slowWakeup ? (
        <div className="elections-status">
          <p>
            The backend is waking up from a nap (it spins down when idle) —
            this first lookup can take up to a minute.
          </p>
          <div className="pulse-loading" />
        </div>
      ) : null}
      {zipError ? <p className="elections-error">{zipError}</p> : null}
      {zipHint ? <p className="map-zip-hint">{zipHint}</p> : null}

      <div className="map-layout">
        <USMap
          selectedState={selectedState}
          selectedDistrict={selectedDistrict}
          highlightedDistricts={
            selectedState && highlighted.state === selectedState
              ? highlighted.districts
              : []
          }
          stateDetail={stateDetail}
          onSelectState={(abbr) => setSelection(abbr, null)}
          onSelectDistrict={(district) => setSelection(selectedState, district)}
          onBack={() => setSelection(null, null)}
        />

        <aside className="map-panels">
          {!selectedState ? (
            <div className="elections-status">
              <p className="eyebrow">How it works</p>
              <p>
                States are colored by their current House delegation — bluer
                means more Democrats, redder means more Republicans. Dots mark
                states with a U.S. Senate seat on the 2026 ballot.
              </p>
              <p>
                Click a state to see its congressional districts and every
                2026 primary race we have on file, or enter your zip code to
                jump straight to your district.
              </p>
            </div>
          ) : (
            <>
              <div className="map-panel">
                <p className="eyebrow">Statewide</p>
                <h3>U.S. Senate — {stateName}</h3>
                {stateDetail && stateDetail.senators.length > 0 ? (
                  <ul className="senator-list">
                    {stateDetail.senators.map((senator) => (
                      <li key={senator.full_name}>
                        <strong>{senator.full_name}</strong>
                        <span>
                          {senator.party}
                          {senator.senate_class
                            ? ` · Class ${["I", "II", "III"][senator.senate_class - 1]}`
                            : ""}
                        </span>
                        {senator.website_url ? (
                          <a
                            href={senator.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Official site
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {stateDetail && !stateDetail.senate_race_2026 ? (
                  <p className="map-panel-note">
                    No U.S. Senate seat here is on the 2026 ballot.
                  </p>
                ) : statewideLoading ? (
                  <p className="map-panel-note">Loading Senate races…</p>
                ) : statewide && statewide.races.length > 0 ? (
                  <RacePanel races={statewide.races} />
                ) : null}
              </div>

              <div className="map-panel">
                <p className="eyebrow">By district</p>
                {!selectedDistrict ? (
                  <p className="map-panel-note">
                    Select a district on the map to see its 2026 House races.
                  </p>
                ) : (
                  <>
                    <h3>
                      {atLarge
                        ? `${stateName} At-Large`
                        : `${stateName} District ${selectedDistrict}`}
                    </h3>
                    {selectedInfo ? (
                      <p className="map-panel-note">
                        {selectedInfo.incumbent
                          ? `Current representative: ${selectedInfo.incumbent.full_name} (${selectedInfo.incumbent.party})`
                          : "This seat is currently vacant."}
                      </p>
                    ) : null}
                    {districtLoading ? (
                      <p className="map-panel-note">Loading races…</p>
                    ) : districtRaces ? (
                      <RacePanel races={districtRaces.races} />
                    ) : (
                      <p className="map-panel-note">
                        Races for this district couldn&apos;t be loaded — the
                        backend may still be waking up. Try reselecting the
                        district in a few seconds.
                      </p>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
