import React, { useState } from "react";
import { RANGE_FILTERS, RANGE_PRESETS, fmtDmy } from "../lib/dateRange";

// Port dari RangeCalendar (ShopeePartnerDashboard.jsx) — kalender 2 bulan, pilih rentang
// dengan 2 klik (awal lalu akhir), preset di panel kiri. Warna disesuaikan ke brand baru.

const _BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const _HR = ["M", "S", "S", "R", "K", "J", "S"];

export default function RangeCalendar({ from, to, maxDate, onApply, onClose }) {
  const today = new Date();
  const base = from ? new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const [selFrom, setSelFrom] = useState(from || null);
  const [selTo, setSelTo] = useState(to || null);
  const [fromTxt, setFromTxt] = useState(fmtDmy(from));
  const [toTxt, setToTxt] = useState(fmtDmy(to));

  const shift = (delta) => {
    let m = view.m + delta;
    let y = view.y;
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setView({ y, m });
  };

  const pickDay = (y, m, d) => {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (maxDate && iso > maxDate) return;
    if (!selFrom || (selFrom && selTo)) {
      setSelFrom(iso);
      setSelTo(null);
      setFromTxt(fmtDmy(iso));
      setToTxt("");
    } else {
      const a = iso < selFrom ? iso : selFrom;
      const b = iso < selFrom ? selFrom : iso;
      setSelFrom(a);
      setSelTo(b);
      setFromTxt(fmtDmy(a));
      setToTxt(fmtDmy(b));
      onApply(a, b);
      onClose();
    }
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  const renderMonth = (y, m) => {
    const dim = daysInMonth(y, m);
    const firstDow = new Date(y, m, 1).getDay();
    const offset = (firstDow + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push(<div key={`sp${i}`} style={{ width: 34, height: 30, margin: 1 }} />);
    for (let d = 1; d <= dim; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let bg = "#fff", color = "#0b0b0b", radius = 0;
      const inRange = selFrom && selTo && iso >= selFrom && iso <= selTo;
      const isStart = selFrom === iso;
      const isEnd = selTo === iso;
      if (inRange) bg = "#EDE9F9";
      if (isStart || isEnd) { bg = "#4a3aa7"; color = "#fff"; radius = 8; }
      const disabled = maxDate && iso > maxDate;
      cells.push(
        <div
          key={iso}
          onClick={() => !disabled && pickDay(y, m, d)}
          style={{
            width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: disabled ? "default" : "pointer",
            background: bg, color: disabled ? "#D8D2CE" : color, borderRadius: radius, margin: 1,
          }}
        >
          {d}
        </div>
      );
    }
    return (
      <div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: "#0b0b0b", fontFamily: "'Space Grotesk', sans-serif" }}>
          {_BLN[m]} {y}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,34px)", gap: 1, justifyContent: "center" }}>
          {_HR.map((h, i) => <div key={i} style={{ width: 34, textAlign: "center", fontSize: 10.5, color: "#898781", paddingBottom: 4 }}>{h}</div>)}
          {cells}
        </div>
      </div>
    );
  };

  const view2 = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };

  const quickApply = (key) => {
    const fn = RANGE_PRESETS[key];
    if (!fn) return;
    const { from: f, to: t } = fn();
    if (maxDate && t > maxDate) return;
    setSelFrom(f);
    setSelTo(t);
    setFromTxt(fmtDmy(f));
    setToTxt(fmtDmy(t));
    onApply(f, t);
    onClose();
  };

  return (
    <div
      style={{
        position: "absolute", zIndex: 50, top: "calc(100% + 6px)", left: 0,
        background: "#fff", border: "1px solid #ECECE7", borderRadius: 14, boxShadow: "0 10px 30px rgba(11,11,11,.14)",
        padding: "14px 16px", width: 700, maxWidth: "94vw",
      }}
    >
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 118, borderRight: "1px solid #ECECE7", paddingRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#898781", marginBottom: 4, fontFamily: "Inter, sans-serif", letterSpacing: 0.4 }}>PRESET</div>
          {RANGE_FILTERS.map((f) => {
            const pd = RANGE_PRESETS[f.key]();
            const active = from === pd.from && to === pd.to;
            return (
              <button
                key={f.key}
                onClick={() => quickApply(f.key)}
                style={{
                  textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: active ? "linear-gradient(135deg,#4a3aa7,#2a78d6)" : "transparent",
                  color: active ? "#fff" : "#3A3A40", fontSize: 12, fontWeight: active ? 700 : 500,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => shift(-1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#4a3aa7" }}>‹</button>
            <div style={{ display: "flex", gap: 24 }}>
              <div>{renderMonth(view.y, view.m)}</div>
              <div>{renderMonth(view2.y, view2.m)}</div>
            </div>
            <button onClick={() => shift(1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#4a3aa7" }}>›</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#898781" }}>Dari</span>
            <input value={fromTxt} readOnly placeholder="dd/mm/yyyy" style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #ECECE7", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <span style={{ fontSize: 12, color: "#898781" }}>sampai</span>
            <input value={toTxt} readOnly placeholder="dd/mm/yyyy" style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #ECECE7", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <button onClick={onClose} style={{ padding: "7px 12px", borderRadius: 9, border: "1px solid #ECECE7", background: "#fff", color: "#52514e", fontSize: 12.5, cursor: "pointer" }}>
              Batal
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#898781", textAlign: "center", marginTop: 8, fontFamily: "Inter, sans-serif" }}>
            Klik tanggal awal & akhir di kalender — rentang langsung diterapkan.
          </div>
        </div>
      </div>
    </div>
  );
}
