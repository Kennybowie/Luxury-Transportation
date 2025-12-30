import { NextResponse } from "next/server";

export const runtime = "nodejs";

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

export async function POST(req) {
  try {
    const body = await req.json();

    const pickup = (body.pickup || "").trim();
    const dropoff = (body.dropoff || "").trim();
    const stops = Array.isArray(body.stops)
      ? body.stops.map((s) => String(s).trim()).filter(Boolean)
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

    // Base location (you can change in Vercel env vars)
    const origin = process.env.BASE_ORIGIN_ADDRESS || "South Side Chicago";

    // Route: origin -> pickup -> (stops...) -> dropoff
    const waypointsList = [pickup, ...stops].filter(Boolean);

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", dropoff);

    if (waypointsList.length > 0) {
      url.searchParams.set("waypoints", waypointsList.join("|"));
    }

    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        {
          error: "Route error",
          details: data.status,
          message: data.error_message,
        },
        { status: 400 }
      );
    }

    const legs = data.routes?.[0]?.legs || [];
    const seconds = legs.reduce(
      (sum, leg) => sum + (leg.duration?.value || 0),
      0
    );
    const minutes = Math.round(seconds / 60);

    // Pricing config
    const hourlyRate = Number(process.env.HOURLY_RATE || 40);
    const buffer = Number(process.env.BUFFER_MINUTES || 10);
    const rounding = Number(process.env.ROUNDING_MINUTES || 15);
    const minimum = Number(process.env.MINIMUM_MINUTES || 60);

    const billableMinutes = Math.max(minimum, roundUp(minutes + buffer, rounding));
    const price = (billableMinutes / 60) * hourlyRate;

    return NextResponse.json({
      billableMinutes,
      price,
      routeMinutes: minutes,
      stopsCount: stops.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}
