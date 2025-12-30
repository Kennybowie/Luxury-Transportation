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

    // stable value for backend
    const value = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

    // label: no year, no parentheses
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
    for (let m = 0; m < 60; m += step) {
      out.push(`${pad2(h)}:${pad2(m)}`); // value stays HH:mm for backend
    }
  }
  return out;
}

function formatTimeLabel(hhmm) {
  // "HH:mm" -> "h:mm AM/PM"
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(m)} ${ampm}`;
}

function todayYMD() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ---------- Autocomplete Input (uses your /api/places) ---------- */
function AutocompleteInput({ value, onChange, placeholder, inputStyle }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const lastReqRef = useRef(0);

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 2) {
      setPreds([]);
      setOpen(false);
      return;
    }

    const reqId = Date.now();
    lastReqRef.current = reqId;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?input=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));
        if (lastReqRef.current !== reqId) return;

        const list = Array.isArray(data?.predictions) ? data.predictions : [];
        setPreds(list);
        setOpen(list.length > 0);
        setActiveIdx(-1);
      } catch {
        // ignore
      }
    }, 180);

    return () => clearTimeout(t);
  }, [value]);

  function choose(desc) {
    onChange(desc);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open || preds.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, preds.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        choose(preds[activeIdx].description);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div style={{ position: "relative" }} ref={wrapRef}>
      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => preds.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle}
      />

      {open && preds.length > 0 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: "44px",
            zIndex: 50,
            background: "#fff",
            border: "1px solid #d9d9d9",
            borderRadius: 10,
            overflow: "hidden",
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            textAlign: "left",
          }}
        >
          {preds.map((p, idx) => (
            <button
              type="button"
              key={p.place_id || `${p.description}-${idx}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p.description)}
              style={{
                width: "100%",
                border: "none",
                background: idx === activeIdx ? "#f2f2f2" : "#fff",
                padding: "10px 12px",
                cursor: "pointer",
                color: "#111",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {p.description}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BookPage() {
  // scheduling
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");

  // route
  const [pickup, setPickup] = useState("");
  const [stops, setStops] = useState([]);
  const [dropoff, setDropoff] = useState("");

  // additional passengers (0–3)
  const [passengers, setPassengers] = useState(0);

  // quote/payment
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const dateOptions = useMemo(() => buildDateOptions(30), []);
  const timeOptions = useMemo(() => buildTimeOptions(15), []);

  // 2 hours in advance: disable times only if selected date is today
  const disabledTimes = useMemo(() => {
    const set = new Set();
    if (!rideDate) return set;

    if (rideDate !== todayYMD()) return set;

    const now = new Date();
    const min = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const minH = min.getHours();
    const minM = min.getMinutes();

    for (const t of timeOptions) {
      const [h, m] = t.split(":").map(Number);
      if (h < minH || (h === minH && m < minM)) set.add(t);
    }
    return set;
  }, [rideDate, timeOptions]);

  function addStop() {
    setStops((s) => [...s, ""]);
  }
  function updateStop(i, val) {
    setStops((s) => s.map((x, idx) => (idx === i ? val : x)));
  }
  function removeStop(i) {
    setStops((s) => s.filter((_, idx) => idx !== i));
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

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = [data.error, data.details, data.message].filter(Boolean).join(" — ");
        throw new Error(details || "Quote failed");
      }

      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function payNow() {
    if (!result?.price) return;

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
          passengers,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data.error || data.message || `Checkout failed (${res.status})`);
      }

      window.location.assign(data.url);
    } catch (e) {
      alert(e.message);
      console.error(e);
    }
  }

  /* --- Simple styling like your original --- */
  const mainStyle = {
    maxWidth: 480,
    margin: "40px auto",
    fontFamily: "sans-serif",
    textAlign: "center",
    padding: "0 16px",
  };

  const inputStyle = {
    width: "100%",
    padding: 10,
    marginBottom: 10,
    textAlign: "center",
    borderRadius: 10,
    border: "1px solid #cfcfcf",
    fontSize: 14,
    color: "#555",
    outline: "none",
  };

  const selectStyle = {
    ...inputStyle,
    backgroundColor: "#fff",
  };

  const primaryBtnStyle = {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    border: "2px solid #000",
    background: loading || !pickup || !dropoff ? "#e5e5e5" : "#000",
    color: loading || !pickup || !dropoff ? "#666" : "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: loading || !pickup || !dropoff ? "not-allowed" : "pointer",
    transition: "transform 0.05s ease, opacity 0.2s ease",
  };

  const outlineBtnStyle = {
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
  };

  return (
    <main style={mainStyle}>
      {/* logo + subtitle */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
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

      {/* Date first */}
      <select value={rideDate} onChange={(e) => setRideDate(e.target.value)} style={selectStyle}>
        <option value="">Select date</option>
        {dateOptions.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      {/* Time second (AM/PM labels) */}
      <select
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        style={selectStyle}
        disabled={!rideDate}
      >
        <option value="">{!rideDate ? "Select date first" : "Select time"}</option>
        {timeOptions.map((t) => {
          const disabled = disabledTimes.has(t);
          return (
            <option key={t} value={t} disabled={disabled}>
              {disabled ? `${formatTimeLabel(t)} (unavailable)` : formatTimeLabel(t)}
            </option>
          );
        })}
      </select>

      {/* ✅ Must book note directly UNDER time */}
      <p style={{ fontSize: 12, opacity: 0.8, margin: "0 0 14px" }}>
        Must book at least <b>2 hours</b> in advance.
      </p>

      {/* Additional passengers */}
      <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} style={selectStyle}>
        <option value={0}>Additional passengers: 0</option>
        <option value={1}>Additional passengers: 1</option>
        <option value={2}>Additional passengers: 2</option>
        <option value={3}>Additional passengers: 3</option>
      </select>

      {/* Pickup */}
      <AutocompleteInput
        placeholder="Pickup address"
        value={pickup}
        onChange={setPickup}
        inputStyle={inputStyle}
      />

      {/* ✅ Stops BETWEEN pickup and dropoff */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "6px 0 6px" }}>
        <div style={{ fontWeight: 700, opacity: 0.9, color: "#111" }}>Stops (optional)</div>

        <button
          type="button"
          onClick={addStop}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #cfcfcf",
            background: "#fff",
            cursor: "pointer",
            fontWeight: 800,
            color: "#111", // ✅ black text
          }}
        >
          + Add stop
        </button>
      </div>

      {stops.map((s, idx) => (
        <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ flex: 1 }}>
            <AutocompleteInput
              placeholder={`Stop ${idx + 1}`}
              value={s}
              onChange={(v) => updateStop(idx, v)}
              inputStyle={inputStyle}
            />
          </div>

          <button
            type="button"
            onClick={() => removeStop(idx)}
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              border: "1px solid #cfcfcf",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 900,
              color: "#111",
            }}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Dropoff */}
      <AutocompleteInput
        placeholder="Dropoff address"
        value={dropoff}
        onChange={setDropoff}
        inputStyle={inputStyle}
      />

      {/* Get Price */}
      <button
        onClick={getQuote}
        disabled={loading || !pickup || !dropoff}
        style={primaryBtnStyle}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

      {/* Result + Pay Now */}
      {result && (
        <div style={{ marginTop: 20 }}>
          {"trafficMinutes" in result && (
            <p style={{ margin: 0, opacity: 0.85 }}>
              Estimated minutes: <b>{result.trafficMinutes}</b>
            </p>
          )}

          <h2 style={{ marginTop: 8 }}>${Number(result.price).toFixed(2)}</h2>

          <button
            onClick={payNow}
            style={outlineBtnStyle}
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