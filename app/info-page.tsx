import Link from "next/link";
import type { Metadata } from "next";

import { PERSON, ROUTES, SITE_URL, routeFor } from "../lib/site.ts";

/**
 * The shared shell for the trust-anchor pages (/about, /contact, /privacy).
 *
 * Content comes from the route's own `details` in lib/site.ts — the same
 * paragraphs the markdown variant serves — so the HTML page and the markdown
 * answer can never disagree. Each page component is just this shell plus its
 * path and any extra structured links.
 */
export function infoMetadata(path: string): Metadata {
  const route = routeFor(path);
  if (!route) throw new Error(`No route for ${path}`);
  return {
    title: `${route.title} | ${PERSON.name}`,
    description: route.summary,
    alternates: { canonical: path },
  };
}

export default function InfoPage({
  path,
  children,
}: {
  path: string;
  children?: React.ReactNode;
}) {
  const route = routeFor(path);
  if (!route) throw new Error(`No route for ${path}`);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label={`${PERSON.name} home`}>
            RTF
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/">Home</Link>
            {ROUTES.filter((r) => r.info && r.path !== path).map((r) => (
              <Link key={r.path} href={r.path}>
                {r.path === "/about" ? "About" : r.path === "/contact" ? "Contact" : "Privacy"}
              </Link>
            ))}
          </nav>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">{PERSON.name}</p>
            <h1>{route.title}</h1>
            <p className="lede">{route.summary}</p>
          </div>
        </section>

        <section className="section-block" aria-label={route.title}>
          <div className="mini-section">
            {route.details?.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
            {children}
          </div>
        </section>

        <footer>
          <a href={`mailto:${PERSON.email}`}>{PERSON.email}</a>
          <a href={SITE_URL}>richard-fleming.com</a>
        </footer>
      </div>
    </main>
  );
}
