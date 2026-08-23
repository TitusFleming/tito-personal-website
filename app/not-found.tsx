import Link from "next/link";
import { ROUTES, SITE_URL } from "../lib/site.ts";

export const metadata = {
  title: "Not found | Richard \"Tito\" Fleming",
  description: "No page exists at this address. Every page on the site is listed here.",
};

/**
 * The 404 page.
 *
 * Agents asking for `text/markdown` never reach this — proxy.ts answers them
 * with a markdown body and a 404 status. This is the human version, and it
 * carries the same recovery links so a crawler reading the HTML gets them too.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 lg:px-10">
        <header className="site-header">
          <Link className="site-mark" href="/" aria-label="Richard Tito Fleming home">
            RTF
          </Link>
          <nav aria-label="Primary navigation">
            <Link href="/#portfolio">Portfolio</Link>
            <Link href="/#about">About</Link>
            <a href="mailto:richard_fleming@brown.edu">Contact</a>
          </nav>
        </header>

        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">404</p>
            <h1>Page not found</h1>
            <p className="lede">
              No page exists at this address. Everything on the site is listed below.
            </p>
            <div className="hero-links">
              <Link href="/">Home</Link>
              <a href={`${SITE_URL}/sitemap.xml`}>Sitemap</a>
              <a href={`${SITE_URL}/llms.txt`}>llms.txt</a>
            </div>
          </div>
        </section>

        <section className="section-block" aria-labelledby="pages-title">
          <div className="section-heading">
            <p className="eyebrow">Index</p>
            <h2 id="pages-title">All pages</h2>
          </div>
          <div className="project-grid">
            {/* Info pages (about/contact/privacy) exist for agents doing
                due diligence; the human index doesn't advertise them. */}
            {ROUTES.filter((route) => !route.info).map((route) => (
              <Link className="project-card project-card-linked" href={route.path} key={route.path}>
                <h3>{route.title}</h3>
                <p>{route.summary}</p>
                <span className="project-link-cue">Open page</span>
              </Link>
            ))}
          </div>
        </section>

        <footer>
          <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
          <a href={SITE_URL}>richard-fleming.com</a>
        </footer>
      </div>
    </main>
  );
}
