import React, { useState } from "react";
import {
  LayoutDashboard, Package, Wallet, Megaphone, Users2, Radio,
  ChevronsLeft, ChevronsRight, Search, Bell, Sparkles,
} from "lucide-react";
import PesananTab from "./tabs/PesananTab";
import PenghasilanTab from "./tabs/PenghasilanTab";
import { ComingSoon } from "./components/ui";

const MENU = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "pesanan", label: "Pesanan", icon: Package },
  { key: "penghasilan", label: "Penghasilan", icon: Wallet },
  { key: "ads", label: "Ads", icon: Megaphone },
  { key: "affiliate", label: "Affiliate", icon: Users2 },
  { key: "live", label: "Live", icon: Radio },
];

const TITLES = {
  overview: ["Overview", "Ringkasan pesanan, iklan, dan penghasilan toko"],
  pesanan: ["Pesanan", "Pantau status dan resume pesanan tokomu"],
  penghasilan: ["Penghasilan", "Rincian pendapatan dan saldo yang bisa ditarik"],
  ads: ["Ads", "Performa kampanye iklan tokomu"],
  affiliate: ["Affiliate", "Kinerja kreator yang mempromosikan produkmu"],
  live: ["Live", "Statistik penjualan dari siaran langsung"],
};

export default function App() {
  const [tab, setTab] = useState("pesanan");
  const [collapsed, setCollapsed] = useState(false);
  const [title, subtitle] = TITLES[tab];

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#f9f9f7",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "row",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .mq-root { flex-direction: column !important; }
          .mq-sidebar { width: 100% !important; height: auto !important; flex-direction: row !important; align-items: center !important; padding: 8px 10px !important; border-right: none !important; border-bottom: 1px solid #26262b !important; overflow-x: auto !important; }
          .mq-sb-brand { border-bottom: none !important; margin: 0 10px 0 0 !important; padding: 0 10px 0 2px !important; border-right: 1px solid #26262b !important; }
          .mq-sb-brand-text { display: none !important; }
          .mq-menu { flex-direction: row !important; gap: 4px !important; width: max-content !important; }
          .mq-menu button { padding: 8px 10px !important; }
          .mq-toggle { display: none !important; }
          .mq-grid3 { grid-template-columns: 1fr 1fr !important; }
          .mq-content { padding: 14px !important; }
        }
      `}</style>

      <div className="mq-root" style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
        <div
          className="mq-sidebar"
          style={{
            width: collapsed ? 64 : 224,
            background: "#1a1a19",
            padding: collapsed ? "14px 8px" : "16px 14px",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            transition: "width .2s ease, padding .2s ease",
            overflowY: "auto",
          }}
        >
          <div className="mq-sb-brand" style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, marginBottom: 10, borderBottom: "1px solid #2c2c2a" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#4a3aa7,#2a78d6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Sparkles size={17} color="#fff" strokeWidth={2.3} />
            </div>
            {!collapsed && (
              <div className="mq-sb-brand-text" style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>MP Qukis</div>
                <div style={{ color: "#898781", fontSize: 10.5, whiteSpace: "nowrap", marginTop: 1 }}>mpqukis.web.id — preview</div>
              </div>
            )}
          </div>

          <button
            className="mq-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{ display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-end", padding: "8px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent", color: "#898781", marginBottom: 8 }}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>

          <div className="mq-menu" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MENU.map((m) => {
              const active = tab === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setTab(m.key)}
                  title={m.label}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "10px 12px",
                    borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left",
                    background: active ? "rgba(74,58,167,0.28)" : "transparent",
                  }}
                >
                  <Icon size={16} color={active ? "#b9a9f2" : "#898781"} strokeWidth={2.2} />
                  {!collapsed && (
                    <span style={{ fontSize: 13.5, color: active ? "#fff" : "#c3c2b7", fontWeight: active ? 600 : 500 }}>{m.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!collapsed && (
            <div style={{ marginTop: "auto", padding: "13px 14px", borderRadius: 12, background: "linear-gradient(160deg,#4a3aa7,#2a78d6)" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>Toko terhubung</div>
              <div style={{ fontSize: 13.5, color: "#fff", fontWeight: 700 }}>Generos Official Store</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>Shopee · single-tenant</div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 26px", background: "#fff", borderBottom: "1px solid #ECECE7", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: "#0b0b0b" }}>{title}</div>
              <div style={{ fontSize: 12.5, color: "#898781", marginTop: 1 }}>{subtitle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Search size={17} color="#52514e" />
              <Bell size={17} color="#52514e" />
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#4a3aa7,#2a78d6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>Q</div>
            </div>
          </div>

          <div className="mq-content" style={{ flex: 1, minHeight: 0, padding: "22px 26px", overflowY: "auto" }}>
            {tab === "pesanan" && <PesananTab />}
            {tab === "penghasilan" && <PenghasilanTab />}
            {tab !== "pesanan" && tab !== "penghasilan" && <ComingSoon label={TITLES[tab][0]} />}
          </div>
        </div>
      </div>
    </div>
  );
}
