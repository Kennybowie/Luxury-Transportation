import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";
import twilio from "twilio";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("BOOKINGS BODY (price/passengers):", {
  passengers: body.passengers,
  price: body.price,
  rideDate: body.rideDate,
  rideTime: body.rideTime,
});

    // Save booking
    const { error } = await supabase.from("Bookings update").insert([
      {
        name: body.name || null,
        phone: body.phone || null,
        ride_date: body.rideDate || null,
        ride_time: body.rideTime || null,
        pickup: body.pickup || null,
        dropoff: body.dropoff || null,
        stops: Array.isArray(body.stops) ? body.stops : [],
        passengers: Number(body.passengers || 0),
        price: body.price ?? null,
        payment_method: "zelle/cashapp/chime",
        status: "pending",
      },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Send SMS alert to you
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const to = process.env.ALERT_TO_NUMBER;

    if (sid && token && from && to) {
      const client = twilio(sid, token);

      const msg =
        `🚗 NEW BOOKING\n\n` +
        `Name: ${body.name || "N/A"}\n` +
        `Phone: ${body.phone || "N/A"}\n` +
        `Price: $${body.price ?? "N/A"}\n\n` +
        `Pickup: ${body.pickup || "N/A"}\n` +
        `Dropoff: ${body.dropoff || "N/A"}`;

      await client.messages.create({ from, to, body: msg });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}