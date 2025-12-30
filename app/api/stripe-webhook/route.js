import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// IMPORTANT: for Stripe signature verification we need the raw body.
// Next.js App Router supports req.text() for raw body.
export async function POST(req) {
  console.log("✅ stripe-webhook hit", new Date().toISOString());

  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!stripeSecretKey) {
      console.log("❌ Missing STRIPE_SECRET_KEY");
      return new Response("Missing STRIPE_SECRET_KEY", { status: 500 });
    }
    if (!webhookSecret) {
      console.log("❌ Missing STRIPE_WEBHOOK_SECRET");
      return new Response("Missing STRIPE_WEBHOOK_SECRET", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
    });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      console.log("❌ Missing stripe-signature header");
      return new Response("Missing stripe-signature", { status: 400 });
    }

    const rawBody = await req.text();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err) {
      console.log("❌ Webhook signature verification failed:", err?.message);
      return new Response(`Webhook Error: ${err?.message}`, { status: 400 });
    }

    console.log("Stripe event type:", event.type);

    // We only care about completed checkout sessions
    if (event.type !== "checkout.session.completed") {
      return new Response("Ignored event", { status: 200 });
    }

    const session = event.data.object;

    // Pull metadata you attached in /api/checkout (if present)
    const md = session.metadata || {};

    // Supabase client (server-side service role)
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      console.log("❌ Missing SUPABASE_URL");
      return new Response("Missing SUPABASE_URL", { status: 500 });
    }
    if (!supabaseServiceRole) {
      console.log("❌ Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Missing SUPABASE_SERVICE_ROLE_KEY", { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRole, {
      auth: { persistSession: false },
    });

    // Stripe amounts are in cents
    const amountTotal = session.amount_total ?? null; // cents
    const price = amountTotal != null ? amountTotal / 100 : null;

    // Stops may be stored as JSON string in metadata
    let stops = [];
    try {
      if (md.stops) stops = JSON.parse(md.stops);
    } catch {
      stops = [];
    }

    // Insert booking row
    // Make sure your Supabase table has these columns (names must match)
    const row = {
      name: md.name || null,
      email: md.email || session.customer_details?.email || null,
      pickup: md.pickup || null,
      dropoff: md.dropoff || null,
      stops, // jsonb recommended
      ride_date: md.rideDate || null,
      ride_time: md.rideTime || null,
      passengers:
        md.passengers != null && md.passengers !== ""
          ? Number(md.passengers)
          : null,
      price,
      stripe_session_id: session.id,
      payment_status: session.payment_status || "paid",
    };

    console.log("Attempting Supabase insert:", {
      stripe_session_id: row.stripe_session_id,
      email: row.email,
      price: row.price,
    });

    const { error } = await supabase.from("bookings").insert(row);

    if (error) {
      console.log("❌ Supabase insert error:", error);
      // Return 500 so Stripe shows the delivery failed (easy to see)
      return new Response("Supabase insert failed", { status: 500 });
    }

    console.log("✅ Supabase insert success for session:", session.id);
    return new Response("OK", { status: 200 });
  } catch (e) {
    console.log("❌ stripe-webhook server error:", e?.message);
    return new Response("Server error", { status: 500 });
  }
}