"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";

type MenuEntry = {
  id: string;
  label: string;
  meta: string;
  blurb: string;
  tags: string[];
  href?: string;
  external?: boolean;
};

const ENTRIES: MenuEntry[] = [
  {
    id: "cummins",
    label: "Big Cam",
    meta: "Internship · Digital tools",
    blurb:
      "An LLM fault-code assistant built at Cummins — and the 14-litre diesel from the lobby, rebuilt in code so you can pull it apart.",
    tags: ["Android", "Java", "LLM", "Three.js"],
    href: "/projects/cummins",
  },
  {
    id: "elections",
    label: "yourElections",
    meta: "Live project · Civic tech",
    blurb:
      "An interactive map of the 2026 primaries — click your state and district to see every race and candidate.",
    tags: ["Next.js", "FastAPI", "Postgres", "d3-geo"],
    href: "/projects/yourElections",
  },
  {
    id: "epl",
    label: "EPL Brief",
    meta: "Live project · Football data",
    blurb: "A Premier League team form tracker for fans who have not watched every match.",
    tags: ["Next.js", "Runtime API", "Football"],
    href: "/projects/epl-brief",
  },
  {
    id: "gddl",
    label: "GDDL Higher or Lower",
    meta: "Live project · Browser game",
    blurb:
      "Pick a tier range and guess which GD level ranks harder on the GDDL. Go until you get one wrong.",
    tags: ["Geometry Dash", "GDDL", "Browser game"],
    href: "/projects/gd-tier-game",
  },
  {
    id: "fidelity",
    label: "Retirement Cohort Models",
    meta: "Internship · Data systems",
    blurb: "Snowflake models for analyzing retirement customer behavior at Fidelity Investments.",
    tags: ["SQL", "Snowflake", "Analytics"],
  },
  {
    id: "battery",
    label: "Battery Storage Analysis",
    meta: "Research · Energy",
    blurb: "Feasibility and incentive research for a 400MWh battery energy storage project.",
    tags: ["Energy", "Markets", "Policy"],
  },
  {
    id: "about",
    label: "About",
    meta: "Brown University · Computer Science",
    blurb:
      "I like projects with a little bit of data and a little bit of personality. Currently at Brown, making software, data projects and technical experiments.",
    tags: [],
  },
  {
    id: "contact",
    label: "Contact",
    meta: "richard_fleming@brown.edu",
    blurb: "Say hello, or ask about anything on this menu.",
    tags: [],
    href: "mailto:richard_fleming@brown.edu",
    external: true,
  },
];

/** A pointer that can't hover has no way to preview an entry before committing
 *  to it, which is the whole point of this layout. Detected rather than
 *  guessed from width, because a touchscreen laptop is neither. */
const COARSE = "(pointer: coarse)";

function subscribeToPointer(onChange: () => void) {
  const query = window.matchMedia(COARSE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export default function MainMenu() {
  const [index, setIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const coarsePointer = useSyncExternalStore(
    subscribeToPointer,
    () => window.matchMedia(COARSE).matches,
    () => false,
  );

  const selected = ENTRIES[index];

  const move = useCallback((next: number) => {
    // Wrap around, the way every game menu since the cartridge era has.
    const wrapped = (next + ENTRIES.length) % ENTRIES.length;
    setIndex(wrapped);
    itemRefs.current[wrapped]?.focus();
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent, i: number) => {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(i + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(i - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      move(0);
    } else if (event.key === "End") {
      event.preventDefault();
      move(ENTRIES.length - 1);
    }
  };

  return (
    <div className="menu-screen">
      <div className="menu-side">
        <div className="menu-identity">
          <div className="menu-portrait" aria-hidden="true" />
          <p className="eyebrow">Richard &quot;Tito&quot; Fleming</p>
          <h1>Tito Fleming</h1>
        </div>

        <ul className="menu-list">
          {ENTRIES.map((entry, i) => {
            const isSelected = i === index;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  ref={(node) => {
                    itemRefs.current[i] = node;
                  }}
                  className={`menu-item${isSelected ? " selected" : ""}`}
                  // Roving tabindex: one stop for the whole menu, then arrows
                  // move within it — the same contract a game pad gives you.
                  tabIndex={isSelected ? 0 : -1}
                  aria-current={isSelected ? "true" : undefined}
                  aria-describedby="menu-preview"
                  onKeyDown={(event) => handleKeyDown(event, i)}
                  onMouseEnter={() => !coarsePointer && setIndex(i)}
                  onFocus={() => setIndex(i)}
                  onClick={() => setIndex(i)}
                >
                  <span className="menu-arrow" aria-hidden="true">
                    ▸
                  </span>
                  <span className="menu-label">{entry.label}</span>
                </button>

                {/* On touch the preview can't live in a side pane the user
                    never sees, so it unfolds under the highlighted row. */}
                {coarsePointer && isSelected ? (
                  <div className="menu-inline-preview">
                    <p className="menu-meta">{entry.meta}</p>
                    <p className="menu-blurb">{entry.blurb}</p>
                    <MenuAction entry={entry} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="menu-preview" id="menu-preview" aria-live="polite">
        <div className="menu-preview-inner">
          <p className="eyebrow">{selected.meta}</p>
          <h2>{selected.label}</h2>
          <p className="menu-blurb">{selected.blurb}</p>
          {selected.tags.length > 0 ? (
            <div className="tag-row">
              {selected.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
          <MenuAction entry={selected} />
        </div>
      </div>
    </div>
  );
}

function MenuAction({ entry }: { entry: MenuEntry }) {
  if (!entry.href) {
    return <p className="menu-locked">No write-up yet</p>;
  }
  if (entry.external) {
    return (
      <a className="menu-open" href={entry.href}>
        Open
      </a>
    );
  }
  return (
    <Link className="menu-open" href={entry.href}>
      Open
    </Link>
  );
}
