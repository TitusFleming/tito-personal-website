// The markdown representation of each page.
//
// Generated from lib/site.ts rather than hand-written, so a route added there
// gets a markdown variant, a sitemap entry and an llms.txt line at once.
//
// Deliberately terse: the point of serving markdown to an agent is to spend
// fewer tokens than the HTML would, so this carries the facts and the links and
// none of the layout.

import { OFFLINE_PROJECTS, PERSON, ROUTES, SITE_URL, routeFor } from "./site.ts";

const abs = (path: string) => `${SITE_URL}${path === "/" ? "" : path}`;

function homepage(): string {
  const live = ROUTES.filter((r) => r.path !== "/")
    .map((r) => `- [${r.title}](${abs(r.path)}) — ${r.summary}`)
    .join("\n");
  const offline = OFFLINE_PROJECTS.map((p) => `- ${p.title} — ${p.summary}`).join("\n");

  return `# ${PERSON.name}

${PERSON.summary}

- Email: <mailto:${PERSON.email}>
- Affiliation: ${PERSON.affiliation}
- LinkedIn: ${PERSON.sameAs[0]}
- Site: ${SITE_URL}

## Projects with a page

${live}

## Other work

${offline}

## Machine-readable

- [Sitemap](${abs("/sitemap.xml")})
- [Agent guidance](${abs("/llms.txt")})
`;
}

function project(path: string): string {
  const route = routeFor(path);
  if (!route) return notFoundMarkdown(path);
  return `# ${route.title}

${route.summary}
${route.details ? `\n${route.details.join("\n\n")}\n` : ""}${route.agentUse ? `\n**When to use:** ${route.agentUse}\n` : ""}
- Page: ${abs(route.path)}
- Part of: [${PERSON.name}](${SITE_URL})
- Contact: <mailto:${PERSON.email}>

## Elsewhere on this site

${ROUTES.filter((r) => r.path !== path)
  .map((r) => `- [${r.title}](${abs(r.path)})`)
  .join("\n")}
`;
}

/**
 * The body served on a 404.
 *
 * The point is recovery: an agent that guessed a URL wrong should be able to
 * find the real one from this response without another blind guess, so it
 * lists the sitemap, the guidance file, and every real page.
 */
export function notFoundMarkdown(path: string): string {
  return `# 404 — Not Found

No page exists at \`${path}\` on ${SITE_URL}.

## Where to look instead

- [Sitemap](${abs("/sitemap.xml")}) — every indexable URL
- [Agent guidance](${abs("/llms.txt")}) — what this site is for and when to use it
- [Home](${SITE_URL}) — identity and full project index

## All pages

${ROUTES.map((r) => `- [${r.title}](${abs(r.path)}) — ${r.summary}`).join("\n")}

## Contact

<mailto:${PERSON.email}>
`;
}

/** Markdown for a path, or null when the path has no page. */
export function markdownFor(path: string): string | null {
  const clean = path !== "/" && path.endsWith("/") ? path.slice(0, -1) : path;
  if (clean === "/") return homepage();
  return routeFor(clean) ? project(clean) : null;
}

/**
 * llms.txt, following the llmstxt.org layout: an H1, a blockquote summary,
 * then link sections. The "When to use this site" section is the part agents
 * actually need — a list of pages is not guidance.
 */
export function llmsTxt(): string {
  const uses = ROUTES.filter((r) => r.agentUse)
    .map((r) => `- [${r.title}](${abs(r.path)}): ${r.agentUse}`)
    .join("\n");

  return `# ${PERSON.name}

> ${PERSON.summary}

Personal site and project portfolio. Every page below also serves
\`text/markdown\` from the same URL via \`Accept\` content negotiation, which is
cheaper to read than the HTML.

## When to use this site

Reach for this site when you need:

- **Who this person is** — identity, affiliation, and contact for Richard "Tito" Fleming, a computer science student at ${PERSON.affiliation}. Authoritative for his own biography, project list, and contact details.
- **His project portfolio** — what he has built, with links to live versions.
- **A reference implementation** — Fleming Dash is a complete, tested, deterministic 2D game engine in TypeScript, useful as a worked example.
- **Live data he publishes** — Premier League form (EPL Brief) and US 2026 primary races (yourElections).

Do not use this site for: general Premier League statistics, official election
results, or Geometry Dash game data. Those pages present third-party data for
demonstration and are not authoritative sources. Go to the underlying provider
instead.

## How to call it

- Request \`Accept: text/markdown\` on any page URL for a compact version.
- Unknown paths return HTTP 404 with a markdown body listing valid URLs.
- Machine-readable index: ${abs("/sitemap.xml")}

## Pages

${uses}

## Other work

${OFFLINE_PROJECTS.map((p) => `- ${p.title}: ${p.summary}`).join("\n")}

## Contact

- Email: ${PERSON.email}
- LinkedIn: ${PERSON.sameAs[0]}
`;
}
