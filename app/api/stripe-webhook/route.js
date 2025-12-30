import Stripe from "stripe";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req) {
  // ===== ENV VARS =====
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!stripeSecret || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe env vars" },
      { status: 500 }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  const stripe = new Stripe(stripeSecret);
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ===== RAW BODY FOR STRIPE SIGNATURE =====
  const rawBody = await req.text();
  const sig = req.headers.get("stripe-signature");

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid Stripe signature", message: err.message },
      { status: 400 }
    );
  }

  // ===== HANDLE SUCCESSFUL PAYMENT =====
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const md = session.metadata || {};

    const stripeSessionId = session.id;

    // Prevent duplicate inserts (Stripe retries webhooks)
    const { data: existing } = await supabase
      .from("bookings")
      .select("id")
      .eq("stripe_session_id", stripeSessionId)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabase.from("bookings").insert({
        name: md.name || "",
        email: md.email || "",
        pickup: md.pickup || "",
        dropoff: md.dropoff || "",
        stops: md.stops || "[]",
        ride_date: md.rideDate || "",
        ride_time: md.rideTime || "",
        passengers: Number(md.passengers || 0),
        price: Number(session.amount_total || 0) / 100,
        stripe_session_id: stripeSessionId,
        payment_status: session.payment_status || "paid",
      });

      if (error) {
        return NextResponse.json(
          { error: "Database insert failed", message: error.message },
          { status: 500 }
        );
      }
    }
  }

  // Stripe requires a 2xx response
  return NextResponse.json({ received: true });
}