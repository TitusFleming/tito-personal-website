"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { BLOG_SERIES } from "./blog-data";
import { PROJECT_GROUPS, RESUME } from "./menu-data";

type SectionId = "about" | "resume" | "projects" | "blog" | "contact";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "about", label: "About" },
  { id: "resume", label: "Resume" },
  { id: "projects", label: "Projects" },
  { id: "blog", label: "Blog" },
  { id: "contact", label: "Contact" },
];

export default function MainMenu() {
  const [active, setActive] = useState<SectionId>("about");
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const move = useCallback((next: number) => {
    // Wrap at both ends, the way every game menu since the cartridge era has.
    const wrapped = (next + SECTIONS.length) % SECTIONS.length;
    setActive(SECTIONS[wrapped].id);
    itemRefs.current[wrapped]?.focus();
  }, []);

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
      <div className="menu-panel" id="menu-panel" aria-live="polite">
        {/* All four sections render into the HTML and the inactive ones are
            hidden, rather than not being rendered at all. Visually identical,
            one panel at a time, but it means a crawler or an AI summarising
            this page sees every project, the resume and the contact details.
            Rendering only the active panel meant a summary of the site could
            only ever describe whichever one happened to be open. */}
        <div hidden={active !== "about"}>
          <AboutSection />
        </div>
        <div hidden={active !== "resume"}>
          <ResumeSection />
        </div>
        <div hidden={active !== "projects"}>
          <ProjectsSection />
        </div>
        <div hidden={active !== "blog"}>
          <BlogSection />
        </div>
        <div hidden={active !== "contact"}>
          <ContactSection />
        </div>
      </div>

      <nav className="menu-nav" aria-label="Main menu">
        <div className="menu-identity">
          <h1>Richard &quot;Tito&quot; Fleming</h1>
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
                  onClick={() => setActive(section.id)}
                  onFocus={() => setActive(section.id)}
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
          <p className="menu-blurb">
            Computer science at Brown, in Providence.
          </p>
          <p className="menu-blurb">
            This past summer I was a Digital Tools Intern at Cummins, at its
            global headquarters in Columbus, Indiana, working with the Guidanz
            team at the Fuel Systems facility. Over ten weeks I built an
            AI-powered diagnostic feature for the Guidanz mobile app that lets
            service technicians ask questions about ECM fault codes in plain
            language, instead of working from raw diagnostic output alone. I
            wrote it in Android Studio in Java and C++, integrating OpenAI
            ChatKit into the existing Guidanz workflow.
          </p>
          <p className="menu-blurb">
            It reaches technicians across more than 13,000 certified dealer
            locations and 640 distributors. Ten weeks of being the least
            experienced person in almost every room turned out to be exactly
            what I needed.
          </p>
          <p className="menu-blurb">
            Before that, retirement cohort models in Snowflake at Fidelity.
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
                {item.does ? <p className="menu-blurb">{item.does}</p> : null}
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

function BlogSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">Blog</p>
      <h2>{BLOG_SERIES.title}</h2>
      <p className="menu-blurb">{BLOG_SERIES.tagline}</p>

      <ul className="project-list">
        {BLOG_SERIES.posts.map((post) => (
          <li className="project-row" key={post.slug}>
            <div className="project-row-head">
              <span className="project-row-name">{post.title}</span>
              <span className="menu-meta">{post.meta}</span>
            </div>
            <p className="menu-blurb">{post.blurb}</p>
            <Link className="menu-open" href={`/blog/ai-fundamentals/${post.slug}`}>
              Read
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactSection() {
  return (
    <div className="menu-section">
      <p className="eyebrow">Contact</p>
      <h2>Get in touch</h2>
      <p className="menu-blurb">
        Say hello, or ask about anything on this menu.
      </p>
      <ul className="contact-list">
        <li>
          <span className="menu-meta">Email</span>
          <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
        </li>
        <li>
          <span className="menu-meta">LinkedIn</span>
          <a
            href="https://www.linkedin.com/in/tito-fleming/"
            target="_blank"
            rel="noopener noreferrer"
          >
            /in/tito-fleming
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
