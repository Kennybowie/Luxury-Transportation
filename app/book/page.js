"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/** ---------- helpers ---------- **/
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
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatPhone(raw) {
  const digits = String(raw || "").replace(/\D/g, "").slice(0, 10);
  const a = digits.slice(0, 3);
  const b = digits.slice(3, 6);
  const c = digits.slice(6, 10);
  if (digits.length <= 3) return a;
  if (digits.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/**
 * Block times that are within 2 hours from NOW (today only).
 * timeValue must be "HH:mm" 24-hr.
 */
function isTimeBlocked(rideDate, timeValue) {
  if (!rideDate || !timeValue) return false;

  const now = new Date();
  const minAllowed = new Date(now.getTime() + 2 * 60 * 60 * 1000); // now + 2 hours

  const [hh, mm] = timeValue.split(":").map(Number);
  const selected = new Date(rideDate);
  selected.setHours(hh, mm, 0, 0);

  const isToday =
    selected.getFullYear() === now.getFullYear() &&
    selected.getMonth() === now.getMonth() &&
    selected.getDate() === now.getDate();

  if (!isToday) return false;
  return selected.getTime() < minAllowed.getTime();
}

/** ---------- autocomplete input (uses /api/places) ---------- **/
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

/** ---------- page ---------- **/
export default function BookPage() {
  const LOGO_SRC = "/tempmotion-logo.jpg";

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [passengers, setPassengers] = useState(0);

  const [rideDate, setRideDate] = useState(""); // YYYY-MM-DD
  const [rideTime, setRideTime] = useState(""); // HH:mm (24 hr)

  const [pickup, setPickup] = useState("");
  const [stops, setStops] = useState([]);
  const [dropoff, setDropoff] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  // Date dropdown: today -> 30 days out (scroll dropdown)
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

  // Time options: 7:00 AM -> 9:45 PM (15 min intervals)
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
      const value = `${pad2(hh24)}:${pad2(mm)}`;

      opts.push({ label, value });
      minutes += 15;
    }
    return opts;
  }, []);

  // If user already selected a time, and then changes date to TODAY where it becomes blocked, clear it.
  useEffect(() => {
    if (rideDate && rideTime && isTimeBlocked(rideDate, rideTime)) {
      setRideTime("");
    }
  }, [rideDate, rideTime]);

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
          name: name?.trim() || null,
          phone: phone?.trim() || null,
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
      {/* Keep your placeholder + dropdown behavior */}
      <style>{`
        input::placeholder { color: #bfbfbf; opacity: 1; }
        select { color: #fff; }
        select option { color: #111; }
        option:disabled { color: #999 !important; }
      `}</style>

      {/* Logo + header */}
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

      {/* Name + Phone */}
      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Phone number"
          value={phone}
          onChange={(e) => setPhone(formatPhone(e.target.value))}
          style={inputStyle}
          inputMode="tel"
        />
      </div>

      {/* Passengers under phone */}
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

      {/* Date dropdown (scroll style) */}
      <div style={{ marginBottom: 12 }}>
        <select
          value={rideDate}
          onChange={(e) => setRideDate(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select date</option>
          {dateOptions.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Time dropdown with 2-hour blocking */}
      <div style={{ marginBottom: 8 }}>
        <select
          value={rideTime}
          onChange={(e) => setRideTime(e.target.value)}
          style={selectStyle}
        >
          <option value="">Select time</option>
          {timeOptions.map((t) => (
            <option
              key={t.value}
              value={t.value}
              disabled={isTimeBlocked(rideDate, t.value)}
            >
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ fontSize: 12, marginBottom: 16, opacity: 0.9, color: "#fff" }}>
        Must book at least <strong>2 hours</strong> in advance
      </div>

      {/* Pickup */}
      <AutoAddress
        placeholder="Pickup address"
        value={pickup}
        onChange={setPickup}
        inputStyle={inputStyle}
      />

      {/* Stops between pickup + dropoff */}
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

      {/* Dropoff */}
      <AutoAddress
        placeholder="Dropoff address"
        value={dropoff}
        onChange={setDropoff}
        inputStyle={inputStyle}
      />

      {/* Get Price */}
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

      {/* Price + Confirm */}
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