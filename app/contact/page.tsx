import InfoPage, { infoMetadata } from "../info-page";

export const metadata = infoMetadata("/contact");

export default function ContactPage() {
  return (
    <InfoPage path="/contact">
      {/* The channels as real links, on top of the prose from site.ts. */}
      <ul>
        <li>
          Email: <a href="mailto:richard_fleming@brown.edu">richard_fleming@brown.edu</a>
        </li>
        <li>
          LinkedIn:{" "}
          <a href="https://www.linkedin.com/in/tito-fleming/" rel="noopener noreferrer">
            linkedin.com/in/tito-fleming
          </a>
        </li>
        <li>
          GitHub:{" "}
          <a href="https://github.com/TitusFleming" rel="noopener noreferrer">
            github.com/TitusFleming
          </a>
        </li>
      </ul>
    </InfoPage>
  );
}
