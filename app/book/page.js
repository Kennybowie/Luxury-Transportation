"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/* ---------- Helpers ---------- */
const pad2 = (n) => String(n).padStart(2, "0");

function buildDateOptions(days = 30) {
  const out = [];
  const base = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const label = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    out.push({ value, label });
  }
  return out;
}

function buildTimeOptions(step = 15) {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += step) out.push(`${pad2(h)}:${pad2(m)}`);
  }
  return out;
}

function formatTimeLabel(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)} ${ampm}`;
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ---------- Autocomplete Input ---------- */
function AutocompleteInput({ value, onChange, placeholder, inputStyle }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState([]);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 2) return setPreds([]);

    const t = setTimeout(async () => {
      const res = await fetch(`/api/places?input=${encodeURIComponent(q)}`);
      const data = await res.json();
      setPreds(data.predictions || []);
      setOpen(true);
    }, 200);

    return () => clearTimeout(t);
  }, [value]);

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />

      {open && preds.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            background: "#fff",
            borderRadius: 10,
            marginTop: 4,
            zIndex: 20,
          }}
        >
          {preds.map((p) => (
            <div
              key={p.place_id}
              onClick={() => {
                onChange(p.description);
                setOpen(false);
              }}
              style={{
                padding: 10,
                cursor: "pointer",
                fontWeight: 700,
                color: "#111",
              }}
            >
              {p.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const [pickup, setPickup] = useState("");
  const [stops, setStops] = useState([]);
  const [dropoff, setDropoff] = useState("");

  const [passengers, setPassengers] = useState(0);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const dateOptions = useMemo(() => buildDateOptions(30), []);
  const timeOptions = useMemo(() => buildTimeOptions(15), []);

  const disabledTimes = useMemo(() => {
    const set = new Set();
    if (rideDate !== todayYMD()) return set;

    const min = new Date(Date.now() + 2 * 60 * 60 * 1000);
    for (const t of timeOptions) {
      const [h, m] = t.split(":").map(Number);
      if (h < min.getHours() || (h === min.getHours() && m < min.getMinutes()))
        set.add(t);
    }
    return set;
  }, [rideDate, timeOptions]);

  async function getQuote() {
    setLoading(true);
    setError(null);
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
      // Save booking to Supabase (no UI changes)
await fetch("/api/bookings", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name,
    phone,
    rideDate,
    rideTime,
    pickup,
    dropoff,
    stops,
    passengers,
    price: data.price,
    paymentMethod: "zelle/cashapp/chime",
  }),
});
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    padding: 12,
    marginBottom: 12,
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    background: "#111",
    color: "#fff",
    textAlign: "center",
  };

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16, textAlign: "center" }}>
      <img src="/tempmotion-logo.jpg" style={{ width: 90 }} />
      <div style={{ color: "#fff", marginBottom: 20 }}>
        Private Transportation • Chicago
      </div>

      <select value={rideDate} onChange={(e) => setRideDate(e.target.value)} style={inputStyle}>
        <option value="">Select date</option>
        {dateOptions.map((d) => (
          <option key={d.value} value={d.value}>{d.label}</option>
        ))}
      </select>

      <select value={rideTime} onChange={(e) => setRideTime(e.target.value)} style={inputStyle}>
        <option value="">Select time</option>
        {timeOptions.map((t) => (
          <option key={t} value={t} disabled={disabledTimes.has(t)}>
            {formatTimeLabel(t)}
          </option>
        ))}
      </select>

      <p style={{ color: "#fff", fontSize: 12 }}>
        Must book at least <b>2 hours</b> in advance.
      </p>

      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <input placeholder="Your phone number" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />

      <AutocompleteInput placeholder="Pickup address" value={pickup} onChange={setPickup} inputStyle={inputStyle} />

      {stops.map((s, i) => (
        <AutocompleteInput
          key={i}
          placeholder={`Stop ${i + 1}`}
          value={s}
          onChange={(v) => {
            const copy = [...stops];
            copy[i] = v;
            setStops(copy);
          }}
          inputStyle={inputStyle}
        />
      ))}

      <button onClick={() => setStops([...stops, ""])} style={{ marginBottom: 12 }}>
        + Add stop
      </button>

      <AutocompleteInput placeholder="Dropoff address" value={dropoff} onChange={setDropoff} inputStyle={inputStyle} />

      <button
        onClick={getQuote}
        disabled={!pickup || !dropoff || !name || !phone || !rideDate || !rideTime}
        style={{
          width: "100%",
          padding: 14,
          background: "#fff",
          color: "#000",
          fontWeight: 800,
          borderRadius: 10,
        }}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {result && (
        <div style={{ marginTop: 20, color: "#fff" }}>
          <h2>${result.price}</h2>
          <p>
            Please send payment via <b>Zelle, Cash App, or Chime</b> to:
            <br />
            <b>872-344-5076</b>
            <br />
            Include your <b>name</b> in the description.
          </p>
          <p><b>Once payment is received, you will receive a confirmation text.</b></p>
        </div>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}
    </main>
  );
}