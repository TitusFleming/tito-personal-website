"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RaceGroup } from "./types";

function raceKey(race: RaceGroup) {
  return `${race.office_id}-${race.party ?? "general"}`;
}

/** Renders race groups the same way for every flow (zip lookup, district
 * click, statewide panel): grouped by office, one collapsed accordion per
 * party primary. `scopeKey` identifies the selection the races belong to —
 * when it changes, every accordion closes again. */
export default function RacePanel({
  races,
  scopeKey = "",
}: {
  races: RaceGroup[];
  scopeKey?: string;
}) {
  const officeGroups = useMemo(() => {
    const byOffice = new Map<string, RaceGroup[]>();
    for (const race of races) {
      const group = byOffice.get(race.office_title) ?? [];
      group.push(race);
      byOffice.set(race.office_title, group);
    }
    return [...byOffice.entries()];
  }, [races]);

  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  // A new state / district / zip starts fully collapsed. Keyed on scopeKey
  // rather than the `races` reference so a re-rendering parent can't slam
  // accordions shut while the user is reading one.
  useEffect(() => {
    setOpenKeys(new Set());
  }, [scopeKey]);

  const toggle = useCallback((key: string) => {
    setOpenKeys((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, []);

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
          <div className="race-accordion-list">
            {officeRaces.map((race) => {
              const key = raceKey(race);
              const open = openKeys.has(key);
              const panelId = `race-panel-${key}`;
              const count = race.candidates.length;
              return (
                <div
                  className={`race-accordion${open ? " is-open" : ""}`}
                  key={key}
                >
                  <button
                    type="button"
                    className="race-accordion-trigger"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() => toggle(key)}
                  >
                    <span className="race-accordion-title">
                      {race.party ? `${race.party} primary` : "Nonpartisan"}
                    </span>
                    <span className="race-accordion-meta">
                      {count} {count === 1 ? "candidate" : "candidates"}
                    </span>
                  </button>
                  <div
                    className="race-accordion-body"
                    id={panelId}
                    hidden={!open}
                  >
                    {count === 0 ? (
                      <p className="race-empty">No candidates on file yet.</p>
                    ) : (
                      <ul className="candidate-list">
                        {race.candidates.map((candidate) => (
                          <li className="candidate-row" key={candidate.id}>
                            <div>
                              <strong>{candidate.full_name}</strong>
                              {candidate.incumbent ? (
                                <span className="candidate-incumbent">
                                  Incumbent
                                </span>
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
                              <span className="candidate-nosite">
                                No site listed
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
