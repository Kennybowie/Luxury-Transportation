"use client";
import { useState } from "react";

export default function BookPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [stops, setStops] = useState([]);

  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const [passengers, setPassengers] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function addStop() {
    setStops([...stops, ""]);
  }

  function updateStop(index, value) {
    const updated = [...stops];
    updated[index] = value;
    setStops(updated);
  }

  function removeStop(index) {
    setStops(stops.filter((_, i) => i !== index));
  }

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
        padding: "0 16px",
        fontFamily: "sans-serif",
        textAlign: "center",
      }}
    >
      {/* Logo + Title */}
      <img
        src="/tempmotion-logo.jpg"
        alt="Tempmotion Logo"
        style={{ width: 90, margin: "0 auto 8px", display: "block" }}
      />
      <div style={{ fontSize: 13, letterSpacing: 1, marginBottom: 20 }}>
        Private Transportation • Chicago
      </div>

      {/* Contact */}
      <input
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />

      <input
        placeholder="Email address"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={inputStyle}
      />

      {/* Addresses */}
      <input
        placeholder="Pickup address"
        value={pickup}
        onChange={(e) => setPickup(e.target.value)}
        style={inputStyle}
      />

      <input
        placeholder="Dropoff address"
        value={dropoff}
        onChange={(e) => setDropoff(e.target.value)}
        style={inputStyle}
      />

      {/* Stops */}
      {stops.map((stop, i) => (
        <div key={i} style={{ display: "flex", gap: 6 }}>
          <input
            placeholder={`Stop ${i + 1}`}
            value={stop}
            onChange={(e) => updateStop(i, e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={() => removeStop(i)}>✕</button>
        </div>
      ))}

      <button onClick={addStop} style={{ marginBottom: 16 }}>
        + Add stop
      </button>

      {/* Date / Time */}
      <input
        type="date"
        value={rideDate}
        onChange={(e) => setRideDate(e.target.value)}
        style={inputStyle}
      />

      <input
        type="time"
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        style={inputStyle}
      />

      {/* Passengers */}
      <select
        value={passengers}
        onChange={(e) => setPassengers(Number(e.target.value))}
        style={inputStyle}
      >
        <option value={0}>Just me</option>
        <option value={1}>+1 passenger</option>
        <option value={2}>+2 passengers</option>
        <option value={3}>+3 passengers</option>
      </select>

      {/* Quote */}
      <button
        onClick={getQuote}
        disabled={loading}
        style={{
          ...buttonStyle,
          background: "#000",
          color: "#fff",
        }}
      >
        {loading ? "Calculating…" : "Get Price"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {/* Result */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <p>Estimated time: {result.trafficMinutes} minutes</p>
          <h2>${result.price.toFixed(2)}</h2>

          <button
            style={buttonStyle}
            onClick={async () => {
              const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  amount: result.price,
                  name,
                  email,
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
                alert(data.error || "Checkout failed");
                return;
              }
              window.location.href = data.url;
            }}
          >
            Pay Now
          </button>
        </div>
      )}
    </main>
  );
}

const inputStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 10,
  borderRadius: 8,
  border: "1px solid #ccc",
  fontSize: 14,
};

const buttonStyle = {
  width: "100%",
  padding: 14,
  borderRadius: 10,
  border: "2px solid #000",
  fontWeight: 700,
  cursor: "pointer",
};