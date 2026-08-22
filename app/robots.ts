import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site.ts";

/**
 * /robots.txt. Points crawlers and agents at the sitemap, which is how most
 * of them discover it — a sitemap nothing links to is easily missed.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
