import InfoPage, { infoMetadata } from "../info-page";

export const metadata = infoMetadata("/about");

export default function AboutPage() {
  return <InfoPage path="/about" />;
}
