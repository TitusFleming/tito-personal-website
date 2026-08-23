import type { MetadataRoute } from "next";
import { ROUTES, SITE_URL } from "../lib/site.ts";

/**
 * /sitemap.xml, generated from the shared route list.
 *
 * `lastModified` is the build time rather than a hand-maintained date: it is
 * accurate for a statically built site and cannot go stale the way a literal
 * would.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path === "/" ? "" : route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
