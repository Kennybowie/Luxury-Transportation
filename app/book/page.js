"use client";
import { useState } from "react";

export default function BookPage() {
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [stops, setStops] = useState([]);
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const [passengers, setPassengers] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const inputStyle = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    textAlign: "center",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    fontSize: 14,
    color: "#fff",
    backgroundColor: "#111",
    outline: "none",
  };

  async function getQuote() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup,
          dropoff,
          stops,
          rideDate,
          rideTime,
          passengers,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Quote failed");
      }

      setResult(data);
    } catch (e) {
      setError(e.message);
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
      {/* Placeholder styling */}
      <style>{`
        input::placeholder {
          color: #bfbfbf;
          opacity: 1;
        }
      `}</style>

      {/* DATE */}
      <input
        type="date"
        value={rideDate}
        onChange={(e) => setRideDate(e.target.value)}
        style={inputStyle}
      />

      {/* TIME (AM / PM handled by browser) */}
      <input
        type="time"
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        style={inputStyle}
      />

      <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.9 }}>
        Must book at least <strong>2 hours</strong> in advance
      </div>

      {/* PICKUP */}
      <input
        placeholder="Pickup address"
        value={pickup}
        onChange={(e) => setPickup(e.target.value)}
        style={inputStyle}
      />

      {/* STOPS */}
      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>
        Stops (optional)
      </div>

      {stops.map((stop, i) => (
        <input
          key={i}
          placeholder={`Stop ${i + 1}`}
          value={stop}
          onChange={(e) => {
            const copy = [...stops];
            copy[i] = e.target.value;
            setStops(copy);
          }}
          style={inputStyle}
        />
      ))}

      <button
        onClick={() => setStops([...stops, ""])}
        style={{
          marginBottom: 16,
          background: "none",
          border: "none",
          color: "#000",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        + Add stop
      </button>

      {/* DROPOFF */}
      <input
        placeholder="Dropoff address"
        value={dropoff}
        onChange={(e) => setDropoff(e.target.value)}
        style={inputStyle}
      />

      {/* PASSENGERS */}
      <select
        value={passengers}
        onChange={(e) => setPassengers(Number(e.target.value))}
        style={{
          ...inputStyle,
          color: "#fff",
        }}
      >
        <option value={0}>Additional passengers</option>
        <option value={1}>1 passenger</option>
        <option value={2}>2 passengers</option>
        <option value={3}>3 passengers</option>
      </select>

      {/* GET PRICE */}
      <button
        onClick={getQuote}
        disabled={loading || !pickup || !dropoff || !rideDate || !rideTime}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "2px solid #000",
          background: "#000",
          color: "#fff",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* PRICE + PAY */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <p>{result.trafficMinutes} minutes (traffic-aware)</p>
          <h2>${result.price}</h2>

          <button
            onClick={async () => {
              const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount: result.price,
                  pickup,
                  dropoff,
                  stops,
                  rideDate,
                  rideTime,
                  passengers,
                }),
              });

              const data = await res.json();
              if (data.url) window.location.href = data.url;
            }}
            style={{
              width: "100%",
              padding: 14,
              borderRadius: 10,
              border: "2px solid #000",
              background: "#fff",
              color: "#000",
              fontSize: 16,
              fontWeight: 700,
              marginTop: 10,
              cursor: "pointer",
            }}
          >
            Pay Now
          </button>
        </div>
      )}
    </main>
  );
}