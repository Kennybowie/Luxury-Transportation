"use client";
import { useMemo, useRef, useState } from "react";

/* ---------------- Time helpers ---------------- */
function formatTimeLabel(time24) {
  const [h, m] = time24.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hr = ((h + 11) % 12) + 1;
  return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
}

function generateTimes(start = "08:00", end = "22:00", step = 15) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let t = sh * 60 + sm;
  const endT = eh * 60 + em;

  const times = [];
  while (t <= endT) {
    const hh = String(Math.floor(t / 60)).padStart(2, "0");
    const mm = String(t % 60).padStart(2, "0");
    times.push(`${hh}:${mm}`);
    t += step;
  }
  return times;
}

function chicagoNow(TZ) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

function toIsoDateInChicago(d, TZ) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function weekdayIndexInChicago(isoDate, TZ) {
  const d = new Date(`${isoDate}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

/* ---------------- Autocomplete Address Input ---------------- */
function AddressInput({ label, placeholder, value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastQueryRef = useRef("");
  const blurTimerRef = useRef(null);

  async function fetchPredictions(q) {
    const query = (q || "").trim();
    lastQueryRef.current = query;

    if (query.length < 3) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/places?input=${encodeURIComponent(query)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Autocomplete failed");

      if (lastQueryRef.current === query) {
        setPredictions(Array.isArray(data.predictions) ? data.predictions : []);
      }
    } catch {
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: "100%", marginBottom: 10, position: "relative" }}>
      {label ? (
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6, color: "#cfcfcf" }}>
          {label}
        </div>
      ) : null}

      <input
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          fetchPredictions(e.target.value);
        }}
        onFocus={() => {
          if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
          setOpen(true);
          fetchPredictions(value);
        }}
        onBlur={() => {
          blurTimerRef.current = setTimeout(() => setOpen(false), 150);
        }}
        style={{
          width: "100%",
          padding: 10,
          textAlign: "center",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.35)",
          outline: "none",
          background: "transparent",

          // ✅ readable on dark background
          color: "#f5f5f5",
          WebkitTextFillColor: "#f5f5f5",
          fontWeight: 600,
        }}
      />

      {/* Autocomplete dropdown (keep dark text on white dropdown) */}
      {open && (loading || predictions.length > 0) && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "100%",
            zIndex: 50,
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 10,
            marginTop: 6,
            overflow: "hidden",
            boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
            textAlign: "left",
            color: "#111",
            WebkitTextFillColor: "#111",
          }}
        >
          {loading && (
            <div style={{ padding: 10, fontSize: 13, fontWeight: 700, opacity: 0.75 }}>
              Searching…
            </div>
          )}

          {predictions.slice(0, 6).map((p) => (
            <div
              key={p.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onTouchStart={(e) => e.preventDefault()}
              onClick={() => {
                onChange(p.description);
                setOpen(false);
                setPredictions([]);
              }}
              style={{
                padding: 10,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                borderTop: "1px solid #f2f2f2",
                color: "#111",
                background: "#fff",
                WebkitTextFillColor: "#111",
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

/* ---------------- Page ---------------- */
export default function BookPage() {
  // Settings
  const TZ = "America/Chicago";
  const MIN_HOURS_AHEAD = 2;
  const DAYS_AHEAD = 30;

  const START_TIME = "08:00";
  const END_TIME = "22:00";
  const STEP_MINUTES = 15;

  // Optional: add later
  const UNAVAILABLE_DATES = useMemo(() => new Set([]), []);
  const UNAVAILABLE_WEEKDAYS = useMemo(() => new Set([]), []);
  const TIME_BLOCKS_BY_WEEKDAY = useMemo(() => ({}), []);

  // State
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");

  // 0–3 additional passengers
  const [additionalPassengers, setAdditionalPassengers] = useState("0");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  const [stops, setStops] = useState([]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Availability
  function isDayUnavailable(isoDate) {
    if (!isoDate) return false;
    if (UNAVAILABLE_DATES.has(isoDate)) return true;
    const wd = weekdayIndexInChicago(isoDate, TZ);
    if (UNAVAILABLE_WEEKDAYS.has(wd)) return true;
    return false;
  }

  function earliestAllowedTimeForDate(isoDate) {
    if (!isoDate) return null;
    const now = chicagoNow(TZ);
    const todayIso = toIsoDateInChicago(now, TZ);
    if (isoDate !== todayIso) return null;

    const cutoff = new Date(now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
    const hh = String(cutoff.getHours()).padStart(2, "0");
    const mm = String(cutoff.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isTimeBlocked(isoDate, time24) {
    if (!isoDate || !time24) return false;
    if (isDayUnavailable(isoDate)) return true;

    const wd = weekdayIndexInChicago(isoDate, TZ);
    const blocks = TIME_BLOCKS_BY_WEEKDAY[wd] || [];
    for (const b of blocks) {
      if (time24 >= b.start && time24 < b.end) return true;
    }

    const earliest = earliestAllowedTimeForDate(isoDate);
    if (earliest && time24 < earliest) return true;

    return false;
  }

  // Build day list
  const days = useMemo(() => {
    const now = chicagoNow(TZ);
    const labelFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      weekday: "short",
      month: "short",
      day: "2-digit",
    });

    const list = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      list.push({
        iso: toIsoDateInChicago(d, TZ),
        label: labelFmt.format(d),
      });
    }
    return list;
  }, [DAYS_AHEAD]);

  const times = useMemo(() => generateTimes(START_TIME, END_TIME, STEP_MINUTES), []);
  const cleanedStops = useMemo(
    () => stops.map((s) => String(s).trim()).filter(Boolean),
    [stops]
  );

  const canQuote =
    !!rideDate &&
    !!rideTime &&
    !!pickup &&
    !!dropoff &&
    !loading &&
    !isDayUnavailable(rideDate) &&
    !isTimeBlocked(rideDate, rideTime);

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
          stops: cleanedStops,
          rideDate,
          rideTime,
          additionalPassengers: Number(additionalPassengers),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = [data.error, data.details, data.message].filter(Boolean).join(" — ");
        throw new Error(details || "Quote failed");
      }
      setResult(data);
    } catch (e) {
      setError(e?.message || "Quote failed");
    } finally {
      setLoading(false);
    }
  }

  async function handlePayNow() {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: result.price,
          pickup,
          dropoff,
          stops: cleanedStops,
          rideDate,
          rideTime,
          additionalPassengers: Number(additionalPassengers),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || `Checkout failed (${res.status})`);
      if (!data.url) throw new Error("Checkout failed: missing Stripe URL");
      window.location.assign(data.url);
    } catch (e) {
      alert(e?.message || "Checkout failed");
      console.error(e);
    }
  }

  // ✅ Select style: selected value light on dark background
  const selectStyle = {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    textAlign: "center",
    border: "1px solid rgba(255,255,255,0.35)",
    cursor: "pointer",
    background: "transparent",
    color: "#f5f5f5",
    WebkitTextFillColor: "#f5f5f5",
    fontWeight: 800,
  };

  function addStop() {
    setStops((prev) => [...prev, ""]);
  }
  function updateStop(idx, v) {
    setStops((prev) => prev.map((s, i) => (i === idx ? v : s)));
  }
  function removeStop(idx) {
    setStops((prev) => prev.filter((_, i) => i !== idx));
  }

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "40px auto",
        fontFamily: "sans-serif",
        textAlign: "center",
        padding: "0 16px",
        color: "#eaeaea",
      }}
    >
      {/* Placeholder color for all inputs */}
      <style jsx global>{`
        input::placeholder {
          color: #6f6f6f;
          opacity: 1;
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <img
          src="/tempmotion-logo.jpg"
          alt="Tempmotion Logo"
          style={{ width: 90, maxWidth: "100%", margin: "0 auto 6px", display: "block" }}
        />
        <div style={{ fontSize: 13, letterSpacing: 1, opacity: 0.85 }}>
          Private Transportation • Chicago
        </div>
      </div>

      {/* Day */}
      <select
        value={rideDate}
        onChange={(e) => {
          setRideDate(e.target.value);
          setRideTime("");
        }}
        style={{ ...selectStyle, marginBottom: 10 }}
      >
        <option value="" style={{ color: "#111" }}>
          Select day
        </option>
        {days.map((d) => {
          const blocked = isDayUnavailable(d.iso);
          return (
            <option key={d.iso} value={d.iso} disabled={blocked} style={{ color: "#111" }}>
              {d.label} {blocked ? "— Unavailable" : ""}
            </option>
          );
        })}
      </select>

      {/* Time */}
      <select
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        disabled={!rideDate || isDayUnavailable(rideDate)}
        style={{
          ...selectStyle,
          marginBottom: 10,
          cursor: !rideDate || isDayUnavailable(rideDate) ? "not-allowed" : "pointer",
          opacity: !rideDate || isDayUnavailable(rideDate) ? 0.6 : 1,
        }}
      >
        <option value="" style={{ color: "#111" }}>
          Select time
        </option>
        {times.map((t) => {
          const blocked = isTimeBlocked(rideDate, t);
          return (
            <option key={t} value={t} disabled={blocked} style={{ color: "#111" }}>
              {formatTimeLabel(t)} {blocked ? "— Unavailable" : ""}
            </option>
          );
        })}
      </select>

      {/* Additional passengers */}
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
        How many additional passengers?
      </div>
      <select
        value={additionalPassengers}
        onChange={(e) => setAdditionalPassengers(e.target.value)}
        style={{ ...selectStyle, marginBottom: 6 }}
      >
        <option value="0" style={{ color: "#111" }}>
          Just me
        </option>
        <option value="1" style={{ color: "#111" }}>
          +1 passenger
        </option>
        <option value="2" style={{ color: "#111" }}>
          +2 passengers
        </option>
        <option value="3" style={{ color: "#111" }}>
          +3 passengers
        </option>
      </select>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 0, marginBottom: 14 }}>
        Book at least 2 hours in advance. You can book up to 30 days ahead.
      </p>

      {/* Pickup / Dropoff */}
      <AddressInput label="Pickup" placeholder="Pickup address" value={pickup} onChange={setPickup} />
      <AddressInput label="Dropoff" placeholder="Dropoff address" value={dropoff} onChange={setDropoff} />

      {/* Stops */}
      <div style={{ width: "100%", marginTop: 6, marginBottom: 6, textAlign: "left" }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Stops (optional)</div>

        {stops.map((stop, idx) => (
          <div key={idx} style={{ position: "relative" }}>
            <AddressInput
              label=""
              placeholder={`Stop ${idx + 1} address`}
              value={stop}
              onChange={(v) => updateStop(idx, v)}
            />
            <button
              onClick={() => removeStop(idx)}
              type="button"
              style={{
                position: "absolute",
                right: 10,
                top: 22,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontWeight: 900,
                fontSize: 18,
                opacity: 0.8,
                color: "#eaeaea",
              }}
              aria-label="Remove stop"
              title="Remove stop"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addStop}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: "1px dashed rgba(255,255,255,0.45)",
            background: "transparent",
            cursor: "pointer",
            fontWeight: 900,
            marginBottom: 10,
            color: "#eaeaea",
          }}
        >
          + Add Stop
        </button>
      </div>

      {/* Get Price */}
      <button
        onClick={getQuote}
        disabled={!canQuote}
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 10,
          border: "2px solid rgba(255,255,255,0.6)",
          background: canQuote ? "#e5e5e5" : "rgba(255,255,255,0.25)",
          color: canQuote ? "#111" : "#cfcfcf",
          fontSize: 16,
          fontWeight: 800,
          cursor: canQuote ? "pointer" : "not-allowed",
        }}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "#ff6b6b", marginTop: 12 }}>{error}</p>}

      {/* Result + Pay */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <p style={{ marginBottom: 8, color: "#eaeaea" }}>
            Billable Time: {result.billableMinutes} minutes
          </p>
          <h2 style={{ margin: "0 0 10px", color: "#eaeaea" }}>
            ${Number(result.price).toFixed(2)}
          </h2>

          <button
  onClick={async () => {
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: result.price,

          // 👇 BOOKING DETAILS (THIS FIXES NULLS)
          name,
          email,
          rideDate,
          rideTime,
          passengers,
          pickup,
          dropoff,
          stops,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }

      // 🚀 Redirect to Stripe Checkout
      window.location.href = data.url;
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
