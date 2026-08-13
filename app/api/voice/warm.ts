// Shared by the three voice routes. Not a route itself — only route.ts files
// are endpoints, so this sits alongside them the way types.ts does in the
// yourElections project folder.

// Long enough to cross the Atlantic and back on a warm instance, short enough
// that a sleeping one fails fast. Twilio only gives the webhook ~15 seconds
// total, and a cold Render start takes ~30, so there is no waiting it out
// inside a single request — we detect and bridge instead.
const PROBE_TIMEOUT_MS = 2500;

export function voiceBaseUrl(): string | null {
  const url = process.env.VOICE_URL;
  return url ? url.replace(/\/$/, "") : null;
}

/** The wss:// address Twilio should stream the call to. */
export function voiceSocketUrl(base: string): string {
  return `${base.replace(/^http/, "ws")}/ws`;
}

/**
 * Is the voice service awake?
 *
 * Worth understanding before calling this: on Render's free tier *any* HTTP
 * request wakes a sleeping instance, so this probe is never free — a failed
 * probe is also the thing that starts the ~30s wake. That is deliberate on
 * the call path (we want the wake started the moment we learn it's asleep),
 * and it is exactly why nothing should poll this on page load. Instance-hours
 * are pooled across the whole Render workspace; a probe per page view would
 * quietly spend the budget that keeps the elections backend alive.
 */
export async function isWarm(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}
