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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const details = [data.error, data.details, data.message]
          .filter(Boolean)
          .join(" — ");
        throw new Error(details || "Quote failed");
      }

      setResult(data);
    } catch (err) {
      setError(err?.message || "Quote failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayNow() {
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
      alert(e?.message || "Checkout failed");
      console.error(e);
    }
  }

  const canQuote = !!pickup && !!dropoff && !loading;

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
      {/* HEADER */}
      <div style={{ marginBottom: 20 }}>
        <img
          src="/tempmotion-logo.jpg"
          alt="Tempmotion Logo"
          style={{
            width: 90,
            maxWidth: "100%",
            margin: "0 auto 6px",
            display: "block",
          }}
        />
        <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.85 }}>
          Private Transportation • Chicago
        </div>
      </div>

      {/* FORM */}
      <input
        placeholder="Pickup address"
        value={pickup}
        onChange={(e) => setPickup(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
          textAlign: "center",
          borderRadius: 10,
          border: "1px solid #ddd",
        }}
      />

      <input
        placeholder="Dropoff address"
        value={dropoff}
        onChange={(e) => setDropoff(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 12,
          textAlign: "center",
          borderRadius: 10,
          border: "1px solid #ddd",
        }}
      />

      <button
        onClick={getQuote}
        disabled={!canQuote}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "2px solid #000",
          background: canQuote ? "#000" : "#e5e5e5",
          color: canQuote ? "#fff" : "#666",
          fontSize: 16,
          fontWeight: 700,
          cursor: canQuote ? "pointer" : "not-allowed",
          transition: "transform 0.05s ease, opacity 0.2s ease",
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <p style={{ marginBottom: 8 }}>
            Billable Time: {result.billableMinutes} minutes
          </p>
          <h2 style={{ margin: "0 0 10px" }}>${Number(result.price).toFixed(2)}</h2>

          <button
            onClick={handlePayNow}
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
