import { llmsTxt } from "../../lib/markdown.ts";

/**
 * /llms.txt — agent guidance, per llmstxt.org.
 *
 * A route rather than a file in public/ so it is generated from the same route
 * list as the sitemap and the markdown variants, and cannot drift from them.
 */
export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsTxt(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
