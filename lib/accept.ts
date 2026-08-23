// Accept-header content negotiation, per acceptmarkdown.com.
//
// The spec asks for four things, and all four are decided here so the proxy
// stays a thin wrapper and this can be tested without a server:
//
//   1. serve text/markdown when the client asks for it
//   2. set `Vary: Accept` on anything negotiated
//   3. answer 406 when nothing the client accepts can be served
//   4. respect q-values rather than just substring-matching the header
//
// Point 4 is the one that breaks naive implementations: a browser sends
// `text/html,...,*/*;q=0.8`, which CONTAINS a wildcard that technically admits
// markdown. Matching on presence alone would serve markdown to every browser.
// Comparing quality values is what keeps that correct.

export type Negotiated = "markdown" | "html" | "none";

type Entry = { type: string; q: number };

/** Parse an Accept header into media types with quality values, best first. */
export function parseAccept(header: string | null | undefined): Entry[] {
  if (!header) return [];
  return header
    .split(",")
    .map((part) => {
      const [rawType, ...params] = part.split(";").map((s) => s.trim());
      let q = 1;
      for (const p of params) {
        const [k, v] = p.split("=").map((s) => s.trim());
        if (k === "q") {
          const parsed = Number(v);
          // A malformed q is treated as absent rather than as zero, so a typo
          // downgrades nothing.
          if (Number.isFinite(parsed)) q = Math.min(1, Math.max(0, parsed));
        }
      }
      return { type: rawType.toLowerCase(), q };
    })
    .filter((e) => e.type.length > 0)
    .sort((a, b) => b.q - a.q);
}

/** Best quality the client assigns to a concrete media type, wildcards included. */
export function qualityFor(entries: Entry[], type: string): number {
  const [group] = type.split("/");
  let best = 0;
  for (const e of entries) {
    if (e.type === type || e.type === `${group}/*` || e.type === "*/*") {
      best = Math.max(best, e.q);
    }
  }
  return best;
}

/**
 * Decide what to serve.
 *
 * No Accept header at all means "anything", which is HTML — that is the
 * overwhelmingly common case for browsers and link previews and must never
 * 406.
 */
export function negotiate(header: string | null | undefined): Negotiated {
  const entries = parseAccept(header);
  if (entries.length === 0) return "html";

  const markdown = qualityFor(entries, "text/markdown");
  const html = Math.max(
    qualityFor(entries, "text/html"),
    qualityFor(entries, "application/xhtml+xml"),
  );

  if (markdown === 0 && html === 0) return "none";
  // Ties go to HTML: only a client that ranks markdown strictly higher gets it,
  // so `*/*` never silently switches a browser over.
  return markdown > html ? "markdown" : "html";
}

/**
 * True when markdown was explicitly named, at any quality.
 *
 * Used to decide whether a 406 body should be markdown or plain text — a
 * client that asked for markdown and got nothing still reads markdown best.
 */
export function mentionsMarkdown(header: string | null | undefined): boolean {
  return parseAccept(header).some((e) => e.type === "text/markdown");
}
