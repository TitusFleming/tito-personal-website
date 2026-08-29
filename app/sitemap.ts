import type { MetadataRoute } from "next";

const SITE = "https://www.richard-fleming.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/projects/cummins",
    "/projects/yourElections",
    "/projects/epl-brief",
    "/projects/gd-tier-game",
  ];
  return routes.map((route) => ({
    url: `${SITE}${route}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
