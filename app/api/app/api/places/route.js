import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req) {
  try {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY (set it in Vercel env vars)" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(req.url);
    const input = (searchParams.get("input") || "").trim();

    if (input.length < 3) {
      return NextResponse.json({ predictions: [] });
    }

    // Bias results toward Chicago area (optional, but helpful)
    const chicago = { lat: 41.8781, lng: -87.6298 };
    const radiusMeters = 50000; // ~31 miles

    const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
    url.searchParams.set("input", input);
    url.searchParams.set("key", key);

    // US-only (optional)
    url.searchParams.set("components", "country:us");

    // Bias to Chicago (optional)
    url.searchParams.set("location", `${chicago.lat},${chicago.lng}`);
    url.searchParams.set("radius", String(radiusMeters));

    // Returns a list of suggestions (no full address details yet)
    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json(
        { error: "Places error", status: data.status, message: data.error_message },
        { status: 400 }
      );
    }

    // Keep only what the UI needs
    const predictions = (data.predictions || []).map((p) => ({
      description: p.description,
      place_id: p.place_id,
    }));

    return NextResponse.json({ predictions });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}
