<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Tito Fleming — Personal Website

Richard "Tito" Fleming's personal portfolio site. Built with Next.js App Router, React 19, TypeScript, and Tailwind CSS v4.

## Tech Stack

- **Next.js 16.2.6** — App Router only (`app/` directory). No Pages Router.
- **React 19.2.4**
- **TypeScript**
- **Tailwind CSS v4** — imported as `@import "tailwindcss"`. The old `@tailwind base/components/utilities` directive syntax does not exist in v4.
- **pnpm** — use `pnpm` for all package management, not `npm` or `yarn`

## Commands

```bash
pnpm dev      # Dev server at localhost:3000
pnpm build    # Production build
pnpm lint     # ESLint
```

## File Structure

```
app/
  layout.tsx                  # Root layout — metadata lives here
  page.tsx                    # Homepage: hero, project grid, about section
  globals.css                 # All styles — custom CSS classes and CSS variables
  projects/
    epl-brief/
      page.tsx                # EPL Brief project page
      team-pulse.tsx          # TeamPulse client component
  api/
    epl-brief/
      route.ts                # API route — fetches from FPL public API, no auth needed
public/
  profile-picture.png         # Portrait used in the hero section
```

## Styling Conventions

All styles live in `app/globals.css`. The pattern is **named CSS classes**, not scattered Tailwind utility classes.

- Add styles to `globals.css` using semantic class names (`.project-card`, `.hero`, `.pulse-controls`)
- Use CSS custom properties for color: `var(--brown)`, `var(--card)`, `var(--muted)`, `var(--line)`, `var(--tan)`, `var(--background)`, `var(--foreground)`
- Body/UI font: `Arial, Helvetica, sans-serif`. Label/mono font: `"SFMono-Regular", Consolas, "Liberation Mono", monospace`
- Tailwind utilities are only used sparingly for top-level layout in `page.tsx` (e.g. `min-h-screen`, `mx-auto`). Do not add Tailwind utilities throughout components.

## Adding a Project

The `projects` array at the top of `app/page.tsx` drives the project grid. Each entry takes:
- `title`, `type`, `status`, `description` — display copy
- `href` — internal path if a page exists, or `""` if not yet live
- `tags` — array of tech/topic strings

For a project with its own page, create `app/projects/<slug>/page.tsx`.

## API Routes

- Use `export const dynamic = "force-dynamic"` to opt out of caching on any route that fetches live data
- The EPL Brief route calls the Fantasy Premier League public API — no API keys or `.env` needed

## Other Notes

- No `.env` file — no secrets in this project
- No test suite configured
- Deploy target: Vercel
