"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

function toTitleCase(s) {
  return String(s || "").trim();
}

// Autocomplete input (uses your /api/places route)
function AutoAddress({
  placeholder,
  value,
  onChange,
  inputStyle,
  dropdownTextColor = "#111",
  dropdownBg = "#fff",
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = String(value || "").trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }

    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        const preds = Array.isArray(data.predictions) ? data.predictions : [];
        setItems(preds);
        setOpen(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();

    return () => ctrl.abort();
  }, [value]);

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 12 }}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (items.length) setOpen(true);
        }}
        style={inputStyle}
        autoComplete="off"
      />

      {open && (loading || items.length > 0) && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 50,
            background: dropdownBg,
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
            marginTop: 6,
            overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          }}
        >
          {loading && (
            <div style={{ padding: 10, fontSize: 13, color: dropdownTextColor }}>
              Searching...
            </div>
          )}

          {items.slice(0, 6).map((p) => (
            <button
              key={p.place_id}
              type="button"
              onClick={() => {
                onChange(p.description);
                setOpen(false);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: dropdownTextColor,
                fontSize: 14,
                fontWeight: 600,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeYMD(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

function labelForDate(d) {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}`;
}

export default function BookPage() {
  const LOGO_SRC = "/tempmotion-logo.jpg";

  // Booking fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengers, setPassengers] = useState(0);

  const [rideDate, setRideDate] = useState(""); // YYYY-MM-DD
  const [rideTime, setRideTime] = useState(""); // HH:mm

  const [pickup, setPickup] = useState("");
  const [stops, setStops] = useState([]);
  const [dropoff, setDropoff] = useState("");

  // Quote + booking
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Styles (kept the same)
  const inputStyle = {
    width: "100%",
    padding: 12,
    marginBottom: 0,
    textAlign: "center",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    fontSize: 14,
    color: "#fff",
    backgroundColor: "#111",
    outline: "none",
  };

  const selectStyle = {
    ...inputStyle,
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    cursor: "pointer",
  };

  const buttonPrimary = {
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
  };

  const buttonSecondary = {
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
  };

  // Date dropdown: today -> 30 days out
  const dateOptions = useMemo(() => {
    const opts = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      opts.push({ value: makeYMD(d), label: labelForDate(d) });
    }
    return opts;
  }, []);

  // Time options: 7:00 AM -> 9:45 PM (cuts off 10pm–7am)
  const timeOptions = useMemo(() => {
    const opts = [];
    let minutes = 7 * 60; // 07:00
    const end = 21 * 60 + 45; // 21:45 (9:45 PM)
    while (minutes <= end) {
      const hh24 = Math.floor(minutes / 60);
      const mm = minutes % 60;
      const isPM = hh24 >= 12;
      const hh12raw = hh24 % 12;
      const hh12 = hh12raw === 0 ? 12 : hh12raw;
      const label = `${hh12}:${pad2(mm)} ${isPM ? "PM" : "AM"}`;
      const value = `${pad2(hh24)}:${pad2(mm)}`; // HTML time value
      opts.push({ label, value });
      minutes += 15;
    }
    return opts;
  }, []);

  function isTwoHoursAhead(dateStr, timeStr) {
    if (!dateStr || !timeStr) return false;
    const [H, M] = timeStr.split(":").map((n) => Number(n));
    const d = new Date(dateStr);
    d.setHours(H, M, 0, 0);
    return d.getTime() - Date.now() >= 2 * 60 * 60 * 1000;
  }

  async function getQuote() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (!isTwoHoursAhead(rideDate, rideTime)) {
        throw new Error("Must book at least 2 hours in advance.");
      }

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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = [data.error, data.details, data.message].filter(Boolean).join(" — ");
        throw new Error(details || "Quote failed");
      }

      setResult(data);
    } catch (e) {
      setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking() {
    try {
      const priceToSend =
        result && typeof result.price !== "undefined" ? result.price : null;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: toTitleCase(name),
          phone,
          rideDate,
          rideTime,
          pickup,
          dropoff,
          stops,
          passengers,
          price: priceToSend,
          paymentMethod: "zelle/cashapp/chime",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Booking failed");

      alert(
        "✅ Booking submitted!\n\nPlease send payment via Zelle, Cash App, or Chime to 872-344-5076.\nInclude your name in the description.\n\nOnce payment is received you will receive a confirmation text."
      );
    } catch (e) {
      alert(e.message || "Booking error");
    }
  }

  const disabled =
    loading ||
    !name.trim() ||
    !phone.trim() ||
    !pickup.trim() ||
    !dropoff.trim() ||
    !rideDate ||
    !rideTime;

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
        input::placeholder { color: #bfbfbf; opacity: 1; }
        select { color: #fff; }
        select option { color: #111; }
      `}</style>

      {/* LOGO */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <img
          src={LOGO_SRC}
          alt="Tempmotion Logo"
          style={{
            width: 90,
            maxWidth: "100%",
            margin: "0 auto 6px",
            display: "block",
          }}
        />
        <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.85, color: "#fff" }}>
          Private Transportation • Chicago
        </div>
      </div>

      {/* NAME */}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* PHONE */}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          style={inputStyle}
          inputMode="tel"
        />
      </div>

      {/* PASSENGERS */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={passengers}
          onChange={(e) => setPassengers(Number(e.target.value))}
          style={selectStyle}
        >
          <option value={0}>Additional passengers</option>
          <option value={1}>1 passenger</option>
          <option value={2}>2 passengers</option>
          <option value={3}>3 passengers</option>
        </select>
      </div>

      {/* DATE (dropdown / scroll style) */}
      <div style={{ marginBottom: 12 }}>
        <select value={rideDate} onChange={(e) => setRideDate(e.target.value)} style={selectStyle}>
          <option value="">Select date</option>
          {dateOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* TIME (dropdown, 7AM–9:45PM ONLY) */}
      <div style={{ marginBottom: 8 }}>
        <select value={rideTime} onChange={(e) => setRideTime(e.target.value)} style={selectStyle}>
          <option value="">Select time</option>
          {timeOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.9, color: "#fff" }}>
        Must book at least <strong>2 hours</strong> in advance
      </div>

      {/* PICKUP */}
      <AutoAddress
        placeholder="Pickup address"
        value={pickup}
        onChange={setPickup}
        inputStyle={inputStyle}
      />

      {/* STOPS */}
      <div style={{ color: "#fff", fontWeight: 700, marginBottom: 6 }}>
        Stops (optional)
      </div>

      {stops.map((stop, i) => (
        <AutoAddress
          key={i}
          placeholder={`Stop ${i + 1}`}
          value={stop}
          onChange={(val) => {
            const copy = [...stops];
            copy[i] = val;
            setStops(copy);
          }}
          inputStyle={inputStyle}
        />
      ))}

      <button
        type="button"
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
      <AutoAddress
        placeholder="Dropoff address"
        value={dropoff}
        onChange={setDropoff}
        inputStyle={inputStyle}
      />

      {/* GET PRICE */}
      <button
        onClick={getQuote}
        disabled={disabled}
        style={{
          ...buttonPrimary,
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

      {/* PRICE + CONFIRM */}
      {result && (
        <div style={{ marginTop: 20 }}>
          {typeof result.trafficMinutes !== "undefined" ? (
            <p style={{ color: "#fff", opacity: 0.9 }}>
              {result.trafficMinutes} minutes (traffic-aware)
            </p>
          ) : null}

          <h2 style={{ color: "#fff" }}>
            ${typeof result.price === "number" ? result.price : result.price}
          </h2>

          <button type="button" onClick={confirmBooking} style={buttonSecondary}>
            Confirm Booking
          </button>
        </div>
      )}
    </main>
  );
}