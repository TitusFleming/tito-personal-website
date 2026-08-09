"use client";

import { useMemo } from "react";
import type { RaceGroup } from "./types";

/** Renders race groups the same way for every flow (zip lookup, district
 * click, statewide panel): grouped by office, one card per party primary. */
export default function RacePanel({ races }: { races: RaceGroup[] }) {
  const officeGroups = useMemo(() => {
    const byOffice = new Map<string, RaceGroup[]>();
    for (const race of races) {
      const group = byOffice.get(race.office_title) ?? [];
      group.push(race);
      byOffice.set(race.office_title, group);
    }
    return [...byOffice.entries()];
  }, [races]);

  if (officeGroups.length === 0) {
    return (
      <div className="elections-status">
        <p className="eyebrow">Nothing yet</p>
        <p>
          No races are loaded for this area yet. Check back after the next
          data refresh.
        </p>
      </div>
    );
  }

  return (
    <>
      {officeGroups.map(([officeTitle, officeRaces]) => (
        <section className="race-section" key={officeTitle}>
          <div className="section-heading">
            <p className="eyebrow">Office</p>
            <h2>{officeTitle}</h2>
          </div>
          <div className="race-grid">
            {officeRaces.map((race) => (
              <article
                className="race-card"
                key={`${race.office_id}-${race.party ?? "general"}`}
              >
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
      ))}
    </>
  );
}
