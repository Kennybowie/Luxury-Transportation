import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const pickup = (body.pickup || "").trim();
    const dropoff = (body.dropoff || "").trim();
    const stops = Array.isArray(body.stops)
      ? body.stops.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    if (!pickup || !dropoff) {
      return NextResponse.json({ error: "Missing addresses" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY in env vars" },
        { status: 500 }
      );
    }

    // ✅ Include base -> pickup time
    const base = (process.env.BASE_ORIGIN_ADDRESS || "South Side Chicago").trim();

    // Route: base -> pickup -> (stops...) -> dropoff
    const waypoints = [pickup, ...stops].filter(Boolean);

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", pickup);
    url.searchParams.set("destination", dropoff);
    if (stops.length > 0) {
      url.searchParams.set("waypoints", waypoints.join("|"));
    }
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        { error: "Route error", details: data.status, message: data.error_message },
        { status: 400 }
      );
    }

    const legs = data.routes?.[0]?.legs || [];
    const routeSeconds = legs.reduce((sum, leg) => sum + (leg.duration?.value || 0), 0);

    const bufferSeconds = Number(process.env.BUFFER_SECONDS || 0);
    const billableSeconds = Math.max(0, routeSeconds + bufferSeconds);

    const hourlyRate = Number(process.env.HOURLY_RATE || 40);
    const minimumCharge = Number(process.env.MINIMUM_CHARGE || 10);

    // ✅ Exact time-based price
    const rawPrice = (billableSeconds / 3600) * hourlyRate;

    // ✅ Minimum fare (dollar floor)
    const finalPrice = Math.max(minimumCharge, rawPrice);

    return NextResponse.json({
      routeSeconds,
      billableSeconds,
      routeMinutes: Math.round((routeSeconds / 60) * 10) / 10,
      price: Math.round(finalPrice * 100) / 100,
      minimumCharge,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}
