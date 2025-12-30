import { NextResponse } from "next/server";
import { DateTime } from "luxon";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const pickup = (body.pickup || "").trim();
    const dropoff = (body.dropoff || "").trim();
    const stops = Array.isArray(body.stops)
      ? body.stops.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    const rideDate = (body.rideDate || "").trim(); // "YYYY-MM-DD"
    const rideTime = (body.rideTime || "").trim(); // "HH:mm"

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

    const hourlyRate = Number(process.env.HOURLY_RATE || 40);
    const minimumCharge = Number(process.env.MINIMUM_CHARGE || 10);
    const bufferSeconds = Number(process.env.BUFFER_SECONDS || 0);

    // If date/time provided, use it; otherwise use "now" for live traffic at quote time.
    let departureTimeIso;
    if (rideDate && rideTime) {
      departureTimeIso = DateTime.fromISO(`${rideDate}T${rideTime}`, {
        zone: "America/Chicago",
      })
        .toUTC()
        .toISO();
    } else {
      departureTimeIso = DateTime.utc().toISO();
    }

    // Routes API v2 request
    const payload = {
      origin: { address: pickup },
      destination: { address: dropoff },
      intermediates: stops.map((a) => ({ address: a })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      departureTime: departureTimeIso,
    };

    const routesRes = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          // Only ask for what we need (faster/cheaper)
          "X-Goog-FieldMask": "routes.duration,routes.staticDuration",
        },
        body: JSON.stringify(payload),
      }
    );

    const routesData = await routesRes.json().catch(() => ({}));

    if (!routesRes.ok || !routesData.routes?.[0]) {
      return NextResponse.json(
        {
          error: "Routes API error",
          details: routesData.error?.status || routesRes.status,
          message: routesData.error?.message,
        },
        { status: 400 }
      );
    }

    // duration is traffic-aware when routingPreference is TRAFFIC_AWARE
    // It comes back like "1234s"
    const durationStr = routesData.routes[0].duration || "0s";
    const trafficSeconds = Number(String(durationStr).replace("s", "")) || 0;

    const billableSeconds = Math.max(0, trafficSeconds + bufferSeconds);
    const rawPrice = (billableSeconds / 3600) * hourlyRate;
    const finalPrice = Math.max(minimumCharge, rawPrice);

    return NextResponse.json({
      trafficMinutes: Math.round((trafficSeconds / 60) * 10) / 10,
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
