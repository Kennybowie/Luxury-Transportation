"use client";
import { useState } from "react";

export default function BookPage() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function getQuote() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickup, dropoff }),
      });

      const data = await res.json();
      if (!res.ok) {
  const details = [data.error, data.details, data.message].filter(Boolean).join(" — ");
  throw new Error(details || "Quote failed");
}

      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
   <main
  style={{
    maxWidth: 480,
    margin: "40px auto",
    fontFamily: "sans-serif",
    textAlign: "center",
    padding: "0 16px",
  }}
>
      <h1>Book a Ride</h1>

      <input
        placeholder="Pickup address"
        value={pickup}
        onChange={(e) => setPickup(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10, textAlign: "center" }}
      />

      <input
        placeholder="Dropoff address"
        value={dropoff}
        onChange={(e) => setDropoff(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10, textAlign: "center" }}
      />

      <button onClick={getQuote} disabled={loading || !pickup || !dropoff}>
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <p>Billable Time: {result.billableMinutes} minutes</p>
          <h2>${result.price.toFixed(2)}</h2>
<button
  onClick={async () => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: result.price }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || `Checkout failed (${res.status})`);
      }
      if (!data.url) {
        throw new Error("Checkout failed: missing Stripe URL");
      }

      window.location.assign(data.url);
    } catch (e) {
      alert(e.message);
      console.error(e);
    }
  }}
  style={{ marginTop: 10, padding: 12, width: "100%" }}
>
  Pay Now
</button>
        </div>
      )}
    </main>
  );
}
