"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import CandidateRow from "./candidate-row";
import type { Candidate, RaceGroup } from "./types";

function raceKey(race: RaceGroup) {
  return `${race.office_id}-${race.party ?? "general"}`;
}

/** Splits a race into the candidates who have reported money and the
 * long tail who haven't, with the tail behind its own disclosure.
 *
 * The tail is real: 22 of the 36 people who filed for the 2026 Texas
 * Senate seat have reported nothing. But "no money reported" is not the
 * same as "not a real candidate", a campaign whose first FEC report
 * hasn't landed yet looks identical to a paper filing here. So they are
 * tucked away and counted, never dropped. */
function CandidateGroups({
  candidates,
  groupId,
}: {
  candidates: Candidate[];
  groupId: string;
}) {
  const [showRest, setShowRest] = useState(false);

  const funded = candidates.filter((c) => c.funded);
  const rest = candidates.filter((c) => !c.funded);

  // With nobody funded, a "0 shown, 8 hidden" split is just noise.
  if (funded.length === 0) {
    return (
      <ul className="candidate-list">
        {candidates.map((candidate) => (
          <CandidateRow candidate={candidate} key={candidate.id} />
        ))}
      </ul>
    );
  }

  return (
    <>
      <ul className="candidate-list">
        {funded.map((candidate) => (
          <CandidateRow candidate={candidate} key={candidate.id} />
        ))}
      </ul>
      {rest.length > 0 ? (
        <div className={`candidate-rest${showRest ? " is-open" : ""}`}>
          <button
            type="button"
            className="candidate-rest-trigger"
            aria-expanded={showRest}
            aria-controls={`candidate-rest-${groupId}`}
            onClick={() => setShowRest((value) => !value)}
          >
            {showRest ? "Hide" : "Show"} {rest.length} other filed{" "}
            {rest.length === 1 ? "candidate" : "candidates"}
          </button>
          <ul
            className="candidate-list"
            id={`candidate-rest-${groupId}`}
            hidden={!showRest}
          >
            {rest.map((candidate) => (
              <CandidateRow candidate={candidate} key={candidate.id} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** Renders race groups the same way for every flow (zip lookup, district
 * click, statewide panel): grouped by office, one collapsed accordion per
 * party primary. `scopeKey` identifies the selection the races belong to, 
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
                      <CandidateGroups
                        candidates={race.candidates}
                        groupId={key}
                      />
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
