"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { PROJECT_GROUPS, RESUME } from "./menu-data";

type SectionId = "about" | "resume" | "projects" | "contact";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "about", label: "About" },
  { id: "resume", label: "Resume" },
  { id: "projects", label: "Projects" },
  { id: "contact", label: "Contact" },
];

export default function MainMenu() {
  const [active, setActive] = useState<SectionId>("about");
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Every section opens at its top. The panel is the scroll container on
  // desktop and the window is on mobile, so both are reset — without this,
  // scrolling deep into the resume left Projects opening mid-list.
  const open = useCallback((id: SectionId) => {
    setActive(id);
    panelRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

  const move = useCallback(
    (next: number) => {
      // Wrap at both ends, the way every game menu since the cartridge era has.
      const wrapped = (next + SECTIONS.length) % SECTIONS.length;
      open(SECTIONS[wrapped].id);
      itemRefs.current[wrapped]?.focus();
    },
    [open],
  );

  const handleKeyDown = (event: React.KeyboardEvent, i: number) => {
    const keys: Record<string, number> = {
      ArrowDown: i + 1,
      ArrowRight: i + 1,
      ArrowUp: i - 1,
      ArrowLeft: i - 1,
      Home: 0,
      End: SECTIONS.length - 1,
    };
    if (!(event.key in keys)) return;
    event.preventDefault();
    move(keys[event.key]);
  };

  return (
    <div className="menu-screen">
      <div className="menu-panel" id="menu-panel" aria-live="polite" ref={panelRef}>
        {/* Every section is in the DOM and the inactive ones are `hidden`,
            rather than mounted on demand. Visually identical — but the server
            HTML now carries the whole resume, project list and contact card,
            so a crawler or a no-JS agent reads the full page instead of just
            the About blurb. */}
        <div hidden={active !== "about"}>
          <AboutSection />
        </div>
        <div hidden={active !== "resume"}>
          <ResumeSection />
        </div>
        <div hidden={active !== "projects"}>
          <ProjectsSection />
        </div>
        <div hidden={active !== "contact"}>
          <ContactSection />
        </div>
      </div>

      <nav className="menu-nav" aria-label="Main menu">
        <div className="menu-identity">
          <h1>Richard Fleming</h1>
        </div>

        <ul className="menu-list">
          {SECTIONS.map((section, i) => {
            const isActive = section.id === active;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  ref={(node) => {
                    itemRefs.current[i] = node;
                  }}
                  className={`menu-item${isActive ? " selected" : ""}`}
                  // Roving tabindex: the menu is one tab stop, arrows move
                  // inside it, the contract a gamepad gives you.
                  tabIndex={isActive ? 0 : -1}
                  aria-current={isActive ? "true" : undefined}
                  aria-controls="menu-panel"
                  onKeyDown={(event) => handleKeyDown(event, i)}
                  onClick={() => open(section.id)}
                  onFocus={() => open(section.id)}
                >
                  <span className="menu-arrow" aria-hidden="true">
                    ▸
                  </span>
                  <span className="menu-label">{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <p className="gd-credit">
        Menu backdrop and icons inspired by <strong>Geometry Dash</strong>. All
        artwork here is drawn from scratch. Special thanks to RobTop Games.
      </p>
    </div>
  );
}

function AboutSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">About</p>
      <div className="about-body">
        <div className="menu-portrait" aria-hidden="true" />
        <div>
          {/* The about from the pre-menu site, kept short on purpose. */}
          <h2>I like projects with a little bit of data and a little bit of personality.</h2>
          <p className="menu-blurb">
            Currently at Brown. Reach me at{" "}
            <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResumeSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">Resume</p>
      <h2>Education &amp; experience</h2>

      <h3 className="resume-heading">Education</h3>
      <ul className="resume-list">
        {RESUME.education.map((row) => (
          <li key={row.place}>
            <span className="resume-place">{row.place}</span>
            <span className="resume-when">{row.when}</span>
            <p className="menu-blurb">{row.detail}</p>
          </li>
        ))}
      </ul>

      <h3 className="resume-heading">Experience</h3>
      <ul className="resume-list">
        {RESUME.experience.map((row) => (
          <li key={row.place}>
            <span className="resume-place">{row.place}</span>
            <span className="resume-when">{row.when}</span>
            <p className="menu-blurb">{row.detail}</p>
          </li>
        ))}
      </ul>

      <h3 className="resume-heading">Skills</h3>
      <div className="tag-row">
        {RESUME.skills.map((skill) => (
          <span key={skill}>{skill}</span>
        ))}
      </div>

      {/* Points at a file that isn't committed yet, drop resume.pdf into
          public/ and this starts working with no code change. */}
      <a className="menu-open" href="/resume.pdf" download>
        Download PDF
      </a>
    </div>
  );
}

function ProjectsSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">Projects</p>
      <h2>Things I&apos;ve built</h2>

      {PROJECT_GROUPS.map((group) => (
        <section className="project-group" key={group.title}>
          <h3 className="resume-heading">{group.title}</h3>
          <ul className="project-list">
            {group.items.map((item) => (
              <li className="project-row" key={item.label}>
                <div className="project-row-head">
                  <span className="project-row-name">{item.label}</span>
                  <span className="menu-meta">{item.meta}</span>
                </div>
                <p className="menu-blurb">{item.blurb}</p>
                <div className="tag-row">
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                {item.href ? (
                  <Link className="menu-open" href={item.href}>
                    Open
                  </Link>
                ) : (
                  <p className="menu-locked">No write-up yet</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ContactSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">Contact</p>
      <h2>Get in touch</h2>
      <ul className="contact-list">
        <li>
          <span className="menu-meta">Email</span>
          <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
        </li>
        <li>
          {/* Just the one word — the profile slug read as clutter here. */}
          <a
            href="https://www.linkedin.com/in/tito-fleming/"
            target="_blank"
            rel="noopener noreferrer"
          >
            LinkedIn
          </a>
        </li>
        <li>
          <span className="menu-meta">GitHub</span>
          <a href="https://github.com/TitusFleming" target="_blank" rel="noopener noreferrer">
            @TitusFleming
          </a>
        </li>
      </ul>
    </div>
  );
}
