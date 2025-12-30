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
  <div style={{ textAlign: "center", marginBottom: 20 }}>
  <img
    src="/tempmotion-logo.jpg"
    alt="Tempmotion Logo"
    style={{
      width: 90,            // ✅ smaller logo
      maxWidth: "100%",
      margin: "0 auto 6px",
      display: "block",
    }}
  />
  <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.85 }}>
    Private Transportation • Chicago
  </div>
</div>
  style={{
    maxWidth: 480,
    margin: "40px auto",
    fontFamily: "sans-serif",
    textAlign: "center",
    padding: "0 16px",
  }}
>
    

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

     <button
  onClick={getQuote}
  disabled={loading || !pickup || !dropoff}
  style={{
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "2px solid #000",
    background: loading || !pickup || !dropoff ? "#e5e5e5" : "#000",
    color: loading || !pickup || !dropoff ? "#666" : "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: loading || !pickup || !dropoff ? "not-allowed" : "pointer",
    transition: "transform 0.05s ease, opacity 0.2s ease",
  }}
  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
>
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
 style={{
  marginTop: 12,
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "2px solid #000",
  background: "#fff",
  color: "#000",
  fontSize: 16,
  fontWeight: 700,
  cursor: "pointer",
  transition: "background-color 0.2s, color 0.2s, transform 0.05s",
}}
onMouseEnter={(e) => {
  e.currentTarget.style.backgroundColor = "#000";
  e.currentTarget.style.color = "#fff";
}}
onMouseLeave={(e) => {
  e.currentTarget.style.backgroundColor = "#fff";
  e.currentTarget.style.color = "#000";
}}
onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
>
  Pay Now
</button>
        </div>
      )}
    </main>
  );
}
