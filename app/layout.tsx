import type { Metadata } from "next";
import "./globals.css";
import { PERSON, ROUTES, SITE_URL } from "../lib/site.ts";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: PERSON.name,
  description: PERSON.summary,
  alternates: { canonical: "/" },
  authors: [{ name: PERSON.name, url: SITE_URL }],
  creator: PERSON.name,
  keywords: [
    "Richard Fleming",
    "Tito Fleming",
    "Brown University",
    "computer science",
    "software portfolio",
  ],
  openGraph: {
    type: "profile",
    siteName: PERSON.name,
    title: PERSON.name,
    description: PERSON.summary,
    url: SITE_URL,
    locale: "en_US",
    // The og:image completes the four signals agents use for entity
    // resolution (canonical, lang, og:type, og:image).
    images: [
      {
        url: "/profile-picture.png",
        width: 688,
        height: 810,
        alt: `Portrait of ${PERSON.name}`,
      },
    ],
  },
  twitter: {
    card: "summary",
    title: PERSON.name,
    description: PERSON.summary,
    images: ["/profile-picture.png"],
  },
  robots: { index: true, follow: true },
};

/**
 * Identity as structured data, so an agent can establish who this site belongs
 * to without parsing prose. Person is the right type for a personal site;
 * `mainEntityOfPage` and `hasPart` tie the projects to that identity rather
 * than leaving them as loose links.
 */
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  "@id": `${SITE_URL}/#person`,
  name: PERSON.name,
  alternateName: PERSON.shortName,
  description: PERSON.summary,
  url: SITE_URL,
  email: `mailto:${PERSON.email}`,
  sameAs: [...PERSON.sameAs],
  affiliation: {
    "@type": "CollegeOrUniversity",
    name: PERSON.affiliation,
    url: "https://www.brown.edu",
  },
  knowsAbout: [
    "Software engineering",
    "Data systems",
    "Energy infrastructure",
    "Web development",
  ],
  mainEntityOfPage: {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: PERSON.name,
    inLanguage: "en-US",
  },
  // Info pages (about/contact/privacy) are site chrome, not creative works.
  hasPart: ROUTES.filter((r) => r.path !== "/" && !r.info).map((r) => ({
    "@type": "CreativeWork",
    name: r.title,
    abstract: r.summary,
    url: `${SITE_URL}${r.path}`,
  })),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
