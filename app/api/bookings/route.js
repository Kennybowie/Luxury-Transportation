import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const name = (body.name || "").trim() || null;
    const phone = (body.phone || "").trim() || null;
    const ride_date = (body.rideDate || "").trim() || null;
    const pickup = (body.pickup || "").trim() || null;
    const dropoff = (body.dropoff || "").trim() || null;

    const stops = Array.isArray(body.stops)
      ? body.stops.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    // IMPORTANT: your table name has a space
    const { error } = await supabase.from("Bookings update").insert([
      { name, phone, ride_date, pickup, dropoff, stops },
    ]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Server error", message: e?.message },
      { status: 500 }
    );
  }
}