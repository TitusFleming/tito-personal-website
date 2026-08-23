import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const zip = searchParams.get("zip") ?? "";

  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json(
      { detail: "Zip code must be exactly 5 digits." },
      { status: 400 },
    );
  }

  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { detail: "Elections backend is not configured." },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${backendUrl.replace(/\/$/, "")}/elections?zip=${zip}`,
      { cache: "no-store" },
    );
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        detail:
          "The elections backend is unreachable. It may still be waking up; try again in a few seconds.",
      },
      { status: 502 },
    );
  }
}
