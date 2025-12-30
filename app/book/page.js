"use client";
import { useEffect, useMemo, useRef, useState } from "react";

function formatDateLabel(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function buildTimeOptions(stepMinutes = 15) {
  const out = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

/**
 * Autocomplete input that calls your deployed endpoint:
 *   /api/places?input=...
 * which returns: { predictions: [{ description, place_id }, ...] }
 */
function AutocompleteInput({
  value,
  onChange,
  placeholder,
  inputId,
}) {
  const [open, setOpen] = useState(false);
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    function onDocClick(e) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const q = (value || "").trim();
    if (q.length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }

    const now = Date.now();
    lastFetchRef.current = now;

    const t = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/places?input=${encodeURIComponent(q)}`);
        const data = await res.json().catch(() => ({}));

        // prevent out-of-order responses from flashing
        if (lastFetchRef.current !== now) return;

        const preds = Array.isArray(data?.predictions) ? data.predictions : [];
        setPredictions(preds);
        setOpen(true);
        setActiveIdx(-1);
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => clearTimeout(t);
  }, [value]);

  function choose(desc) {
    onChange(desc);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open || predictions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, predictions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIdx >= 0) {
        e.preventDefault();
        choose(predictions[activeIdx].description);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="acWrap" ref={wrapRef}>
      <input
        id={inputId}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          if (predictions.length > 0) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck={false}
      />

      {/* small loading hint */}
      {loading && <div className="acHint">Searching…</div>}

      {open && predictions.length > 0 && (
        <div className="acMenu">
          {predictions.map((p, idx) => (
            <button
              type="button"
              key={p.place_id || `${p.description}-${idx}`}
              className={`acItem ${idx === activeIdx ? "active" : ""}`}
              onMouseDown={(e) => e.preventDefault()} // prevent blur before click
              onClick={() => choose(p.description)}
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
  // customer
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // route
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [stops, setStops] = useState([]);

  // scheduling
  const [rideDate, setRideDate] = useState("");
  const [rideTime, setRideTime] = useState("");
  const [passengers, setPassengers] = useState(0); // additional passengers 0–3

  // quote/payment
  const [loading, setLoading] = useState(false);
  const [quoteResult, setQuoteResult] = useState(null);
  const [error, setError] = useState(null);

  // Build date options (next 30 days)
  const dateOptions = useMemo(() => {
    const out = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = pad2(d.getMonth() + 1);
      const dd = pad2(d.getDate());
      const value = `${yyyy}-${mm}-${dd}`;
      out.push({ value, label: `${formatDateLabel(d)} (${value})` });
    }
    return out;
  }, []);

  const timeOptions = useMemo(() => buildTimeOptions(15), []);

  // Minimum 2 hours in advance rule (only disables times on today’s date)
  const disabledTimesForSelectedDate = useMemo(() => {
    if (!rideDate) return new Set();

    const now = new Date();
    const todayValue = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;

    // If not today, nothing disabled by the 2-hour rule
    if (rideDate !== todayValue) return new Set();

    const min = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const minHH = min.getHours();
    const minMM = min.getMinutes();

    const s = new Set();
    for (const t of timeOptions) {
      const [hh, mm] = t.split(":").map(Number);
      if (hh < minHH || (hh === minHH && mm < minMM)) s.add(t);
    }
    return s;
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
    setQuoteResult(null);

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

      setQuoteResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function payNow() {
    if (!quoteResult?.price) return;

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: quoteResult.price,
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

  return (
    <main className="page">
      <style>{`
        .page {
          max-width: 480px;
          margin: 40px auto;
          padding: 0 16px;
          font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
          text-align: center;
        }

        .brand {
          margin-bottom: 18px;
        }

        .brand img {
          width: 90px;
          height: auto;
          display: block;
          margin: 0 auto 8px;
        }

        .brand .sub {
          font-size: 13px;
          letter-spacing: 1px;
          opacity: 0.85;
        }

        .field {
          width: 100%;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 10px;
          border: 1px solid #cfcfcf;
          background: #fff;
          color: #444;              /* ✅ selected/typed text lighter than before */
          font-size: 14px;
          text-align: center;
          outline: none;
        }

        .field::placeholder {
          color: #9a9a9a;            /* ✅ placeholder lighter */
          font-weight: 500;
        }

        select.field {
          appearance: none;
          -webkit-appearance: none;
        }

        .note {
          font-size: 12px;
          opacity: 0.8;
          margin: 6px 0 14px;
        }

        .btn {
          width: 100%;
          padding: 14px;
          border-radius: 10px;
          border: 2px solid #000;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.05s ease, opacity 0.2s ease;
        }

        .btnPrimary {
          background: #000;
          color: #fff;
        }

        .btnPrimary[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btnOutline {
          background: #fff;
          color: #000;
        }
        .btnOutline:hover {
          background: #000;
          color: #fff;
        }

        /* Autocomplete UI */
        .acWrap {
          position: relative;
        }
        .acHint {
          position: absolute;
          right: 10px;
          top: 10px;
          font-size: 12px;
          color: #777;
          background: rgba(255,255,255,0.9);
          padding: 2px 6px;
          border-radius: 8px;
        }
        .acMenu {
          position: absolute;
          z-index: 50;
          left: 0;
          right: 0;
          top: 46px;
          background: #fff;
          border: 1px solid #d9d9d9;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 10px 25px rgba(0,0,0,0.08);
          text-align: left;
        }
        .acItem {
          display: block;
          width: 100%;
          border: none;
          background: #fff;
          padding: 10px 12px;
          cursor: pointer;
          color: #111;              /* ✅ dropdown text dark/bold so you can read it */
          font-weight: 600;
          font-size: 14px;
          line-height: 1.2;
        }
        .acItem:hover, .acItem.active {
          background: #f2f2f2;
        }

        .stopsHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 4px 0 6px;
          gap: 10px;
        }

        .stopRow {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .stopRemove {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          border: 1px solid #cfcfcf;
          background: #fff;
          cursor: pointer;
          font-weight: 900;
        }

        .smallBtn {
          padding: 10px 12px;
          border-radius: 10px;
          border: 1px solid #cfcfcf;
          background: #fff;
          cursor: pointer;
          font-weight: 800;
        }

        .disabledOption {
          color: #aaa;
        }
      `}</style>

      <div className="brand">
        <img src="/tempmotion-logo.jpg" alt="Tempmotion Logo" />
        <div className="sub">Private Transportation • Chicago</div>
      </div>

      {/* Contact */}
      <input
        className="field"
        placeholder="Full name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        className="field"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {/* Route (with autocomplete dropdowns) */}
      <AutocompleteInput
        inputId="pickup"
        placeholder="Pickup address"
        value={pickup}
        onChange={setPickup}
      />

      <AutocompleteInput
        inputId="dropoff"
        placeholder="Dropoff address"
        value={dropoff}
        onChange={setDropoff}
      />

      {/* Stops (unlimited, each with autocomplete) */}
      <div className="stopsHeader">
        <div style={{ fontWeight: 800, opacity: 0.85 }}>Stops (optional)</div>
        <button type="button" className="smallBtn" onClick={addStop}>
          + Add stop
        </button>
      </div>

      {stops.map((s, idx) => (
        <div className="stopRow" key={idx}>
          <div style={{ flex: 1 }}>
            <AutocompleteInput
              inputId={`stop-${idx}`}
              placeholder={`Stop ${idx + 1}`}
              value={s}
              onChange={(v) => updateStop(idx, v)}
            />
          </div>
          <button type="button" className="stopRemove" onClick={() => removeStop(idx)}>
            ✕
          </button>
        </div>
      ))}

      {/* Date / Time / Passengers dropdowns */}
      <select
        className="field"
        value={rideDate}
        onChange={(e) => setRideDate(e.target.value)}
      >
        <option value="">Select date (next 30 days)</option>
        {dateOptions.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>

      <select
        className="field"
        value={rideTime}
        onChange={(e) => setRideTime(e.target.value)}
        disabled={!rideDate}
      >
        <option value="">
          {!rideDate ? "Select date first" : "Select time (15-min increments)"}
        </option>
        {timeOptions.map((t) => {
          const disabled = disabledTimesForSelectedDate.has(t);
          return (
            <option key={t} value={t} disabled={disabled} className={disabled ? "disabledOption" : ""}>
              {disabled ? `${t} (unavailable)` : t}
            </option>
          );
        })}
      </select>

      <select
        className="field"
        value={passengers}
        onChange={(e) => setPassengers(Number(e.target.value))}
      >
        <option value={0}>Additional passengers: 0</option>
        <option value={1}>Additional passengers: 1</option>
        <option value={2}>Additional passengers: 2</option>
        <option value={3}>Additional passengers: 3</option>
      </select>

      <div className="note">
        Must book at least <b>2 hours</b> in advance. (Times inside the next 2 hours are disabled.)
      </div>

      {/* Actions */}
      <button
        className="btn btnPrimary"
        onClick={getQuote}
        disabled={loading || !pickup || !dropoff}
        onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.99)")}
        onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {loading ? "Calculating..." : "Get Price"}
      </button>

      {error && <p style={{ color: "red", marginTop: 12 }}>{error}</p>}

      {quoteResult && (
        <div style={{ marginTop: 18 }}>
          {"trafficMinutes" in quoteResult && (
            <p style={{ margin: 0, opacity: 0.85 }}>
              Estimated minutes: <b>{quoteResult.trafficMinutes}</b>
            </p>
          )}
          <h2 style={{ margin: "8px 0 0" }}>${Number(quoteResult.price).toFixed(2)}</h2>

          <button
            className="btn btnOutline"
            style={{ marginTop: 12 }}
            onClick={payNow}
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