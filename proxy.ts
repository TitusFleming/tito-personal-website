// Accept-header content negotiation, per acceptmarkdown.com.
//
// Runs before routing, so a single file gives every page a markdown variant at
// its own URL without touching any page component. The decision itself lives in
// lib/accept.ts, which is pure and unit tested; this only carries out the
// result and sets the headers.
//
// WHY THE VARY HEADER MATTERS HERE
// Two different bodies are served from one URL. Without `Vary: Accept` a CDN
// caches whichever variant it saw first and hands it to everyone — so a browser
// can get markdown, or an agent can get HTML, depending purely on who arrived
// first. Every negotiated response below carries it.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { mentionsMarkdown, negotiate } from "./lib/accept.ts";
import { markdownFor, notFoundMarkdown } from "./lib/markdown.ts";

const MARKDOWN = "text/markdown; charset=utf-8";

function markdownResponse(body: string, status: number): NextResponse {
  return new NextResponse(body, {
    status,
    headers: {
      "Content-Type": MARKDOWN,
      // Accept-Encoding too: the response is compressed, so the cache key must
      // account for both dimensions.
      Vary: "Accept, Accept-Encoding",
    },
  });
}

export function proxy(request: NextRequest): NextResponse {
  const accept = request.headers.get("accept");
  const { pathname } = request.nextUrl;
  const wanted = negotiate(accept);

  // Nothing the client will accept can be served here.
  if (wanted === "none") {
    const body = mentionsMarkdown(accept)
      ? notFoundMarkdown(pathname)
      : "406 Not Acceptable. This URL serves text/html and text/markdown.\n";
    return new NextResponse(body, {
      status: 406,
      headers: {
        "Content-Type": mentionsMarkdown(accept) ? MARKDOWN : "text/plain; charset=utf-8",
        Vary: "Accept, Accept-Encoding",
      },
    });
  }

  if (wanted === "markdown") {
    const body = markdownFor(pathname);
    // A missing page still answers in markdown, and still with a 404 — an agent
    // that guessed wrong gets the real URL list rather than a bare status.
    return body === null
      ? markdownResponse(notFoundMarkdown(pathname), 404)
      : markdownResponse(body, 200);
  }

  // HTML: let the page render.
  //
  // KNOWN LIMITATION. Next writes its own `Vary` for App Router responses
  // (rsc, next-router-*) and that write lands last, so `Vary: Accept` cannot be
  // added to an HTML response from here — set, append and next.config headers()
  // were all tried and all are overwritten.
  //
  // This does not affect compliance: acceptmarkdown.com inspects the response
  // to an `Accept: text/markdown` request, and every markdown response above
  // carries `Vary: Accept, Accept-Encoding`. Nor does it affect correctness on
  // this deployment, because the proxy runs ahead of the CDN cache and answers
  // markdown requests itself rather than letting a cached HTML variant serve
  // them. If Next ever stops clobbering the header, add it back here.
  return NextResponse.next();
}

export const config = {
  // Page routes only. API routes negotiate their own content types, and static
  // assets are not markdown-negotiable.
  matcher: [
    "/((?!api/|_next/|favicon\\.png|sitemap\\.xml|robots\\.txt|llms\\.txt|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|mp3|json|txt|xml|webmanifest)$).*)",
  ],
};
