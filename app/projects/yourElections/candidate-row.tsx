"use client";

import { useState } from "react";
import type { Candidate } from "./types";

/** $68.6M / $471K / $9,988 — short enough to sit in a list row. */
function formatMoney(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

function formatAsOf(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function percent(part: number, whole: number): string {
  return `${Math.round((part / whole) * 100)}%`;
}

/** One candidate: a summary line that expands into everything we know.
 *
 * How much there is to show varies enormously. A sitting member has a
 * photo, tenure, phone and bill counts; someone who filed a form last week
 * has a name and nothing else. The expanded view renders whatever exists
 * and stays quiet about the rest rather than showing empty labels. */
export default function CandidateRow({ candidate }: { candidate: Candidate }) {
  const [open, setOpen] = useState(false);
  const panelId = `candidate-panel-${candidate.id}`;
  const member = candidate.officeholder;

  const receipts = candidate.receipts ?? 0;
  const hasMoney = candidate.funded && receipts > 0;

  // Nothing to expand into for a bare filing — don't offer a disclosure
  // that opens onto an empty box.
  const hasDetail =
    hasMoney ||
    member !== null ||
    candidate.website_url !== null ||
    candidate.hq_city !== null;

  const summary = (
    <>
      <span className="candidate-identity">
        <strong>{candidate.full_name}</strong>
        {candidate.incumbent ? (
          <span className="candidate-incumbent">Incumbent</span>
        ) : null}
      </span>
      {hasMoney ? (
        <span className="candidate-money">{formatMoney(receipts)} raised</span>
      ) : (
        <span className="candidate-nomoney">No money reported</span>
      )}
    </>
  );

  if (!hasDetail) {
    return <li className="candidate-row candidate-row-static">{summary}</li>;
  }

  return (
    <li className={`candidate-row${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="candidate-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>

      <div className="candidate-detail" id={panelId} hidden={!open}>
        {member?.photo_url ? (
          <img
            className="candidate-photo"
            src={member.photo_url}
            alt=""
            width={90}
            height={110}
            loading="lazy"
            // Public-domain headshots hosted on GitHub Pages. If one is
            // missing the row reads fine without it, so drop the element
            // rather than leaving a broken-image icon.
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : null}

        <div className="candidate-facts">
          {/* A sitting member running for a different seat gets their
            * record shown, so say which seat that record is for —
            * otherwise the tenure and bill counts read as if they
            * already hold the one being contested. */}
          {member && !candidate.incumbent ? (
            <p className="candidate-currently">
              Currently serves in the U.S.{" "}
              {member.district !== null
                ? `House, District ${member.district}`
                : "Senate"}{" "}
              — not this seat.
            </p>
          ) : null}

          {member ? (
            <dl className="candidate-stats">
              {member.in_office_since ? (
                <div>
                  <dt>In office since</dt>
                  <dd>{member.in_office_since}</dd>
                </div>
              ) : null}
              {member.leadership_role ? (
                <div>
                  <dt>Leadership</dt>
                  <dd>{member.leadership_role}</dd>
                </div>
              ) : null}
              {member.sponsored_count !== null ? (
                <div>
                  <dt>Bills sponsored</dt>
                  <dd>{member.sponsored_count.toLocaleString("en-US")}</dd>
                </div>
              ) : null}
              {member.cosponsored_count !== null ? (
                <div>
                  <dt>Cosponsored</dt>
                  <dd>{member.cosponsored_count.toLocaleString("en-US")}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}

          {member?.policy_areas ? (
            <p className="candidate-policy">
              <span className="candidate-policy-label">Files bills about</span>{" "}
              {member.policy_areas}
              <span className="candidate-caveat">
                Subjects of their recent bills — not positions on them.
              </span>
            </p>
          ) : null}

          {hasMoney ? (
            <div className="candidate-finance">
              <dl className="candidate-stats">
                <div>
                  <dt>Raised</dt>
                  <dd>{formatMoney(receipts)}</dd>
                </div>
                {candidate.disbursements !== null ? (
                  <div>
                    <dt>Spent</dt>
                    <dd>{formatMoney(candidate.disbursements)}</dd>
                  </div>
                ) : null}
                {candidate.cash_on_hand !== null ? (
                  <div>
                    <dt>Cash on hand</dt>
                    <dd>{formatMoney(candidate.cash_on_hand)}</dd>
                  </div>
                ) : null}
                {candidate.pac_contributions !== null && receipts > 0 ? (
                  <div>
                    <dt>From PACs</dt>
                    <dd>{percent(candidate.pac_contributions, receipts)}</dd>
                  </div>
                ) : null}
              </dl>
              {candidate.coverage_end_date ? (
                <p className="candidate-asof">
                  FEC filings through {formatAsOf(candidate.coverage_end_date)}
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="candidate-links">
            {candidate.website_url ? (
              <a
                href={candidate.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {member ? "Official site" : "Campaign site"}
              </a>
            ) : null}
            {member?.phone ? <span>{member.phone}</span> : null}
            {candidate.hq_city ? (
              <span>
                {candidate.hq_city}
                {candidate.hq_state ? `, ${candidate.hq_state}` : ""}
              </span>
            ) : null}
          </p>
        </div>
      </div>
    </li>
  );
}
