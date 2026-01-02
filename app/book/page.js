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

  const timeOptions = Array.from({ length: 15 }, (_, i) => {
    const hour = i + 7; // 7am–9pm
    const label =
      hour === 12
        ? "12:00 PM"
        : hour > 12
        ? `${hour - 12}:00 PM`
        : `${hour}:00 AM`;
    const value = `${String(hour).padStart(2, "0")}:00`;
    return { label, value };
  });

  function isTimeBlocked(date, time) {
    if (!date || !time) return false;

    const now = new Date();
    const minAllowed = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const [y, m, d] = date.split("-").map(Number);
    const [hh, mm] = time.split(":").map(Number);

    const selected = new Date(y, m - 1, d, hh, mm, 0, 0);

    const isToday =
      selected.getFullYear() === now.getFullYear() &&
      selected.getMonth() === now.getMonth() &&
      selected.getDate() === now.getDate();

    if (!isToday) return false;

    return selected.getTime() < minAllowed.getTime();
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
          passengers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Quote failed");

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
      <style>{`
        input::placeholder {
          color: #bfbfbf;
        }
      `}</style>

      {/* DATE */}
      <select
        value={rideDate}
        onChange={(e) => setRideDate(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select date</option>
        {Array.from({ length: 30 }).map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          const val = d.toISOString().split("T")[0];
          return (
            <option key={val} value={val}>
              {d.toLocaleDateString()}
            </option>
          );
        })}
      </select>

      {/* TIME */}
      <select
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select time</option>
        {timeOptions.map((t) => {
          const blocked = isTimeBlocked(rideDate, t.value);
          return (
            <option key={t.value} value={t.value} disabled={blocked}>
              {t.label} {blocked ? "(Unavailable)" : ""}
            </option>
          );
        })}
      </select>

      {/* VISIBLE STRIKETHROUGH (Safari-safe) */}
      {rideDate && (
        <div style={{ marginBottom: 12 }}>
          {timeOptions
            .filter((t) => isTimeBlocked(rideDate, t.value))
            .map((t) => (
              <div
                key={t.value}
                style={{
                  textDecoration: "line-through",
                  color: "#fff",
                  opacity: 0.6,
                  fontSize: 12,
                }}
              >
                {t.label}
              </div>
            ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#fff", marginBottom: 16 }}>
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
          color: "#fff",
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
        style={inputStyle}
      >
        <option value={0}>Just me</option>
        <option value={1}>+1 passenger</option>
        <option value={2}>+2 passengers</option>
        <option value={3}>+3 passengers</option>
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
          background: "#fff",
          color: "#000",
          fontSize: 16,
          fontWeight: 700,
          cursor: "pointer",
          marginTop: 10,
        }}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20, color: "#fff" }}>
          <h2>${result.price}</h2>
        </div>
      )}
    </main>
  );
}