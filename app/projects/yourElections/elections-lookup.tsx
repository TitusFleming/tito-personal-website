"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Candidate = {
  id: string;
  full_name: string;
  party: string | null;
  website_url: string | null;
  incumbent: boolean;
  status: string;
};

type RaceGroup = {
  office_id: string;
  office_title: string;
  office_type: string;
  party: string | null;
  candidates: Candidate[];
};

type ElectionsResponse = {
  zip: string;
  election_name: string;
  election_date: string;
  races: RaceGroup[];
};

function isElectionsResponse(
  value: ElectionsResponse | { detail?: string },
): value is ElectionsResponse {
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

export default function ElectionsLookup() {
  const [zipInput, setZipInput] = useState("");
  const [data, setData] = useState<ElectionsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [slowWakeup, setSlowWakeup] = useState(false);
  const wakeupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wakeupTimer.current) clearTimeout(wakeupTimer.current);
    };
  }, []);

  async function lookup(zip: string) {
    setLoading(true);
    setError("");
    setData(null);
    setSlowWakeup(false);
    // The backend runs on a free tier that spins down when idle; if the
    // request takes a while, tell the user what's happening.
    wakeupTimer.current = setTimeout(() => setSlowWakeup(true), 4000);

    try {
      const response = await fetch(`/api/yourElections?zip=${zip}`, {
        cache: "no-store",
      });
      const json = (await response.json()) as ElectionsResponse | { detail?: string };

      if (!response.ok || !isElectionsResponse(json)) {
        throw new Error(
          "detail" in json && json.detail
            ? json.detail
            : "Could not load election data.",
        );
      }
      setData(json);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load election data.",
      );
    } finally {
      if (wakeupTimer.current) clearTimeout(wakeupTimer.current);
      setSlowWakeup(false);
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const zip = zipInput.trim();
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a 5-digit zip code.");
      setData(null);
      return;
    }
    lookup(zip);
  }

  const officeGroups = useMemo(() => {
    if (!data) return [];
    const byOffice = new Map<string, RaceGroup[]>();
    for (const race of data.races) {
      const group = byOffice.get(race.office_title) ?? [];
      group.push(race);
      byOffice.set(race.office_title, group);
    }
    return [...byOffice.entries()];
  }, [data]);

  return (
    <section className="pulse-shell" aria-label="Zip code election lookup">
      <form className="elections-controls" onSubmit={handleSubmit}>
        <div>
          <p className="eyebrow">Ballot lookup</p>
          <h2>{data ? data.election_name : "Find your 2026 primary races"}</h2>
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
          <button type="submit" disabled={loading}>
            {loading ? "Looking up…" : "Look up"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="elections-status">
          <p className="eyebrow">Loading your ballot</p>
          {slowWakeup ? (
            <p>
              The backend is waking up from a nap (it spins down when idle) —
              this first lookup can take up to a minute.
            </p>
          ) : null}
          <div className="pulse-loading" />
        </div>
      ) : null}

      {!loading && error ? (
        <div className="elections-status">
          <p className="eyebrow">No results</p>
          <p className="elections-error">{error}</p>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          <p className="elections-date">
            Primary election day: {formatElectionDate(data.election_date)} · zip{" "}
            {data.zip}
          </p>

          {officeGroups.length === 0 ? (
            <div className="elections-status">
              <p className="eyebrow">Nothing yet</p>
              <p>
                We found your area, but no races are loaded for it yet. Check
                back after the next data refresh.
              </p>
            </div>
          ) : (
            officeGroups.map(([officeTitle, races]) => (
              <section className="race-section" key={officeTitle}>
                <div className="section-heading">
                  <p className="eyebrow">Office</p>
                  <h2>{officeTitle}</h2>
                </div>
                <div className="race-grid">
                  {races.map((race) => (
                    <article className="race-card" key={`${race.office_id}-${race.party ?? "general"}`}>
                      <p className="race-party">
                        {race.party ? `${race.party} primary` : "Nonpartisan"}
                      </p>
                      {race.candidates.length === 0 ? (
                        <p className="race-empty">No candidates on file yet.</p>
                      ) : (
                        <ul className="candidate-list">
                          {race.candidates.map((candidate) => (
                            <li className="candidate-row" key={candidate.id}>
                              <div>
                                <strong>{candidate.full_name}</strong>
                                {candidate.incumbent ? (
                                  <span className="candidate-incumbent">Incumbent</span>
                                ) : null}
                              </div>
                              {candidate.website_url ? (
                                <a
                                  href={candidate.website_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Campaign site
                                </a>
                              ) : (
                                <span className="candidate-nosite">No site listed</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </>
      ) : null}

      {!loading && !data && !error ? (
        <div className="elections-status">
          <p className="eyebrow">How it works</p>
          <p>
            Enter your 5-digit zip code to see the 2026 primary races for your
            area — U.S. Senate and House to start — with every filed candidate
            and a link to their campaign site.
          </p>
        </div>
      ) : null}
    </section>
  );
}
