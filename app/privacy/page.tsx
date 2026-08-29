import InfoPage, { infoMetadata } from "../info-page";

export const metadata = infoMetadata("/privacy");

export default function PrivacyPage() {
  return <InfoPage path="/privacy" />;
}
