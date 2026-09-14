import React from "react";

export function StatCard({ icon: Icon, label, value, accent = "#4a3aa7", sub }) {
  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${accent} 0%, ${accent}b3 100%)`,
        borderRadius: 16,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        boxShadow: `0 10px 24px ${accent}33`,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", fontWeight: 500, fontFamily: "Inter, sans-serif" }}>{label}</span>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={15} color="#fff" strokeWidth={2.3} />
          </div>
        )}
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600, color: "#fff", letterSpacing: "-0.01em" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.78)", fontFamily: "Inter, sans-serif" }}>{sub}</div>}
    </div>
  );
}

export function Card({ title, subtitle, children, right }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ECECE7", borderRadius: 14, boxShadow: "0 1px 2px rgba(11,11,11,0.03), 0 4px 14px rgba(11,11,11,0.04)", padding: "18px 20px" }}>
      {(title || right) && (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            {title && <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: "#0b0b0b" }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: "#898781", marginTop: 2, fontFamily: "Inter, sans-serif" }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Pill({ active, color, label, count, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "8px 14px",
        borderRadius: 999,
        cursor: "pointer",
        border: active ? `1.5px solid ${color}` : "1.5px solid #ECECE7",
        background: active ? `${color}14` : "#fff",
        fontFamily: "Inter, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        color: active ? "#0b0b0b" : "#52514e",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {label}
      <span style={{ color: "#898781", fontWeight: 500 }}>{count}</span>
    </button>
  );
}

export function ComingSoon({ label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "90px 20px", gap: 6, textAlign: "center" }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#52514e", fontFamily: "'Space Grotesk', sans-serif" }}>{label} — segera hadir</div>
      <div style={{ fontSize: 12.5, color: "#898781", fontFamily: "Inter, sans-serif" }}>Tab ini nyusul setelah arah visual & data-nya di-approve.</div>
    </div>
  );
}
