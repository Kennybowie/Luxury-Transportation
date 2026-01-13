import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const rideDate = searchParams.get("rideDate"); // YYYY-MM-DD

  if (!rideDate) {
    return NextResponse.json({ blocked: [] });
  }

  const { data, error } = await supabase
    .from("blockedSlots")
    .select("ride_time")
    .eq("ride_date", rideDate);

  if (error) {
    return NextResponse.json(
      { blocked: [], error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({
    blocked: (data || []).map((r) => r.ride_time),
  });
}