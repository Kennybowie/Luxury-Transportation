import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;

    if (!key) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const input = (searchParams.get("input") || "").trim();

    if (input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    // Bias results toward Chicago
    const chicagoLat = 41.8781;
    const chicagoLng = -87.6298;
    const radiusMeters = 50000; // ~30 miles

    const url = new URL(
      "https://maps.googleapis.com/maps/api/place/autocomplete/json"
    );

    url.searchParams.set("input", input);
    url.searchParams.set("key", key);
    url.searchParams.set("components", "country:us");
    url.searchParams.set("location", `${chicagoLat},${chicagoLng}`);
    url.searchParams.set("radius", radiusMeters.toString());

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        {
          error: "Places API error",
          status: data.status,
          message: data.error_message,
        },
        { status: 400 }
      );
    }

    const predictions = (data.predictions || []).map((p) => ({
      description: p.description,
      place_id: p.place_id,
    }));

    return NextResponse.json({ predictions });
  } catch (err) {
    return NextResponse.json(
      { error: "Server error", message: err?.message },
      { status: 500 }
    );
  }
}
