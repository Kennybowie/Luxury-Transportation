import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const pickup = (body.pickup || "").trim();
    const dropoff = (body.dropoff || "").trim();
    const stops = Array.isArray(body.stops)
      ? body.stops.map(s => String(s || "").trim()).filter(Boolean)
      : [];

    if (!pickup || !dropoff) {
      return NextResponse.json({ error: "Missing addresses" }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY" },
        { status: 500 }
      );
    }

    const hourlyRate = Number(process.env.HOURLY_RATE || 40);
    const minimumCharge = Number(process.env.MINIMUM_CHARGE || 10);

    // Use current time (traffic-aware)
    const departureTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const payload = {
      origin: { address: pickup },
      destination: { address: dropoff },
      intermediates: stops.map(a => ({ address: a })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime,
    };

    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration",
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await res.json();

    if (!res.ok || !data.routes?.[0]?.duration) {
      return NextResponse.json(
        {
          error: "Routes API error",
          details: data.error?.status,
          message: data.error?.message,
        },
        { status: 400 }
      );
    }

    const seconds = Number(
      String(data.routes[0].duration).replace("s", "")
    );

    const priceRaw = (seconds / 3600) * hourlyRate;
    const priceFinal = Math.max(minimumCharge, priceRaw);

    return NextResponse.json({
      minutes: Math.round((seconds / 60) * 10) / 10,
      price: Math.round(priceFinal * 100) / 100,
      minimumCharge,
    });

  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}