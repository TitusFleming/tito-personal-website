import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Hardcoded allowlist of backend paths this proxy will forward. Anything
// else 404s, so this can never become an open proxy to the backend.
const ALLOWED_PATHS: RegExp[] = [
  /^map\/overview$/,
  /^map\/state\/[A-Za-z]{2}$/,
  /^elections\/district\/[A-Za-z]{2}\/\d{1,2}$/,
  /^elections\/statewide\/[A-Za-z]{2}$/,
];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const joined = path.join("/");

  if (!ALLOWED_PATHS.some((pattern) => pattern.test(joined))) {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "Elections backend is not configured." },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${backendUrl.replace(/\/$/, "")}/${joined}`, {
      cache: "no-store",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        detail:
          "The elections backend is unreachable. It may still be waking up, try again in a few seconds.",
      },
      { status: 502 },
    );
  }
}
