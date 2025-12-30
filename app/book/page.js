"use client";
import { useMemo, useRef, useState } from "react";

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

function chicagoNow(TIMEZONE) {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
}

function toIsoDateInChicago(d, TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function weekdayIndexInChicago(isoDate, TIMEZONE) {
  const d = new Date(`${isoDate}T12:00:00`);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
  }).format(d);
  const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday];
}

function AddressInput({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const lastQueryRef = useRef("");

  async function fetchPredictions(q) {
    const query = q.trim();
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

      // Only apply if it matches latest query (prevents flicker)
      if (lastQueryRef.current === query) {
        setPredictions(data.predictions || []);
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
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</div>
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
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay close so click selection works
          setTimeout(() => setOpen(false), 150);
        }}
        style={{
          width: "100%",
          padding: 10,
          textAlign: "center",
          borderRadius: 10,
          border: "1px solid #ddd",
          outline: "none",
        }}
      />

      {open && (predictions.length > 0 || loading) && (
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
            boxShadow: "0 8px 20px rgba(0,0,0,0.08)",
            textAlign: "left",
          }}
        >
          {loading && (
            <div style={{ padding: 10, fontSize: 13, opacity: 0.7 }}>
              Searching…
            </div>
          )}

          {predictions.slice(0, 6).map((p) => (
            <div
              key={p.place_id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(p.description);
                setOpen(false);
                setPredictions([]);
              }}
              style={{
                padding: 10,
                fontSize: 13,
                cursor: "pointer",
                borderTop: "1px solid #f2f2f2",
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
  // ===== Settings =====
  const TIMEZONE = "America/Chicago";
  const MIN_HOURS_AHEAD = 2;
  const DAYS_AHEAD = 30; // ✅ 30 days in advance
  const START_TIME = "08:00";
  const END_TIME = "22:00";
  const STEP_MINUTES = 15;

  // Optional blocks (edit these any time)
  const UNAVAILABLE_DATES = useMemo(
    () =>
      new Set([
        // "2026-01-03",
      ]),
    []
  );

  const UNAVAILABLE_WEEKDAYS = useMemo(
    () =>
      new Set([
        // 0, // Sunday
      ]),
    []
  );

  const TIME_BLOCKS_BY_WEEKDAY = useMemo(
    () => ({
      // 1: [{ start: "12:00", end: "13:30" }], // Monday lunch blocked
    }),
    []
  );

  // ===== State =====
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  // Stops: freeform (one per line) – simple + mobile friendly
  const [stopsText, setStopsText] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ===== Availability =====
  function isDayUnavailable(isoDate) {
    if (!isoDate) return false;
    if (UNAVAILABLE_DATES.has(isoDate)) return true;
    const wd = weekdayIndexInChicago(isoDate, TIMEZONE);
    if (UNAVAILABLE_WEEKDAYS.has(wd)) return true;
    return false;
  }

  function earliestAllowedTimeForDate(isoDate) {
    if (!isoDate) return null;

    const now = chicagoNow(TIMEZONE);
    const todayIso = toIsoDateInChicago(now, TIMEZONE);

    // Only enforce for same-day bookings
    if (isoDate !== todayIso) return null;

    const cutoff = new Date(now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
    const hh = String(cutoff.getHours()).padStart(2, "0");
    const mm = String(cutoff.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isTimeBlocked(isoDate, time24) {
    if (!isoDate || !time24) return false;
    if (isDayUnavailable(isoDate)) return true;

    // Weekly time blocks
    const wd = weekdayIndexInChicago(isoDate, TIMEZONE);
    const blocks = TIME_BLOCKS_BY_WEEKDAY[wd] || [];
    for (const b of blocks) {
      if (time24 >= b.start && time24 < b.end) return true;
    }

    // 2-hour rule (same day)
    const earliest = earliestAllowedTimeForDate(isoDate);
    if (earliest && time24 < earliest) return true;

    return false;
  }

  // Days dropdown
  const days = useMemo(() => {
    const now = chicagoNow(TIMEZONE);
    const labelFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
      month: "short",
      day: "2-digit",
    });

    const list = [];
    for (let i = 0; i < DAYS_AHEAD; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      list.push({
        iso: toIsoDateInChicago(d, TIMEZONE),
        label: labelFmt.format(d),
      });
    }
    return list;
  }, [DAYS_AHEAD]);

  const times = useMemo(
    () => generateTimes(START_TIME, END_TIME, STEP_MINUTES),
    []
  );

  const stops = useMemo(() => {
    return stopsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [stopsText]);

  const canQuote =
    !!rideDate &&
    !!rideTime &&
    !!pickup &&
    !!dropoff &&
    !loading &&
    !isDayUnavailable(rideDate) &&
    !isTimeBlocked(rideDate, rideTime);

  // ===== Actions =====
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
          stops,     // ✅ include stops
          rideDate,  // ✅ include booking info for future
          rideTime,
        }),
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
        body: JSON.stringify({
          amount: result.price,
          pickup,
          dropoff,
          stops,
          rideDate,
          rideTime,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || `Checkout failed (${res.status})`);
      }
      if (!data.url) throw new Error("Checkout failed: missing Stripe URL");

      window.location.assign(data.url);
    } catch (e) {
      alert(e?.message || "Checkout failed");
      console.error(e);
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
      {/* HEADER */}
      <div style={{ marginBottom: 18 }}>
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

      {/* DATE + TIME */}
      <select
        value={rideDate}
        onChange={(e) => {
          setRideDate(e.target.value);
          setRideTime("");
        }}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 10,
          borderRadius: 10,
          textAlign: "center",
          border: "1px solid #ddd",
          cursor: "pointer",
        }}
      >
        <option value="">Select day</option>
        {days.map((d) => {
          const blocked = isDayUnavailable(d.iso);
          return (
            <option key={d.iso} value={d.iso} disabled={blocked}>
              {d.label} {blocked ? "— Unavailable" : ""}
            </option>
          );
        })}
      </select>

      <select
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        disabled={!rideDate || isDayUnavailable(rideDate)}
        style={{
          width: "100%",
          padding: 12,
          marginBottom: 6,
          borderRadius: 10,
          textAlign: "center",
          border: "1px solid #ddd",
          cursor: !rideDate || isDayUnavailable(rideDate) ? "not-allowed" : "pointer",
          opacity: !rideDate || isDayUnavailable(rideDate) ? 0.55 : 1,
        }}
      >
        <option value="">Select time</option>
        {times.map((t) => {
          const blocked = isTimeBlocked(rideDate, t);
          return (
            <option key={t} value={t} disabled={blocked}>
              {formatTimeLabel(t)} {blocked ? "— Unavailable" : ""}
            </option>
          );
        })}
      </select>

      <p style={{ fontSize: 12, opacity: 0.7, marginTop: 0, marginBottom: 14 }}>
        Book at least 2 hours in advance. You can book up to 30 days ahead.
      </p>

      {/* ADDRESSES (with autocomplete) */}
      <AddressInput
        label="Pickup"
        placeholder="Pickup address"
        value={pickup}
        onChange={setPickup}
      />

      <AddressInput
        label="Dropoff"
        placeholder="Dropoff address"
        value={dropoff}
        onChange={setDropoff}
      />

      {/* STOPS */}
      <div style={{ width: "100%", marginBottom: 12 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
          Stops (optional — one per line)
        </div>
        <textarea
          value={stopsText}
          onChange={(e) => setStopsText(e.target.value)}
          placeholder={"Add stops here...\nExample:\n1) 123 Main St\n2) 456 Oak Ave"}
          rows={4}
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 10,
            border: "1px solid #ddd",
            textAlign: "left",
            resize: "vertical",
          }}
        />
      </div>

      {/* GET PRICE */}
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

      {/* RESULT + PAY */}
      {result && (
        <div style={{ marginTop: 20 }}>
          <p style={{ marginBottom: 8 }}>Billable Time: {result.billableMinutes} minutes</p>
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
