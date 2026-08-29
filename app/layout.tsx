import type { Metadata } from "next";
import "./globals.css";

const SITE = "https://www.richard-fleming.com";
const DESCRIPTION =
  "Computer science student at Brown. Built an LLM fault-code assistant for diesel technicians at Cummins, retirement cohort models at Fidelity, and interactive projects across civic tech, sports data and browser games.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: 'Richard "Tito" Fleming',
  description: DESCRIPTION,
  // Without these, sharing the link anywhere shows a bare URL with no title or
  // summary. Worth having on a site people are sent before a conversation.
  openGraph: {
    title: 'Richard "Tito" Fleming',
    description: DESCRIPTION,
    url: SITE,
    siteName: 'Richard "Tito" Fleming',
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: 'Richard "Tito" Fleming',
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
