import Stripe from "stripe";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
      return NextResponse.json({ error: "Missing STRIPE_SECRET_KEY" }, { status: 500 });
    }

    const stripe = new Stripe(secret);

    const body = await req.json();

    const {
      amount,
      name,
      email,
      rideDate,
      rideTime,
      passengers,
      pickup,
      dropoff,
      stops,
    } = body;

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email || undefined,

      // ✅ Put your booking fields here (STRIPE WILL SEND THIS BACK IN WEBHOOK)
      metadata: {
        name: name || "",
        email: email || "",
        rideDate: rideDate || "",
        rideTime: rideTime || "",
        passengers: String(passengers ?? ""),
        pickup: pickup || "",
        dropoff: dropoff || "",
        stops: Array.isArray(stops) ? stops.filter(Boolean).join(" | ") : "",
      },

      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "Tempmotion • Private Ride" },
            unit_amount: Math.round(numAmount * 100),
          },
          quantity: 1,
        },
      ],

      success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/book`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    return NextResponse.json({ error: "Checkout error", message: e?.message }, { status: 500 });
  }
}