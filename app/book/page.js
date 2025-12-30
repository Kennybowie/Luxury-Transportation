"use client";
import { useMemo, useState } from "react";

export default function BookPage() {
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // ===== Availability settings =====
  const TIMEZONE = "America/Chicago";
  const MIN_HOURS_AHEAD = 2; // ✅ 2 hours in advance
  const DAYS_AHEAD = 14;
  const START_TIME = "08:00";
  const END_TIME = "22:00";
  const STEP_MINUTES = 15;

  // (Optional) Full-day blocks (YYYY-MM-DD)
  const UNAVAILABLE_DATES = useMemo(
    () =>
      new Set([
        // "2026-01-02",
      ]),
    []
  );

  // (Optional) Block entire weekdays (0=Sun ... 6=Sat)
  const UNAVAILABLE_WEEKDAYS = useMemo(
    () =>
      new Set([
        // 0, // Sunday
      ]),
    []
  );

  // (Optional) Time blocks by weekday (24h). Example:
  // 1 (Mon): [{start:"12:00", end:"13:00"}]
  const TIME_BLOCKS_BY_WEEKDAY = useMemo(
    () => ({
      // 1: [{ start: "12:00", end: "13:00" }],
    }),
    []
  );

  // ===== Helpers =====
  function chicagoNowDate() {
    // Create a Date object representing "now" in Chicago
    return new Date(new Date().toLocaleString("en-US", { timeZone: TIMEZONE }));
  }

  function toIsoDateInChicago(d) {
    // YYYY-MM-DD in Chicago
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  }

  function weekdayIndexInChicago(isoDate) {
    // Noon avoids DST edge cases
    const d = new Date(`${isoDate}T12:00:00`);
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
    }).format(d);
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[weekday];
  }

  function isDayUnavailable(isoDate) {
    if (!isoDate) return false;
    if (UNAVAILABLE_DATES.has(isoDate)) return true;
    const wd = weekdayIndexInChicago(isoDate);
    if (UNAVAILABLE_WEEKDAYS.has(wd)) return true;
    return false;
  }

  function generateNextDays(count = DAYS_AHEAD) {
    const now = chicagoNowDate();
    const labelFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      weekday: "short",
      month: "short",
      day: "2-digit",
    });

    const days = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const iso = toIsoDateInChicago(d);
      const label = labelFmt.format(d);
      days.push({ iso, label });
    }
    return days;
  }

  function generateTimes(start = START_TIME, end = END_TIME, step = STEP_MINUTES) {
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

  function formatTimeLabel(time24) {
    const [h, m] = time24.split(":").map(Number);
    const suffix = h >= 12 ? "PM" : "AM";
    const hr = ((h + 11) % 12) + 1;
    return `${hr}:${String(m).padStart(2, "0")} ${suffix}`;
  }

  function earliestAllowedTimeForDate(isoDate) {
    if (!isoDate) return null;

    const now = chicagoNowDate();
    const nowIso = toIsoDateInChicago(now);

    // Only enforce for today
    if (isoDate !== nowIso) return null;

    const cutoff = new Date(now.getTime() + MIN_HOURS_AHEAD * 60 * 60 * 1000);
    const hh = String(cutoff.getHours()).padStart(2, "0");
    const mm = String(cutoff.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  function isTimeBlocked(isoDate, time24) {
    if (!isoDate || !time24) return false;
    if (isDayUnavailable(isoDate)) return true;

    const wd = weekdayIndexInChicago(isoDate);
    const blocks = TIME_BLOCKS_BY_WEEKDAY[wd] || [];
    for (const b of blocks) {
      if (time24 >= b.start && time24 < b.end) return true;
    }

    // ⏱ 2-hour rule for same-day bookings
    const earliest = earliestAllowedTimeForDate(isoDate);
    if (earliest && time24 < earliest) return true;

    return false;
  }

  const days = useMemo(() => generateNextDays(DAYS_AHEAD), []);
  const times = useMemo(() => generateTimes(START_TIME, END_TIME, STEP_MINUTES), []);

  const canQuote = !!pickup && !!dropoff && !!rideDate && !!rideTime && !loading;

  // ===== Actions =====
  async function getQuote() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // We keep API compatible (pickup/dropoff), but also include date/time for later use
        body: JSON.stringify({ pickup, dropoff, rideDate, rideTime }),
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
        // amount only is required by your current API; date/time included for future upgrades
        body: JSON.stringify({ amount: result.price, rideDate, rideTime, pickup, dropoff }),
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
        Bookings must be made at least 2 hours in advance.
      </p>

      {/* ADDRESSES */}
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
