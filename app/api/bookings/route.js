import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json();

    const { error } = await supabase.from("bookings").insert([
      {
        name: body.name || null,
        phone: body.phone || null,
        ride_date: body.rideDate || null,
        ride_time: body.rideTime || null,
        pickup: body.pickup || null,
        dropoff: body.dropoff || null,
        stops: Array.isArray(body.stops) ? body.stops : [],
        passengers: Number(body.passengers || 0),
        price: Number(body.price || 0),
        payment_method: body.paymentMethod || "zelle/cashapp/chime",
        status: "pending",
      },
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