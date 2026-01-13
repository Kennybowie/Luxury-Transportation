import { NextResponse } from "next/server";
import { supabase } from "@/app/lib/supabase";

export const runtime = "nodejs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);

  // /api/blocked?ridedate=2026-01-14
  const ridedate = searchParams.get("ridedate"); // YYYY-MM-DD

  if (!ridedate) {
    return NextResponse.json({ blocked: [] });
  }

  const { data, error } = await supabase
    .from("blockedSlots")        // ✅ matches your table name
    .select("ride_time")
    .eq("ride_date", ridedate);  // ✅ use ridedate

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