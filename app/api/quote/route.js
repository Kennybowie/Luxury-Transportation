import { NextResponse } from "next/server";

function roundUp(value, step) {
  return Math.ceil(value / step) * step;
}

export async function POST(req) {
  try {
    const { pickup, dropoff } = await req.json();

    if (!pickup || !dropoff) {
      return NextResponse.json({ error: "Missing addresses" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const origin = process.env.BASE_ORIGIN_ADDRESS || "South Side Chicago";

    const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
    url.searchParams.set("origin", origin);
    url.searchParams.set("destination", dropoff);
    url.searchParams.set("waypoints", pickup);
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        { error: "Route error", details: data.status, message: data.error_message },
        { status: 400 }
      );
    }

    const seconds = data.routes[0].legs.reduce(
      (sum, leg) => sum + leg.duration.value,
      0
    );

    const minutes = Math.round(seconds / 60);

    const hourlyRate = Number(process.env.HOURLY_RATE || 40);
    const buffer = Number(process.env.BUFFER_MINUTES || 10);
    const rounding = Number(process.env.ROUNDING_MINUTES || 15);
    const minimum = Number(process.env.MINIMUM_MINUTES || 60);

    const billableMinutes = Math.max(minimum, roundUp(minutes + buffer, rounding));
    const price = (billableMinutes / 60) * hourlyRate;

    return NextResponse.json({ billableMinutes, price });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
