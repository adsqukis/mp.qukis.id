import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Package, Wallet, Megaphone, Users2, Radio, ChevronRight,
  ArrowUpRight, ArrowDownRight, Circle, Search, Bell, Store,
  ChevronsLeft, ChevronsRight, LayoutDashboard,
  Eye, MousePointerClick, Percent, ShoppingCart, Boxes, Banknote, TrendingUp,
} from "lucide-react";

const fmtRp = (n) =>
  "Rp " + Math.round(n).toLocaleString("id-ID");

const fmtRpShort = (n) => {
  if (Math.abs(n) >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  if (Math.abs(n) >= 1_000) return "Rp " + (n / 1_000).toFixed(0) + "rb";
  return fmtRp(n);
};

// ---------- mock data ----------

const ordersByDay = [
  { d: "Sen", total: 42 }, { d: "Sel", total: 38 }, { d: "Rab", total: 51 },
  { d: "Kam", total: 47 }, { d: "Jum", total: 63 }, { d: "Sab", total: 71 }, { d: "Min", total: 58 },
];

const orderStatus = [
  { label: "Perlu dikirim", value: 14, color: "#E5484D" },
  { label: "Diproses", value: 22, color: "#FFB020" },
  { label: "Dikirim", value: 35, color: "#2E6BE0" },
  { label: "Selesai", value: 210, color: "#1E9E6F" },
  { label: "Dibatalkan / retur", value: 9, color: "#8A8A93" },
];

const recentOrders = [
  { id: "SO25081234A7", buyer: "Rina W.", produk: "Serum Niacinamide 20ml", total: 89000, status: "Perlu dikirim" },
  { id: "SO25081234B2", buyer: "Dimas P.", produk: "Kaos Oversize Katun", total: 125000, status: "Diproses" },
  { id: "SO25081233F1", buyer: "Nadia S.", produk: "Case iPhone 14 Pro", total: 45000, status: "Dikirim" },
  { id: "SO25081231C9", buyer: "Budi H.", produk: "Sepatu Lari Mesh (2 pcs)", total: 398000, status: "Selesai" },
  { id: "SO25081230E4", buyer: "Alya F.", produk: "Tumbler Stainless 1L", total: 67000, status: "Dibatalkan" },
];

const statusColor = {
  "Perlu dikirim": "#E5484D", "Diproses": "#B8860B", "Dikirim": "#2E6BE0",
  "Selesai": "#1E9E6F", "Dibatalkan": "#8A8A93",
};

const adsCampaigns = [
  { name: "Iklan Pencarian - Skincare", spend: 1_200_000, gmv: 6_840_000, roas: 5.7, ctr: 2.4 },
  { name: "Iklan Toko - Semua Produk", spend: 850_000, gmv: 2_890_000, roas: 3.4, ctr: 1.1 },
  { name: "Iklan Discovery - Kaos Pria", spend: 640_000, gmv: 4_050_000, roas: 6.3, ctr: 3.0 },
  { name: "Iklan Pencarian - Aksesoris HP", spend: 410_000, gmv: 970_000, roas: 2.4, ctr: 0.8 },
];

const adsSpendTrend = [
  { d: "Minggu 1", spend: 2.1, gmv: 9.8 }, { d: "Minggu 2", spend: 2.8, gmv: 12.4 },
  { d: "Minggu 3", spend: 3.1, gmv: 15.7 }, { d: "Minggu 4", spend: 2.6, gmv: 11.1 },
];

const affiliates = [
  { rank: 1, name: "@dinaskincarereview", followers: "128rb", klik: 3420, order: 214, komisi: 4_280_000 },
  { rank: 2, name: "@fashiontips.id", followers: "84rb", klik: 2650, order: 156, komisi: 3_120_000 },
  { rank: 3, name: "@budgetgadget", followers: "61rb", klik: 1980, order: 98, komisi: 1_960_000 },
  { rank: 4, name: "@homeandliving_ta", followers: "45rb", klik: 1340, order: 71, komisi: 1_420_000 },
  { rank: 5, name: "@review_jujur99", followers: "37rb", klik: 990, order: 52, komisi: 980_000 },
];

const liveSessions = [
  { d: "18 Agu", gmv: 4.2 }, { d: "19 Agu", gmv: 2.1 }, { d: "20 Agu", gmv: 6.8 },
  { d: "21 Agu", gmv: 3.4 }, { d: "22 Agu", gmv: 7.9 }, { d: "23 Agu", gmv: 9.1 }, { d: "24 Agu", gmv: 5.6 },
];

const liveTopProducts = [
  { name: "Serum Niacinamide 20ml", qty: 214, gmv: 19_046_000 },
  { name: "Sunscreen Gel SPF50", qty: 176, gmv: 12_320_000 },
  { name: "Lip Cream Matte", qty: 140, gmv: 5_460_000 },
];

// ---------- shared bits ----------

// Terang-kan hex (buat gradient card colored-box ala template Fusion)
const lightenHex = (hex, f = 0.32) => {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r + (255 - r) * f);
  g = Math.round(g + (255 - g) * f);
  b = Math.round(b + (255 - b) * f);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

function StatCard({ icon: Icon, label, value, delta, deltaPositive = true, accent = "#7C5CBF", active = true, onClick = null }) {
  return (
    <div
      onClick={onClick}
      title={onClick ? (active ? "Klik untuk sembunyikan dari Total" : "Klik untuk tampilkan lagi") : undefined}
      style={{
        background: active ? `linear-gradient(135deg, ${accent} 0%, ${lightenHex(accent)} 100%)` : `linear-gradient(135deg, ${accent} 0%, ${lightenHex(accent)} 100%)`,
        border: active ? "1px solid rgba(255,255,255,0.18)" : "1px dashed rgba(255,255,255,0.6)",
        borderRadius: 14,
        boxShadow: active ? `0 8px 20px ${accent}38` : "none",
        padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0,
        opacity: active ? 1 : 0.45,
        cursor: onClick ? "pointer" : "default",
        transition: "opacity .15s ease, box-shadow .15s ease",
        userSelect: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.88)", fontFamily: "Inter, sans-serif" }}>{label}</span>
        <div style={{
          width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.25)",
        }}>
          <Icon size={16} color="#fff" strokeWidth={2.3} />
        </div>
      </div>
      <div style={{
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 23, fontWeight: 600,
        color: "#fff", letterSpacing: "-0.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{value}</div>
      {delta && (
        <div style={{
          display: "flex", alignItems: "center", gap: 3, fontSize: 12,
          color: "rgba(255,255,255,0.92)", fontFamily: "Inter, sans-serif", fontWeight: 500,
        }}>
          {deltaPositive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {delta}
        </div>
      )}
    </div>
  );
}

function Card({ title, subtitle, children, right }) {
  return (
    <div className="mp-card" style={{ background: "#fff", border: "1px solid #ECECEF", borderRadius: 14, boxShadow: "0 1px 2px rgba(23,23,26,0.03), 0 4px 14px rgba(23,23,26,0.04)", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14.5, color: "#17171A" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: "#8A8A82", marginTop: 2, fontFamily: "Inter, sans-serif" }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 600, color, background: color + "17",
      padding: "3px 9px", borderRadius: 6, fontFamily: "Inter, sans-serif", whiteSpace: "nowrap",
    }}>{text}</span>
  );
}

function InfoNote({ children }) {
  return (
    <div style={{
      fontSize: 12, color: "#8A6A3B", background: "#FFF6E6", border: "1px solid #F5E3BE",
      borderRadius: 10, padding: "9px 12px", marginBottom: 16, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
    }}>{children}</div>
  );
}

// ---------- tab content ----------

// ========== OVERVIEW — gabungan pesanan + iklan + penghasilan ==========
function TabOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = (showLoading) => {
      if (showLoading) setLoading(true);
      return Promise.all([
        fetch("https://api.qukis.id/api/export/summary").then((r) => r.json()).catch(() => null),
        fetch("https://api.qukis.id/api/ads/overview?days=7").then((r) => r.json()).catch(() => null),
        fetch("https://api.qukis.id/api/income/summary?days=30").then((r) => r.json()).catch(() => null),
      ])
        .then(([exp, ads, inc]) => {
          if (!active) return;
          setData({ exp: exp && !exp.error ? exp : null, ads: ads && !ads.error ? ads : null, inc: inc && !inc.error ? inc : null });
          setError(null);
        })
        .catch((e) => {
          if (!active) return;
          setError(String(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load(true);
    // Auto-refresh 60 detik: angka iklan ikut update tanpa reload halaman (backend cache 60s + warmer).
    const iv = setInterval(() => load(false), 60000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#8A8A82", fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>
        Memuat overview toko…
      </div>
    );
  }

  if (error) {
    return <InfoNote>Data overview gagal dimuat: {error}</InfoNote>;
  }

  const exp = data.exp;
  const ads = data.ads;
  const inc = data.inc;

  const so = (exp && exp.status_order) || {};
  const custAll = exp ? (exp.customer_nonbatal || 0) : 0;
  const totalOrder = exp ? (exp.total_order || 0) : 0;
  const at = (ads && ads.total) || {};
  const campaignInfo = (ads && ads.campaigns) || {};
  const incomeTotal = inc ? (inc.total_payout || 0) : 0;
  const incomeCount = inc ? (inc.payout_count || 0) : 0;
  const incomeDaily = (inc && inc.daily) || [];
  const nDays = incomeDaily.length;
  const incomeAvg = nDays > 0 ? Math.round(incomeTotal / nDays) : 0;

  // Metrik iklan (kolom Budget | Klik | Closing + Rasio); Box diisi item terjual kalau ada
  const adsMetrics = [
    { label: "Budget (7 hari)", value: at.expense != null ? fmtRp(at.expense) : "—", accent: "#7C5CBF" },
    { label: "Klik", value: at.clicks != null ? String(at.clicks) : "—", accent: "#2E6BE0" },
    { label: "Closing (order)", value: at.broad_order != null ? String(at.broad_order) : "—", accent: "#1E9E6F" },
    { label: "ROAS", value: at.broad_roas != null ? at.broad_roas + "x" : "—", accent: "#B8860B" },
  ];

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* ===== Baris ringkasan utama ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          <StatCard icon={Package} label="Pesanan (D-1)" value={totalOrder ? String(totalOrder) : "—"} accent="#D04C8F" />
          <StatCard icon={Megaphone} label="Belanja iklan 7 hari" value={at.expense != null ? fmtRpShort(at.expense) : "—"} accent="#875DBF" />
          <StatCard icon={Wallet} label="Payout masuk 30 hari" value={incomeTotal ? fmtRpShort(incomeTotal) : "—"} accent="#50B0E0" />
          <StatCard icon={Users2} label="Customer (D-1)" value={custAll ? String(custAll) : "—"} accent="#F09040" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 14 }}>
          {/* ===== Pesanan ===== */}
          <Card title="Pesanan — ringkasan D-1" subtitle={exp ? `Data ${exp.tanggal_data || "-"}` : "Belum ada data export"}>
            {exp ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
                <tbody>
                  {[
                    ["Perlu dikirim", so["Perlu dikirim"] || 0],
                    ["Sedang dikirim", (so["Sedang dikirim"] || 0) + (so["Telah dikirim"] || 0)],
                    ["Selesai", so["Selesai"] || 0],
                    ["Batal", so["Batal"] || 0],
                  ].map(([lbl, val]) => (
                    <tr key={lbl} style={{ borderTop: "1px solid #F1F1F4" }}>
                      <td style={{ padding: "8px 0", color: "#4A4A45" }}>{lbl}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>{val}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #E2E2E6" }}>
                    <td style={{ padding: "9px 0", fontWeight: 700, color: "#17171A" }}>Total pesanan</td>
                    <td style={{ padding: "9px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{totalOrder}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <InfoNote>Data pesanan belum tersedia — backend export summary belum ada.</InfoNote>
            )}
          </Card>

          {/* ===== Iklan ===== */}
          <Card title="Iklan — 7 hari" subtitle={ads ? `${campaignInfo.count || 0} campaign terdeteksi` : "Belum ada data iklan"}>
            {ads ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {adsMetrics.map((m) => (
                    <div key={m.label} style={{ background: "#F4F5F8", border: "1px solid #F5F5F7", borderRadius: 10, padding: "10px 12px" }}>
                      <div style={{ fontSize: 10.5, color: "#8A8A82", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px", fontFamily: "Inter, sans-serif" }}>{m.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: "#17171A", marginTop: 3, fontFamily: "'JetBrains Mono', monospace" }}>{m.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "#8A8A82", marginTop: 10, fontFamily: "Inter, sans-serif" }}>
                  {at.impressions != null && <>Impresi: {Number(at.impressions).toLocaleString("id-ID")} · </>}
                  GMV: {at.broad_gmv != null ? fmtRpShort(at.broad_gmv) : "—"}
                </div>
              </>
            ) : (
              <InfoNote>Data iklan belum tersedia — cek backend / token Shopee.</InfoNote>
            )}
          </Card>
        </div>

        {/* ===== Penghasilan ===== */}
        <Card title="Penghasilan — 30 hari" subtitle="Sumber: payment.get_escrow_list (uang bersih diterima)">
          {inc ? (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>Total payout</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 24, fontWeight: 700, color: "#17171A", marginTop: 2 }}>{fmtRp(incomeTotal)}</div>
              </div>
              <div style={{ borderLeft: "1px solid #ECECEF", paddingLeft: 14 }}>
                <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>Transaksi payout</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{incomeCount}</div>
              </div>
              <div style={{ borderLeft: "1px solid #ECECEF", paddingLeft: 14 }}>
                <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>Rata-rata / hari</div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{fmtRpShort(incomeAvg)}</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif", marginBottom: 6 }}>Payout per hari (30 hari terakhir)</div>
                <ResponsiveContainer width="100%" height={90}>
                  <AreaChart data={incomeDaily.map((x) => ({ date: x.date, v: x.total }))}>
                    <defs>
                      <linearGradient id="ovInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1E9E6F" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#1E9E6F" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #ECECEF" }} formatter={(v) => fmtRp(v)} labelFormatter={(l) => l} />
                    <Area type="monotone" dataKey="v" stroke="#1E9E6F" strokeWidth={2} fill="url(#ovInc)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <InfoNote>Data penghasilan belum tersedia.</InfoNote>
          )}
        </Card>
      </div>
    </>
  );
}

// Helper tanggal lokal (bukan UTC, biar gak geser 1 hari pas malam)
const isoDaysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

// Preset rentang tanggal — dipakai row filter & side panel kalender.
const RANGE_PRESETS = {
  today: () => ({ from: isoDaysAgo(0), to: isoDaysAgo(0) }),
  yesterday: () => ({ from: isoDaysAgo(1), to: isoDaysAgo(1) }),
  "7d": () => ({ from: isoDaysAgo(6), to: isoDaysAgo(0) }),
  month: () => ({ from: isoDaysAgo(29), to: isoDaysAgo(0) }),
  year: () => ({ from: isoDaysAgo(364), to: isoDaysAgo(0) }),
};
const RANGE_FILTERS = [
  { key: "today", label: "Hari ini" },
  { key: "yesterday", label: "Kemarin" },
  { key: "7d", label: "7 hari terakhir" },
  { key: "month", label: "Bulan" },
  { key: "year", label: "Tahun" },
];

// Produk (dropdown filter). key = pilihan UI, group = nama produk (backend by_produk).
// Generos Klasik = QKS-GEN01/02/03, 1 Botol = QKS-GEN1, Milk = GenMilk*/nama "Generos Milk".
const PRODUK_OPTIONS = [
  { key: "", label: "Semua produk", group: null },
  { key: "Klasik", label: "Generos Klasik", group: "Generos Klasik" },
  { key: "Botol", label: "Generos 1 Botol", group: "Generos 1 Botol" },
  { key: "Milk", label: "Generos Milk", group: "Generos Milk" },
];

// Match order/produk terhadap pilihan dropdown. Handle dua bentuk data:
// - summary builder: {sku, produk}
// - raw detail CSV: {item_list:[{item_sku,item_name}]}
const produkMatch = (o, key) => {
  if (!key) return true;
  const it = (o && o.item_list && o.item_list[0]) || o || {};
  const sku = String(it.item_sku || it.sku || "");
  const name = String(it.item_name || it.produk || "");
  if (key === "Milk") return /generos milk/i.test(name) || /^genmilk/i.test(sku);
  if (key === "Botol") return sku === "QKS-GEN1";
  if (key === "Klasik") return /^QKS-GEN0\d$/.test(sku); // QKS-GEN01/02/03
  return true;
};

// Status mentah Shopee API → label Indonesia (frontend, buat CSV & fallback).
const STATUS_LABEL_FRONT = {
  UNPAID: "Belum bayar",
  READY_TO_SHIP: "Perlu dikirim",
  PROCESSED: "Diproses",
  SHIPPED: "Dikirim",
  COMPLETED: "Selesai",
  IN_CANCEL: "Dibatalkan",
  CANCELLED: "Dibatalkan",
  CANCEL: "Dibatalkan",
  RETRY_SHIP: "Perlu dikirim",
  TO_RETURN: "Retur",
  INVOICE_PENDING: "Diproses",
};

// Nama pendek produk dari item_name (potong prefix toko).
const shortProduk = (name) => {
  if (!name) return "-";
  return name
    .replace(/^[^-]+-\s*/, "")
    .replace(/\s*-\s*Generos Official Store.*$/i, "")
    .trim() || name;
};

// Trigger download CSV client-side.
function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Date range calendar (2 bulan, pilih rentang) ----------
const _BLN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const _HR = ["M", "S", "S", "R", "K", "J", "S"]; // Senin pertama (kalender ala Shopee)

const fmtDmy = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const parseDmy = (s) => {
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = +m[1], mo = +m[2], y = +m[3];
  if (!(d >= 1 && d <= 31 && mo >= 1 && mo <= 12)) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

function RangeCalendar({ from, to, maxDate, onApply, onClose }) {
  const today = new Date();
  const base = from ? new Date(+from.slice(0, 4), +from.slice(5, 7) - 1, 1)
    : new Date(today.getFullYear(), today.getMonth(), 1);
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
      // Range lengkap → langsung apply, tanpa klik Terapkan
      onApply(a, b);
      onClose();
    }
  };

  const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

  const renderMonth = (y, m) => {
    const dim = daysInMonth(y, m);
    // offset per-bulan: Senin=0 (getDay: 0=Min..6=Sab → (firstDow+6)%7)
    const firstDow = new Date(y, m, 1).getDay();
    const offset = (firstDow + 6) % 7;
    const cells = [];
    for (let i = 0; i < offset; i++) {
      cells.push(<div key={`sp${i}`} style={{ width: 34, height: 30, margin: 1 }} />);
    }
    for (let d = 1; d <= dim; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      let bg = "#fff", color = "#17171A", radius = 0;
      const inRange = selFrom && selTo && iso >= selFrom && iso <= selTo;
      const isStart = selFrom === iso;
      const isEnd = selTo === iso;
      if (inRange) { bg = "#FDECEA"; }
      if (isStart || isEnd) { bg = "#7C5CBF"; color = "#fff"; radius = 8; }
      const disabled = maxDate && iso > maxDate;
      cells.push(
        <div key={iso} onClick={() => !disabled && pickDay(y, m, d)}
          style={{
            width: 34, height: 30, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontFamily: "'JetBrains Mono', monospace", cursor: disabled ? "default" : "pointer",
            background: bg, color: disabled ? "#D8D2CE" : color, borderRadius: radius, margin: 1,
          }}>{d}</div>
      );
    }
    return (
      <div>
        <div style={{ textAlign: "center", fontWeight: 700, fontSize: 13.5, marginBottom: 8, color: "#17171A", fontFamily: "'Space Grotesk', sans-serif" }}>
          {_BLN[m]} {y}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,34px)", gap: 1, justifyContent: "center" }}>
          {_HR.map((h, i) => <div key={i} style={{ width: 34, textAlign: "center", fontSize: 10.5, color: "#8A8A82", paddingBottom: 4 }}>{h}</div>)}
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
    <div style={{
      position: "absolute", zIndex: 50, top: "calc(100% + 6px)", left: 0,
      background: "#fff", border: "1px solid #E4E4E8", borderRadius: 14, boxShadow: "0 10px 30px rgba(23,23,26,.12)",
      padding: "14px 16px", width: 700, maxWidth: "94vw",
    }}>
      <div style={{ display: "flex", gap: 14 }}>
        {/* Side panel preset — klik langsung terapkan (gaya Shopee) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 118, borderRight: "1px solid #ECECEF", paddingRight: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8A82", marginBottom: 4, fontFamily: "Inter, sans-serif", letterSpacing: 0.4 }}>PRESET</div>
          {RANGE_FILTERS.map((f) => {
            const pd = RANGE_PRESETS[f.key]();
            const active = from === pd.from && to === pd.to;
            return (
              <button key={f.key} onClick={() => quickApply(f.key)} style={{
                textAlign: "left", padding: "7px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                background: active ? "linear-gradient(135deg,#7C5CBF,#5B7CFA)" : "transparent",
                color: active ? "#fff" : "#3A3A40", fontSize: 12, fontWeight: active ? 700 : 500,
                fontFamily: "Inter, sans-serif",
              }}>{f.label}</button>
            );
          })}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => shift(-1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#7C5CBF" }}>‹</button>
            <div style={{ display: "flex", gap: 24 }}>
              <div>{renderMonth(view.y, view.m)}</div>
              <div>{renderMonth(view2.y, view2.m)}</div>
            </div>
            <button onClick={() => shift(1)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 18, color: "#7C5CBF" }}>›</button>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginTop: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: "#8A8A82" }}>Dari</span>
            <input value={fromTxt} onChange={(e) => setFromTxt(e.target.value)} placeholder="dd/mm/yyyy"
              style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #E4E4E8", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <span style={{ fontSize: 12, color: "#8A8A82" }}>sampai</span>
            <input value={toTxt} onChange={(e) => setToTxt(e.target.value)} placeholder="dd/mm/yyyy"
              style={{ width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #E4E4E8", fontSize: 12, textAlign: "center", fontFamily: "'JetBrains Mono', monospace" }} />
            <button onClick={onClose} style={{
              padding: "7px 12px", borderRadius: 9, border: "1px solid #E4E4E8", background: "#fff",
              color: "#6B7280", fontSize: 12.5, cursor: "pointer",
            }}>Batal</button>
          </div>
          <div style={{ fontSize: 11, color: "#8A8A82", textAlign: "center", marginTop: 8, fontFamily: "Inter, sans-serif" }}>
            Klik tanggal awal & akhir di kalender — rentang langsung diterapkan.
          </div>
        </div>
      </div>
    </div>
  );
}

function TabPesanan() {
  const [range, setRange] = useState("7d");
  const [produk, setProduk] = useState("");
  const [csvBusy, setCsvBusy] = useState(false);
  const [customRange, setCustomRange] = useState(null); // {from, to} 'YYYY-MM-DD'
  const [fromVal, setFromVal] = useState(isoDaysAgo(6)); // default: 7 hari terakhir (hari ini - 6)
  const [toVal, setToVal] = useState(isoDaysAgo(0));
  const [data, setData] = useState(null);
  const [daily, setDaily] = useState(null);
  const [exp, setExp] = useState(null); // data export summary (file Shopee)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Card status yang "dipilih" user (klik) — Total = akumulasi card yang dipilih, mulai 0.
  const [activeCards, setActiveCards] = useState([]);
  // Popup kalender custom (pilih rentang, bukan ketik manual)
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    // Data card dari export summary: backend agregasi dari raw per tanggal + tarik
    // LIVE dari Shopee untuk tanggal yang raw-nya belum ada (hari ini).
    // Semua preset (termasuk 7d) kirim from/to supaya backend agregasi rentang asli —
    // sebelumnya 7d tidak kirim apa-apa → yang tampil file D-1 (angka kemarin), bukan 7 hari.
    const qs =
      customRange
        ? `?from=${customRange.from}&to=${customRange.to}`
        : (range && PRESET_DATES[range]
            ? (() => { const { from, to } = PRESET_DATES[range](); return `?from=${from}&to=${to}`; })()
            : "");
    // Chart harian ikut filter tanggal yang aktif (sebelumnya selalu 7d).
    const dailyQs = customRange
      ? `?range=custom&from=${customRange.from}&to=${customRange.to}`
      : (["today", "yesterday", "7d", "30d"].includes(range)
          ? `?range=${range}`
          : (PRESET_DATES[range]
              ? (() => { const { from, to } = PRESET_DATES[range](); return `?range=custom&from=${from}&to=${to}`; })()
              : "?range=7d"));
    const load = (showLoading) => {
      if (showLoading) setLoading(true);
      return Promise.all([
        fetch(`https://api.qukis.id/api/export/summary${qs}`).then((r) => r.json()).catch(() => null),
        fetch(`https://api.qukis.id/api/orders/daily${dailyQs}`).then((r) => r.json()).catch(() => ({ daily: [] })),
      ])
        .then(([sum, dl]) => {
          if (!active) return;
          setExp(sum && !sum.error ? sum : null);
          setDaily(dl.daily || []);
          setError(null);
        })
        .catch((e) => {
          if (!active) return;
          setError(String(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    load(true);
    // Auto-refresh 60 detik: tanggal yang raw-nya belum ada (hari ini) ditarik live dari Shopee.
    const iv = setInterval(() => load(false), 60000);
    return () => {
      active = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, customRange]);

  const applyCustom = () => {
    if (!fromVal || !toVal) return;
    if (toVal < fromVal) return;
    setCustomRange({ from: fromVal, to: toVal });
  };

  // Preset mapping: setiap tombol preset juga isi date input custom
  // biar tanggal di date picker selalu nyambung sama filter yang aktif.
  const PRESET_DATES = RANGE_PRESETS;
  const clickPreset = (key) => {
    setCalOpen(false);
    setCustomRange(null);
    setRange(key);
    const pd = PRESET_DATES[key];
    if (pd) {
      const { from, to } = pd();
      setFromVal(from);
      setToVal(to);
    }
  };

  const rangeLabel = customRange ? "Custom" : ((RANGE_FILTERS.find((f) => f.key === range) || {}).label || "7 hari terakhir");
  const FILTERS = RANGE_FILTERS;

  const isCustom = !!customRange;
  const todayISO = isoDaysAgo(0);
  const displayLabel = isCustom
    ? `${customRange.from.slice(8, 10)}/${customRange.from.slice(5, 7)} – ${customRange.to.slice(8, 10)}/${customRange.to.slice(5, 7)}`
    : rangeLabel;

  // Filter row selalu tampil — biar bisa ganti/batal filter meski lagi loading
  const filterRow = (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      {FILTERS.map((f) => (
        <button key={f.key} onClick={() => clickPreset(f.key)} style={{
          padding: "7px 16px", borderRadius: 9, border: !isCustom && range === f.key ? "1px solid #7C5CBF" : "1px solid #E4E4E8",
          background: !isCustom && range === f.key ? "#7C5CBF" : "#fff", color: !isCustom && range === f.key ? "#fff" : "#6B7280",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
        }}>{f.label}</button>
      ))}
      <span style={{ fontSize: 12, color: "#8A8A82", margin: "0 2px 0 8px", fontFamily: "Inter, sans-serif" }}>Custom:</span>
      <div style={{ position: "relative", display: "inline-block" }}>
        <button onClick={() => setCalOpen((v) => !v)} style={{
          padding: "7px 14px", borderRadius: 9, border: isCustom ? "1px solid #2E6BE0" : "1px solid #E4E4E8",
          background: isCustom ? "#2E6BE0" : "#fff", color: isCustom ? "#fff" : "#2E6BE0",
          fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
        }}>
          {fmtDmy(fromVal)} – {fmtDmy(toVal)}
        </button>
        {calOpen && (
          <RangeCalendar
            from={fromVal}
            to={toVal}
            maxDate={todayISO}
            onApply={(f, t) => {
              setFromVal(f);
              setToVal(t);
              setCustomRange({ from: f, to: t });
              setRange("custom");
            }}
            onClose={() => setCalOpen(false)}
          />
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <>
        {filterRow}
        <div style={{ padding: "40px 0", textAlign: "center", color: "#8A8A82", fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>
          Memuat data pesanan dari Shopee API…
        </div>
      </>
    );
  }

  if (error || (!exp && !data)) {
    return (
      <>
        {filterRow}
        <InfoNote>
          Data pesanan gagal dimuat dari server Shopee API. Pastikan backend proxy aktif, lalu muat ulang halaman. Detail error: {error}
        </InfoNote>
      </>
    );
  }

  // Data dari export summary (file Shopee): status_order & status_qty per label.
  // Kalau produk dipilih di dropdown → pakai sub-summary per produk (by_produk) supaya
  // card, resume, dan rincian ikut ke-filter cuma produk itu.
  const produkOpt = PRODUK_OPTIONS.find((p) => p.key === produk) || PRODUK_OPTIONS[0];
  const viewExp =
    produkOpt.group && exp && exp.by_produk && exp.by_produk[produkOpt.group]
      ? exp.by_produk[produkOpt.group]
      : exp;
  const so = (viewExp && viewExp.status_order) || {};
  const sq = (viewExp && viewExp.status_qty) || {};
  const custAll = viewExp ? (viewExp.customer_nonbatal || 0) : 0;
  const totalDist = viewExp ? (viewExp.total_order || 0) : 0;
  const displayDate = exp ? `Data ${exp.tanggal_data || "-"}` : displayLabel;
  const sts = (viewExp && viewExp.statuses) || (exp && exp.statuses) || [];
  const distOrder = [
    { label: "Perlu dikirim", value: so["Perlu dikirim"] || 0, color: "#E5484D" },
    { label: "Sedang dikirim", value: (so["Sedang dikirim"] || 0) + (so["Telah dikirim"] || 0), color: "#2E6BE0" },
    { label: "Selesai", value: so["Selesai"] || 0, color: "#1E9E6F" },
    { label: "Batal", value: so["Batal"] || 0, color: "#8A8A93" },
  ];
  const chartData = (daily && daily.length ? daily : []).map((x) => ({ d: x.date_label || x.d, total: x.total }));
  const manyBars = chartData.length > 14;
  const recentOrders = exp ? [] : (data.recent_orders || []); // tabel detail tetap kosong dari export summary
  // filter produk dari dropdown (SKU / nama) — export summary belum pecah per SKU
  const filteredOrders = recentOrders.filter((o) => produkMatch(o, produk));
  const fmtDate = (ts) => {
    if (!ts) return "-";
    const d = new Date(ts * 1000);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  };

  const csvFilename = `pesanan_${produk || "semua"}_${(customRange || {}).from || range}.csv`;
  const downloadCsvAction = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    try {
      // fetch lebih banyak (limit 500) supaya CSV berguna, bukan cuma 10 terakhir
      const qs = customRange
        ? `from=${customRange.from}&to=${customRange.to}&limit=500`
        : `range=${range}&limit=500`;
      const r = await fetch(`https://api.qukis.id/api/orders/recent?${qs}`);
      const d = await r.json();
      const orders = (d.orders || []).filter((o) => produkMatch(o, produk));
      const rows = [
        ["No. pesanan", "Tanggal", "Pembeli", "Produk", "SKU", "Qty", "Total", "Status"],
        ...orders.map((o) => {
          const it = (o.item_list && o.item_list[0]) || {};
          return [
            o.order_sn || "",
            o.create_time ? fmtDate(o.create_time) : "",
            ((o.recipient_address || {}).name) || "",
            it.item_name || "",
            it.item_sku || "",
            it.model_quantity_purchased || "",
            ((o.total_amount || {}).value) != null ? ((o.total_amount || {}).value) : "",
            STATUS_LABEL_FRONT[o.order_status] || o.order_status || "",
          ];
        }),
      ];
      downloadCsv(csvFilename, rows);
    } catch (e) {
      alert("Gagal download CSV: " + e);
    } finally {
      setCsvBusy(false);
    }
  };

  const produkLabel = (PRODUK_OPTIONS.find((p) => p.key === produk) || PRODUK_OPTIONS[0]).label;

  return (
    <>
      {filterRow}
      {exp && exp._range_warning && (
        <div style={{
          fontSize: 12, color: "#8A6A3B", background: "#FFF6E6", border: "1px solid #F5E3BE",
          borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
        }}>⚠️ {exp._range_warning}</div>
      )}
      {exp && exp._live_note && (
        <div style={{
          fontSize: 12, color: "#3B5E8A", background: "#EEF5FF", border: "1px solid #CFE2FA",
          borderRadius: 10, padding: "9px 12px", marginBottom: 14, fontFamily: "Inter, sans-serif", lineHeight: 1.5,
        }}>ℹ️ {exp._live_note} Angka di-refresh otomatis tiap 60 detik.</div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <select value={produk} onChange={(e) => setProduk(e.target.value)} style={{
          padding: "7px 12px", borderRadius: 9, border: "1px solid #E4E4E8", background: "#fff",
          fontSize: 12.5, fontWeight: 600, color: "#6B7280", cursor: "pointer", fontFamily: "Inter, sans-serif",
        }}>
          {PRODUK_OPTIONS.map((p) => (
            <option key={p.key || "all"} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button onClick={downloadCsvAction} disabled={csvBusy} style={{
          padding: "7px 16px", borderRadius: 9, border: "1px solid #1E9E6F", background: "#1E9E6F",
          color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: csvBusy ? "default" : "pointer", opacity: csvBusy ? 0.6 : 1,
          fontFamily: "Inter, sans-serif",
        }}>
          {csvBusy ? "Menyiapkan CSV…" : "⬇ Download CSV"}
        </button>
        <span style={{ fontSize: 12, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>{produkLabel} · {displayLabel}</span>
      </div>

      {/* Card status bisa dipilih (toggle) manual — Total = jumlah card yang AKTIF */}
      {(() => {
        const cards = [
          { key: "Perlu dikirim", label: "Perlu dikirim", value: so["Perlu dikirim"] || 0, accent: "#E5484D", icon: Package },
          { key: "Sedang dikirim", label: "Sedang dikirim", value: (so["Sedang dikirim"] || 0) + (so["Telah dikirim"] || 0), accent: "#2E6BE0", icon: Package },
          { key: "Selesai", label: "Selesai", value: so["Selesai"] || 0, accent: "#1E9E6F", icon: Package },
          { key: "Batal", label: "Batal", value: so["Batal"] || 0, accent: "#8A8A93", icon: Package },
        ];
        const toggleCard = (key) =>
          setActiveCards((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
          );
        const totalSelected = cards
          .filter((c) => activeCards.includes(c.key))
          .reduce((s, c) => s + c.value, 0);
        const anyActive = activeCards.length > 0;
        return (
          <>
            <div className="mp-grid5" style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 12, marginBottom: 18 }}>
              {cards.map((c) => (
                <StatCard
                  key={c.key}
                  icon={c.icon}
                  label={c.label}
                  value={String(c.value)}
                  accent={c.accent}
                  active={activeCards.includes(c.key)}
                  onClick={() => toggleCard(c.key)}
                />
              ))}
              <StatCard icon={Users2} label="Customer" value={String(custAll)} accent="#B8860B" />
              <StatCard icon={Package} label="Total" value={String(totalSelected)} accent="#17171A" />
            </div>
            <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif", marginBottom: 14 }}>
              Total mulai dari 0 — klik card status untuk menambahkan nilainya ke Total.
              {anyActive && (
                <span
                  onClick={() => setActiveCards([])}
                  style={{ marginLeft: 8, color: "#7C5CBF", cursor: "pointer", fontWeight: 600, textDecoration: "underline" }}
                >
                  Reset (0)
                </span>
              )}
            </div>
          </>
        );
      })()}

      {/* Resume pesanan: qty = jumlah (mentah) sesuai format ringkasan JMN */}
      {(() => {
        const resumeRows = [
          { label: "Perlu Dikirim", cust: so["Perlu dikirim"] || 0, qty: sq["Perlu dikirim"] || 0 },
          { label: "Sedang Dikirim", cust: so["Sedang dikirim"] || 0, qty: sq["Sedang dikirim"] || 0 },
          { label: "Selesai", cust: (so["Telah dikirim"] || 0) + (so["Selesai"] || 0), qty: (sq["Telah dikirim"] || 0) + (sq["Selesai"] || 0) },
          { label: "Batal", cust: so["Batal"] || 0, qty: sq["Batal"] || 0 },
        ];
        const sumCust = resumeRows.reduce((a, r) => a + r.cust, 0);
        const sumQty = resumeRows.reduce((a, r) => a + r.qty, 0);
        return (
          <Card title="Resume Pesanan" subtitle={`${displayDate}`}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "#8A8A82", fontSize: 11.5, borderBottom: "1px solid #E4E4E8" }}>
                  <th style={{ padding: "8px 0", fontWeight: 500 }}>Status</th>
                  <th style={{ padding: "8px 0", fontWeight: 500, textAlign: "right" }}>Customer</th>
                  <th style={{ padding: "8px 0", fontWeight: 500, textAlign: "right" }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {resumeRows.map((r) => (
                  <tr key={r.label} style={{ borderBottom: "1px solid #F1F1F4" }}>
                    <td style={{ padding: "9px 0", color: "#17171A" }}>{r.label}</td>
                    <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.cust}</td>
                    <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.qty}</td>
                  </tr>
                ))}
                <tr style={{ background: "#EFEFF2" }}>
                  <td style={{ padding: "10px 0", fontWeight: 700, color: "#17171A" }}>TOTAL</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{sumCust}</td>
                  <td style={{ padding: "10px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{sumQty}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        );
      })()}

      <div className="mp-grid2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card title={`Pesanan masuk — ${displayDate}`} subtitle="Export Shopee (Pesanan Saya) · bukan realtime">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
            <div><span style={{ fontSize: 11.5, color: "#8A8A82", display: "block", fontFamily: "Inter, sans-serif" }}>Total order</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{totalDist}</span></div>
            <div><span style={{ fontSize: 11.5, color: "#8A8A82", display: "block", fontFamily: "Inter, sans-serif" }}>Total qty (produk)</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{(viewExp && viewExp.total_qty) || 0}</span></div>
            <div><span style={{ fontSize: 11.5, color: "#8A8A82", display: "block", fontFamily: "Inter, sans-serif" }}>Qty non-batal</span><span style={{ fontSize: 20, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#1E9E6F" }}>{(viewExp && viewExp.total_qty_nonbatal) || 0}</span></div>
          </div>
        </Card>

        <Card title="Distribusi status" subtitle={`Total ${totalDist} pesanan`}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            {distOrder.map((s) => (
              <div key={s.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
                  <span style={{ color: "#4A4A45" }}>{s.label}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{s.value}</span>
                </div>
                <div style={{ background: "#F1F1F4", borderRadius: 4, height: 6, overflow: "hidden" }}>
                  <div style={{ width: `${totalDist > 0 ? (s.value / totalDist) * 100 : 0}%`, height: "100%", background: s.color, borderRadius: 4 }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {sts && sts.length > 0 && (
        <Card title="Rincian per Status & SKU" subtitle={`Customer = order unik · Qty = jumlah × bundling SKU · ${displayDate}`}>
          {sts.map((st) => (
            <div key={st.status} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700, color: "#17171A", fontFamily: "'Space Grotesk', sans-serif" }}>{st.status}</span>
                <span style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>
                  Customer <b style={{ fontFamily: "'JetBrains Mono', monospace", color: "#17171A" }}>{st.customer}</b>
                  {" · "}Qty <b style={{ fontFamily: "'JetBrains Mono', monospace", color: "#17171A" }}>{st.qty}</b>
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#8A8A82", fontSize: 11 }}>
                    <th style={{ padding: "5px 0", fontWeight: 500, width: 130 }}>SKU</th>
                    <th style={{ padding: "5px 0", fontWeight: 500 }}>Produk</th>
                    <th style={{ padding: "5px 0", fontWeight: 500, textAlign: "right", width: 90 }}>Customer</th>
                    <th style={{ padding: "5px 0", fontWeight: 500, textAlign: "right", width: 90 }}>Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {st.sku_rows.map((r) => (
                    <tr key={r.sku} style={{ borderTop: "1px solid #F1F1F4" }}>
                      <td style={{ padding: "7px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#6B7280" }}>{r.sku}</td>
                      <td style={{ padding: "7px 0", color: "#4A4A45" }}>{r.produk}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.customer}</td>
                      <td style={{ padding: "7px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{r.qty}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid #E4E4E8", background: "#EFEFF2" }}>
                    <td colSpan={2} style={{ padding: "7px 0", fontWeight: 700, color: "#17171A" }}>TOTAL {st.status.toUpperCase()}</td>
                    <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{st.customer}</td>
                    <td style={{ padding: "7px 0", textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{st.qty}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
        </Card>
      )}

      <Card title="Pesanan terbaru" subtitle={`${filteredOrders.length} transaksi · ${produkLabel} · ${displayLabel}`}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8A8A82", fontSize: 11.5 }}>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>No. pesanan</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Tanggal</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Pembeli</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Produk</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>SKU</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Qty</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Total</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((o) => (
              <tr key={o.order_sn} style={{ borderTop: "1px solid #F1F1F4" }}>
                <td style={{ padding: "9px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#4A4A45" }}>{o.order_sn}</td>
                <td style={{ padding: "9px 0", fontSize: 12, color: "#4A4A45" }}>{fmtDate(o.create_time)}</td>
                <td style={{ padding: "9px 0", color: "#17171A" }}>{o.buyer || "-"}</td>
                <td style={{ padding: "9px 0", color: "#4A4A45", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.produk ? shortProduk(o.produk) : "-"}</td>
                <td style={{ padding: "9px 0", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#6B7280" }}>{o.sku || "-"}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{o.qty || 0}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{o.total ? fmtRp(o.total) : "-"}</td>
                <td style={{ padding: "9px 0", textAlign: "right" }}>
                  <Badge text={o.status} color={statusColor[o.status]} />
                </td>
              </tr>
            ))}
            {filteredOrders.length === 0 && (
              <tr><td colSpan={8} style={{ padding: "14px 0", color: "#8A8A82", textAlign: "center" }}>Belum ada pesanan terbaru{produk ? ` untuk ${produkLabel}` : ""}.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function TabPenghasilan() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("https://api.qukis.id/api/income/summary?days=30")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setData(d);
        setError(null);
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", color: "#8A8A82", fontSize: 13.5, fontFamily: "Inter, sans-serif" }}>
        Memuat data penghasilan dari Shopee API…
      </div>
    );
  }

  if (error || !data) {
    return (
      <InfoNote>
        Data penghasilan gagal dimuat dari server Shopee API. Pastikan backend proxy aktif, lalu muat ulang halaman. Detail error: {error}
      </InfoNote>
    );
  }

  const daily = data.daily || [];
  const chartData = daily.map((x) => ({ date: x.date, v: x.total }));
  const totalPayout = data.total_payout || 0;
  const payoutCount = data.payout_count || 0;
  const n = daily.length;
  const avgPerDay = n > 0 ? Math.round(totalPayout / n) : 0;
  const last7 = daily.slice(-7).reduce((a, b) => a + b.total, 0);
  const prev7 = daily.slice(-14, -7).reduce((a, b) => a + b.total, 0);
  const pct = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : null;
  const up = pct !== null && pct >= 0;

  return (
    <>
      <div className="mp-grid2" style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 14, marginBottom: 14 }}>
        <Card title="Payout masuk — 30 hari" subtitle="Sumber: payment.get_escrow_list (uang bersih diterima)">
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 600 }}>{fmtRp(totalPayout)}</span>
            {pct !== null ? (
              <span style={{ fontSize: 12.5, color: up ? "#1E9E6F" : "#E5484D", fontWeight: 500 }}>
                {up ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}% dari 7 hari sebelumnya
              </span>
            ) : null}
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C5CBF" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#7C5CBF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A8A82" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "#8A8A82" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => fmtRpShort(v)} />
              <Tooltip formatter={(v) => fmtRp(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #ECECEF" }} />
              <Area type="monotone" dataKey="v" name="Payout" stroke="#7C5CBF" strokeWidth={2} fill="url(#incomeGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Saldo Shopee & pencairan">
          <div style={{ border: "1px dashed #E5C9BE", background: "#FAFAFB", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "#B0573A", fontWeight: 600, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
              Data tidak tersedia
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>
              Saldo Shopee, jadwal pencairan, dan tarik saldo tidak tersedia lewat API partner — hanya bisa diakses & ditarik manual di Seller Centre (Seller Centre → Keuangan).
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#8A8A82", fontFamily: "Inter, sans-serif" }}>
            Yang bisa ditampilkan di sini hanya payout yang sudah masuk (escrow release), bukan saldo mengambang.
          </div>
        </Card>
      </div>

      <div className="mp-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
        <StatCard icon={Wallet} label="Total payout 30 hari" value={fmtRpShort(totalPayout)} accent="#1E9E6F" />
        <StatCard icon={Wallet} label="Transaksi payout" value={String(payoutCount)} accent="#7C5CBF" />
        <StatCard icon={Wallet} label="Rata-rata per hari" value={fmtRpShort(avgPerDay)} accent="#2E6BE0" />
        <StatCard icon={Wallet} label="Hari dengan data" value={`${n} hari`} accent="#B8860B" />
      </div>

      <Card title="Rincian penghasilan">
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ border: "1px dashed #E5C9BE", background: "#FAFAFB", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, color: "#B0573A", fontWeight: 600, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>
              Data tidak tersedia
            </div>
            <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, fontFamily: "Inter, sans-serif" }}>
              Rincian komponen (pendapatan produk, ongkir, subsidi, biaya admin, biaya layanan, promo) tidak tersedia lewat API partner. Detail itu cuma bisa dilihat di Seller Centre → Laporan Keuangan / laporan penghasilan.
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "none", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
            <span style={{ color: "#4A4A45" }}>Total payout diterima (30 hari)</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#1E9E6F" }}>+{fmtRp(totalPayout)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0", marginTop: 4, borderTop: "1px solid #E5E4DD", fontSize: 13.5 }}>
            <span style={{ fontWeight: 600, color: "#17171A" }}>Pendapatan bersih (payout)</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: "#17171A" }}>{fmtRp(totalPayout)}</span>
          </div>
        </div>
      </Card>
    </>
  );
}

// ---------- Card KPI Ads (spec "Cron Iklan") ----------
// Setiap card punya ID unik → metric resmi Shopee (get_all_cpc_ads_daily_performance).
// Iklan Toko+ (Shop Ads) TIDAK punya endpoint publik terpisah di Open Platform, jadi
// SHOP_* dihitung backend sebagai ESTIMASI (total iklan dikurangi Iklan Produk — lihat
// _ads_shop_estimate_daily di backend/app.py), ditandai is_estimate:true di response API.
// SOV & Produk Terjual tetap TIDAK BISA diestimasi sama sekali (lihat _SHOP_UNAVAILABLE_METRICS
// di backend) → dua card ini selalu tampil "—", tidak pernah dikarang jadi angka.
const SHOP_UNAVAILABLE_METRICS = ["sov", "sold"];
const PRODUCT_CARDS = [
  { id: "PRODUCT_IMPRESSIONS", label: "Iklan Dilihat", metric: "impressions", icon: Eye, accent: "#D04C8F" },
  { id: "PRODUCT_CLICKS", label: "Jumlah Klik", metric: "clicks", icon: MousePointerClick, accent: "#875DBF" },
  { id: "PRODUCT_CTR", label: "Persentase Klik", metric: "ctr", icon: Percent, accent: "#50B0E0" },
  { id: "PRODUCT_ORDERS", label: "Pesanan", metric: "orders", icon: ShoppingCart, accent: "#F09040" },
  { id: "PRODUCT_SOLD", label: "Produk Terjual", metric: "sold", icon: Boxes, accent: "#1E9E6F" },
  { id: "PRODUCT_SALES", label: "Penjualan", metric: "sales", icon: Banknote, accent: "#2E6BE0" },
  { id: "PRODUCT_AD_SPEND", label: "Biaya Iklan", metric: "ad_spend", icon: Wallet, accent: "#B8860B" },
  { id: "PRODUCT_ROAS", label: "ROAS", metric: "roas", icon: TrendingUp, accent: "#6366F1" },
];
const SHOP_CARDS = [
  { id: "SHOP_SOV", label: "SOV", metric: "sov", icon: Percent, accent: "#7C5CBF" },
  { id: "SHOP_IMPRESSIONS", label: "Iklan Dilihat", metric: "impressions", icon: Eye, accent: "#D04C8F" },
  { id: "SHOP_CLICKS", label: "Jumlah Klik", metric: "clicks", icon: MousePointerClick, accent: "#875DBF" },
  { id: "SHOP_CTR", label: "Persentase Klik", metric: "ctr", icon: Percent, accent: "#50B0E0" },
  { id: "SHOP_ORDERS", label: "Pesanan", metric: "orders", icon: ShoppingCart, accent: "#F09040" },
  { id: "SHOP_SOLD", label: "Produk Terjual", metric: "sold", icon: Boxes, accent: "#1E9E6F" },
  { id: "SHOP_SALES", label: "Penjualan", metric: "sales", icon: Banknote, accent: "#2E6BE0" },
  { id: "SHOP_AD_SPEND", label: "Biaya Iklan", metric: "ad_spend", icon: Wallet, accent: "#B8860B" },
];

function TabAds() {
  const [adTab, setAdTabState] = useState(() => {
    try { return localStorage.getItem("mp_adtab") === "shop" ? "shop" : "product"; } catch { return "product"; }
  });
  const setAdTab = (k) => {
    setAdTabState(k);
    try { localStorage.setItem("mp_adtab", k); } catch { /* ignore */ }
  };
  // Range preset persist; custom tidak di-persist (fallback hari ini biar aman)
  const storedR = (() => {
    try {
      const r = localStorage.getItem("mp_adsrange");
      return RANGE_PRESETS[r] ? r : "today";
    } catch { return "today"; }
  })();
  const R_OFFSET = { today: 0, yesterday: 1, "7d": 6, month: 29, year: 364 };
  const [range, setRangeState] = useState(storedR);
  const setRange = (k) => {
    setRangeState(k);
    if (k !== "custom") {
      try { localStorage.setItem("mp_adsrange", k); } catch { /* ignore */ }
    }
  };
  const [customRange, setCustomRange] = useState(null); // {from, to} 'YYYY-MM-DD' (tidak persist)
  const [fromVal, setFromVal] = useState(isoDaysAgo(R_OFFSET[storedR] != null ? R_OFFSET[storedR] : 0));
  const [toVal, setToVal] = useState(isoDaysAgo(0));
  const [calOpen, setCalOpen] = useState(false);
  const [metrics, setMetrics] = useState({}); // cardId → response metric
  const [series, setSeries] = useState(null);
  const [seriesMetric, setSeriesMetric] = useState("sales");
  const [busy, setBusy] = useState(true);
  const [lastErr, setLastErr] = useState(null);
  const [rt, setRt] = useState(null); // data realtime: saldo iklan + jam terakhir

  const PRESET_DATES = RANGE_PRESETS;
  const clickPreset = (key) => {
    setCalOpen(false);
    setCustomRange(null);
    setRange(key);
    const pd = PRESET_DATES[key];
    if (pd) {
      const { from, to } = pd();
      setFromVal(from);
      setToVal(to);
    }
  };

  const FILTERS = RANGE_FILTERS;
  const isCustom = !!customRange;
  const todayISO = isoDaysAgo(0);
  const dRange = customRange || PRESET_DATES[range]();
  const displayLabel = isCustom
    ? `${customRange.from.slice(8, 10)}/${customRange.from.slice(5, 7)} – ${customRange.to.slice(8, 10)}/${customRange.to.slice(5, 7)}`
    : ((RANGE_FILTERS.find((f) => f.key === range) || {}).label || range);
  const cards = adTab === "shop" ? SHOP_CARDS : PRODUCT_CARDS;
  // Rentang 1 hari → chart pakai data PER JAM (realtime dari Shopee Ads API).
  // Rentang >1 hari → chart harian.
  const isSingleDay = dRange.from === dRange.to;
  const seriesInterval = isSingleDay ? "hour" : "day";
  const metricLabel = (m) => (PRODUCT_CARDS.find((c) => c.metric === m) || {}).label || m;

  const fmtSeriesVal = (m, v) => {
    if (m === "sales" || m === "ad_spend") return fmtRp(v);
    return Number(v).toLocaleString("id-ID");
  };

  // Realtime load: hanya card yang aktif; request per-card ke backend (cache 30 detik).
  // Sumber tab "product": get_all_cpc_ads_daily_performance (sama dgn "Iklan Produk" Seller Centre).
  // Sumber tab "shop": ESTIMASI backend (total iklan dikurangi Iklan Produk) — respons
  // API selalu bawa is_estimate:true di sini, dipakai untuk badge "EST" di card & chart.
  // SHOP_SOV & SHOP_SOLD tetap balik METRIC_NOT_AVAILABLE (gak bisa diestimasi sama sekali),
  // ditampilkan "—", bukan dikarang jadi angka.
  const loadData = (active) => {
    setBusy(true);
    const base = `https://api.qukis.id/api/ads/metric?tab=${adTab}&start_date=${dRange.from}&end_date=${dRange.to}&timezone=Asia/Jakarta`;
    Promise.all(
      cards.map((c) =>
        fetch(`${base}&card=${c.id}`)
          .then((r) => r.json())
          .catch(() => ({ success: false, error: "NETWORK_ERROR" }))
          .then((res) => [c.id, res])
      )
    ).then((entries) => {
      if (!active) return;
      const obj = Object.fromEntries(entries);
      setMetrics(obj);
      const bad = cards.map((c) => obj[c.id]).find((m) => m && !m.success);
      setLastErr(bad ? bad.error || "ERROR" : null);
      setBusy(false);
    });
    // Iklan Toko+ (shop) tidak punya versi per-jam → selalu harian.
    // Iklan Produk: per jam kalau rentang 1 hari, harian kalau lebih.
    const seriesIntervalForTab = adTab === "shop" ? "day" : seriesInterval;
    fetch(`https://api.qukis.id/api/ads/series?metric=${seriesMetric}&interval=${seriesIntervalForTab}&tab=${adTab}&start_date=${dRange.from}&end_date=${dRange.to}`)
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d && d.success) setSeries(d.points || []);
        else setSeries([]); // metrik gak valid utk tab ini (mis. SOV/sold di shop) → jangan nampilin chart tab sebelumnya
      })
      .catch(() => {});
    // Freshness: saldo iklan + jam terakhir yang ada datanya (endpoint realtime, cache 30s).
    fetch("https://api.qukis.id/api/ads/realtime")
      .then((r) => r.json())
      .then((d) => {
        if (active && d && !d.error) setRt(d);
      })
      .catch(() => {});
  };

  // Fetch saat: buka tab, ganti sub-tab, ganti tanggal, ganti metrik chart.
  // Auto refresh 30 detik (REALTIME_REFRESH_INTERVAL).
  useEffect(() => {
    let active = true;
    loadData(active);
    const iv = setInterval(() => loadData(active), 30000);
    return () => {
      active = false;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adTab, range, customRange, seriesMetric]);

  return (
    <>
      {/* Sub-tab: Iklan Produk | Iklan Toko+ */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {[{ key: "product", label: "Iklan Produk" }, { key: "shop", label: "Iklan Toko+" }].map((t) => {
          const on = adTab === t.key;
          return (
            <button key={t.key} onClick={() => setAdTab(t.key)} style={{
              padding: "8px 18px", borderRadius: 10, border: "none", cursor: "pointer",
              background: on ? "linear-gradient(135deg,#7C5CBF,#5B7CFA)" : "#fff",
              color: on ? "#fff" : "#5F6368", fontSize: 13, fontWeight: 600,
              fontFamily: "Inter, sans-serif", boxShadow: on ? "0 4px 12px rgba(124,92,191,.35)" : "0 1px 2px rgba(0,0,0,.05)",
              border: on ? "none" : "1px solid #E4E4E8",
            }}>{t.label}</button>
          );
        })}
      </div>

      {/* Filter tanggal — preset + custom kalender */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => clickPreset(f.key)} style={{
            padding: "7px 16px", borderRadius: 9, border: !isCustom && range === f.key ? "1px solid #7C5CBF" : "1px solid #E4E4E8",
            background: !isCustom && range === f.key ? "#7C5CBF" : "#fff", color: !isCustom && range === f.key ? "#fff" : "#6B7280",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif",
          }}>{f.label}</button>
        ))}
        <span style={{ fontSize: 12, color: "#8A8A82", margin: "0 2px 0 8px", fontFamily: "Inter, sans-serif" }}>Custom:</span>
        <div style={{ position: "relative", display: "inline-block" }}>
          <button onClick={() => setCalOpen((v) => !v)} style={{
            padding: "7px 14px", borderRadius: 9, border: isCustom ? "1px solid #2E6BE0" : "1px solid #E4E4E8",
            background: isCustom ? "#2E6BE0" : "#fff", color: isCustom ? "#fff" : "#2E6BE0",
            fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace",
          }}>
            {fmtDmy(fromVal)} – {fmtDmy(toVal)}
          </button>
          {calOpen && (
            <RangeCalendar
              from={fromVal}
              to={toVal}
              maxDate={todayISO}
              onApply={(f, t) => {
                setFromVal(f);
                setToVal(t);
                setCustomRange({ from: f, to: t });
                setRange("custom");
              }}
              onClose={() => setCalOpen(false)}
            />
          )}
        </div>
        <span style={{ fontSize: 12, color: "#8A8A82", marginLeft: 8, fontFamily: "Inter, sans-serif" }}>
          {displayLabel} · auto refresh 30 detik
        </span>
      </div>

      {adTab === "shop" && (
        <InfoNote>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <Badge text="ESTIMASI" color="#B8860B" />
            <span style={{ fontWeight: 600 }}>Angka Iklan Toko+ di bawah ini estimasi, bukan data resmi Shopee.</span>
          </div>
          Shopee Open Platform tidak punya endpoint Shop Ads terpisah — dihitung dari selisih
          total iklan dikurangi Iklan Produk. SOV dan Produk Terjual tetap tidak bisa dihitung
          sama sekali (card tampil "—"), bukan dikarang jadi nol.
        </InfoNote>
      )}
      {lastErr && lastErr !== "METRIC_NOT_AVAILABLE" && (
        <InfoNote>
          ⚠️ Status: {lastErr} — angka nggak diganti data palsu. Coba refresh / cek koneksi backend.
        </InfoNote>
      )}
      {lastErr === "METRIC_NOT_AVAILABLE" && (
        <div style={{ fontSize: 11.5, color: "#8A8A82", fontFamily: "Inter, sans-serif", marginBottom: 12 }}>
          Catatan: Produk Terjual & SOV tidak disediakan API Shopee sama sekali (walau dihitung
          selisih) — card terkait tampil "—", bukan data palsu.
        </div>
      )}

      {/* Grid card KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {cards.map((c) => {
          const Icon = c.icon;
          const m = metrics[c.id];
          const ok = m && m.success;
          const isEstimate = adTab === "shop" && ok && m.is_estimate;
          const clickable = !(adTab === "shop" && SHOP_UNAVAILABLE_METRICS.includes(c.metric));
          return (
            <div
              key={c.id}
              onClick={() => clickable && setSeriesMetric(c.metric)}
              title={clickable ? "Klik untuk lihat tren harian metrik ini" : "Metrik ini tidak tersedia untuk Iklan Toko+"}
              style={{
                background: `linear-gradient(135deg, ${c.accent} 0%, ${lightenHex(c.accent)} 100%)`,
                borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10,
                minWidth: 0, boxShadow: `0 8px 20px ${c.accent}30`,
                border: "1px solid rgba(255,255,255,0.18)",
                cursor: clickable ? "pointer" : "default",
                opacity: busy ? 0.75 : 1, transition: "opacity .2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.9)", fontFamily: "Inter, sans-serif" }}>{c.label}</span>
                  {isEstimate && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.28)",
                      padding: "2px 5px", borderRadius: 5, letterSpacing: 0.4, fontFamily: "Inter, sans-serif", flexShrink: 0,
                    }} title="Estimasi: total iklan dikurangi Iklan Produk">EST</span>
                  )}
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  border: "1px solid rgba(255,255,255,0.25)",
                }}>
                  <Icon size={16} color="#fff" strokeWidth={2.2} />
                </div>
              </div>
              <div style={{
                fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: "#fff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {busy ? "…" : ok ? m.formatted_value : "—"}
              </div>
              <div style={{ fontSize: 11, fontFamily: "Inter, sans-serif", color: ok ? "rgba(255,255,255,0.8)" : "#FFE0E0" }}>
                {ok
                  ? (m.updated_at ? `Update ${m.updated_at.slice(11, 16)} WIB` : "Realtime")
                  : (m && m.error ? m.error : "Gagal dimuat")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart time-series — per jam kalau rentang 1 hari (Iklan Produk); Iklan Toko+ selalu harian */}
      {(adTab === "product" || adTab === "shop") && (
        <Card
          title={`Tren ${adTab === "product" && isSingleDay ? "per jam" : "harian"} — ${metricLabel(seriesMetric)}${adTab === "shop" && !SHOP_UNAVAILABLE_METRICS.includes(seriesMetric) ? " (estimasi)" : ""}`}
          subtitle={`Klik salah satu card di atas untuk ganti metrik · ${displayLabel}${rt && rt.latest_hour != null ? ` · data s.d. ${String(rt.latest_hour).padStart(2, "0")}:00 WIB · saldo iklan ${fmtRp(rt.balance)}` : ""}`}
        >
          {series && series.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={series.map((p) => ({ ...p, lbl: p.date ? `${p.date.slice(8, 10)}/${p.date.slice(5, 7)}` : p.time }))}>
                <defs>
                  <linearGradient id="adsSeriesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C5CBF" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#7C5CBF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="lbl" tick={{ fontSize: 10.5, fill: "#8A8A82" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10.5, fill: "#8A8A82" }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => fmtSeriesVal(seriesMetric, v)} />
                <Tooltip
                  formatter={(v) => [fmtSeriesVal(seriesMetric, v), metricLabel(seriesMetric)]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #ECECEF" }}
                />
                <Area type="monotone" dataKey="value" stroke="#7C5CBF" strokeWidth={2.2} fill="url(#adsSeriesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <InfoNote>Data series belum tersedia untuk rentang ini.</InfoNote>
          )}
        </Card>
      )}
    </>
  );
}

function TabAffiliate() {
  return (
    <>
      <InfoNote>
        Data tidak tersedia — data affiliate berasal dari program terpisah (Shopee Affiliate / Program Terbuka Kreator), bukan Open Platform standar. Perlu akses API tersendiri untuk data klik dan komisi; akses tersebut belum tersedia untuk aplikasi ini.
      </InfoNote>
      {false && (<>
      <div className="mp-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard icon={Users2} label="Affiliate aktif" value="37" delta="+4 bulan ini" accent="#7C5CBF" />
        <StatCard icon={Package} label="Pesanan dari affiliate" value="591" delta="+22% MoM" accent="#2E6BE0" />
        <StatCard icon={ArrowUpRight} label="Klik link affiliate" value="10.4rb" delta="+8.9% MoM" accent="#B8860B" />
        <StatCard icon={Wallet} label="Total komisi dibayar" value={fmtRpShort(11_760_000)} accent="#1E9E6F" />
      </div>

      <Card title="Papan peringkat affiliate" subtitle="Berdasarkan komisi bulan ini">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: "Inter, sans-serif" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8A8A82", fontSize: 11.5 }}>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>#</th>
              <th style={{ paddingBottom: 8, fontWeight: 500 }}>Kreator</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Pengikut</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Klik</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Pesanan</th>
              <th style={{ paddingBottom: 8, fontWeight: 500, textAlign: "right" }}>Komisi</th>
            </tr>
          </thead>
          <tbody>
            {affiliates.map((a) => (
              <tr key={a.name} style={{ borderTop: "1px solid #F1F1F4" }}>
                <td style={{ padding: "9px 0", color: "#8A8A82", fontFamily: "'JetBrains Mono', monospace" }}>{a.rank}</td>
                <td style={{ padding: "9px 0", color: "#17171A", fontWeight: 500 }}>{a.name}</td>
                <td style={{ padding: "9px 0", textAlign: "right", color: "#4A4A45" }}>{a.followers}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{a.klik.toLocaleString("id-ID")}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>{a.order}</td>
                <td style={{ padding: "9px 0", textAlign: "right", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{fmtRp(a.komisi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      </>)}
    </>
  );
}

function TabLive() {
  return (
    <>
      <InfoNote>
        Data tidak tersedia — metrik sesi Live umumnya hanya tersedia lewat Shopee Live Creator Center, bukan endpoint publik Open Platform. Akses data tersebut belum diberikan untuk aplikasi ini.
      </InfoNote>

      {false && (<>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#17171A", borderRadius: 14, padding: "14px 20px", marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ position: "relative", width: 9, height: 9 }}>
            <span style={{
              position: "absolute", inset: 0, borderRadius: "50%", background: "#E5484D",
            }} />
          </span>
          <span style={{ color: "#fff", fontSize: 13.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>Sesi live sedang berlangsung</span>
          <span style={{ color: "#B8B8B0", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>· 1.240 penonton · 00:38:12</span>
        </div>
        <ChevronRight size={16} color="#B8B8B0" />
      </div>

      <div className="mp-grid4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 18 }}>
        <StatCard icon={Radio} label="Sesi live bulan ini" value="14" accent="#7C5CBF" />
        <StatCard icon={Users2} label="Total penonton" value="48.2rb" delta="+31% MoM" accent="#2E6BE0" />
        <StatCard icon={Wallet} label="GMV dari live" value={fmtRpShort(39_100_000)} delta="+18% MoM" accent="#1E9E6F" />
        <StatCard icon={Package} label="Produk terjual saat live" value="530" accent="#B8860B" />
      </div>

      <div className="mp-grid2" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
        <Card title="GMV per sesi — 7 hari terakhir" subtitle="Nilai dalam juta rupiah">
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={liveSessions} barSize={26}>
              <CartesianGrid vertical={false} stroke="#F1F1F4" />
              <XAxis dataKey="d" tick={{ fontSize: 11.5, fill: "#8A8A82" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#8A8A82" }} axisLine={false} tickLine={false} width={28} />
              <Tooltip formatter={(v) => fmtRp(v * 1_000_000)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #ECECEF" }} />
              <Bar dataKey="gmv" radius={[5, 5, 0, 0]}>
                {liveSessions.map((_, i) => <Cell key={i} fill="#7C5CBF" />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Produk terlaris saat live">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {liveTopProducts.map((p) => (
              <div key={p.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontFamily: "Inter, sans-serif" }}>
                <div>
                  <div style={{ color: "#17171A", fontWeight: 500 }}>{p.name}</div>
                  <div style={{ color: "#8A8A82", fontSize: 11.5, marginTop: 2 }}>{p.qty} terjual</div>
                </div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: "#17171A" }}>{fmtRpShort(p.gmv)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      </>)}
    </>
  );
}

// ---------- shell ----------

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
  pesanan: ["Pesanan", "Pantau status dan riwayat pesanan tokomu"],
  penghasilan: ["Penghasilan", "Rincian pendapatan dan saldo yang bisa ditarik"],
  ads: ["Ads", "Performa kampanye iklan tokomu"],
  affiliate: ["Affiliate", "Kinerja kreator yang mempromosikan produkmu"],
  live: ["Live", "Statistik penjualan dari siaran langsung"],
};

export default function ShopeePartnerDashboard() {
  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem("mp_tab");
      return saved && TITLES[saved] ? saved : "overview";
    } catch {
      return "overview";
    }
  });
  const [collapsed, setCollapsed] = useState(false);
  const [title, subtitle] = TITLES[tab];
  const changeTab = (key) => {
    setTab(key);
    try { localStorage.setItem("mp_tab", key); } catch { /* ignore */ }
  };

  return (
    <div className="mp-root" style={{
      fontFamily: "Inter, sans-serif", background: "#FFFFFF", minHeight: "100vh",
      display: "flex", flexDirection: "row",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');
        @media (max-width: 768px) {
          .mp-root { flex-direction: column !important; min-height: 100vh !important; border-radius: 0 !important; border: none !important; }
          .mp-sidebar {
            width: 100% !important; max-width: none !important; height: auto !important;
            flex-direction: row !important; align-items: center !important;
            padding: 8px 10px !important; border-right: none !important;
            border-bottom: 1px solid #2E2C33 !important; overflow-x: auto !important;
          }
          .mp-sb-brand { border-bottom: none !important; margin: 0 10px 0 0 !important; padding: 0 10px 0 2px !important; border-right: 1px solid #2E2C33 !important; }
          .mp-sb-brand-text { display: none !important; }
          .mp-menu { flex-direction: row !important; gap: 4px !important; width: max-content !important; }
          .mp-menu button { padding: 8px 10px !important; white-space: nowrap !important; }
          .mp-toggle { display: none !important; }
          .mp-statusbox { display: none !important; }
          .mp-body { flex-direction: column !important; height: auto !important; }
          .mp-main { height: auto !important; }
          .mp-content { overflow: visible !important; }
          .mp-topbar { padding: 12px 14px !important; }
          .mp-topbar-hide { display: none !important; }
          .mp-content { padding: 14px !important; }
          .mp-grid4 { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; margin-bottom: 12px !important; }
          .mp-grid2 { grid-template-columns: 1fr !important; gap: 10px !important; }
          .mp-card { padding: 14px !important; }
          .mp-root table { display: block !important; overflow-x: auto !important; white-space: nowrap !important; }
        }
        @media (max-width: 420px) {
          .mp-grid4 { gap: 8px !important; }
        }
      `}</style>

      {/* body: sidebar full-height (kiri) + main (topbar + konten) */}
      <div className="mp-body" style={{ display: "flex", flex: 1, minHeight: 0, width: "100%" }}>
        {/* sidebar — hitam netral full height, brand di sidebar (pola referensi Fusion) */}
        <div className="mp-sidebar" style={{ width: collapsed ? 64 : 218, background: "#211F22", padding: collapsed ? "14px 8px" : "16px 14px", display: "flex", flexDirection: "column", flexShrink: 0, borderRight: "1px solid #2E2C33", transition: "width .2s ease, padding .2s ease", overflowY: "auto" }}>
          {/* brand */}
          <div className="mp-sb-brand" style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 14, marginBottom: 10, borderBottom: "1px solid #2E2C33" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#7C5CBF,#5B7CFA)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Store size={18} color="#fff" strokeWidth={2.3} />
            </div>
            {!collapsed && (
              <div className="mp-sb-brand-text" style={{ minWidth: 0 }}>
                <div style={{ color: "#fff", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, whiteSpace: "nowrap" }}>MP — Marketplace</div>
                <div style={{ color: "#8E9199", fontSize: 11, whiteSpace: "nowrap", marginTop: 1 }}>Generos Official Store</div>
              </div>
            )}
          </div>

          <button className="mp-toggle" onClick={() => setCollapsed(!collapsed)} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} style={{
            display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-end",
            padding: "8px", borderRadius: 9, border: "none", cursor: "pointer", background: "transparent",
            color: "#8E9199", marginBottom: 8,
          }}>
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
          <div className="mp-menu" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MENU.map((m) => {
              const active = tab === m.key;
              const Icon = m.icon;
              return (
                <button key={m.key} onClick={() => changeTab(m.key)} title={m.label} style={{
                  display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start", gap: 10, padding: "10px 12px",
                  borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left",
                  background: active ? "rgba(124,92,191,0.22)" : "transparent",
                }}>
                  <Icon size={16} color={active ? "#CBA9F5" : "#8E9199"} strokeWidth={2.2} />
                  {!collapsed && (
                    <span style={{
                      fontSize: 13.5, color: active ? "#fff" : "#B7BAC2", fontWeight: active ? 600 : 500,
                      fontFamily: "Inter, sans-serif",
                    }}>{m.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {!collapsed && (
            <div className="mp-statusbox" style={{ marginTop: "auto", padding: "13px 14px", borderRadius: 12, background: "linear-gradient(160deg,#B766B0,#875DBF)" }}>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 3 }}>Status toko</div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 700 }}>Mall</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)", marginTop: 1 }}>Generos Official Store</div>
            </div>
          )}
        </div>

        {/* main */}
        <div className="mp-main" style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh" }}>
          {/* top bar putih (header konten, bukan gradient) */}
          <div className="mp-topbar" style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 26px", background: "#fff", borderBottom: "1px solid #ECEEF3", flexShrink: 0,
          }}>
            <div>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: "#17171A" }}>{title}</div>
              <div style={{ fontSize: 12.5, color: "#8A8A82", marginTop: 1 }}>{subtitle}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Search size={17} color="#5F6368" />
              <Bell size={17} color="#5F6368" />
              <span className="mp-topbar-hide" style={{
                fontSize: 12, color: "#5F6368", background: "#F1F3F5", padding: "6px 12px",
                borderRadius: 8, fontFamily: "'JetBrains Mono', monospace",
              }}>{new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</span>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#7C5CBF,#5B7CFA)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff" }}>G</div>
            </div>
          </div>

          <div className="mp-content" style={{ flex: 1, minHeight: 0, padding: "22px 26px", overflowY: "auto", background: "#F7F8FB" }}>
            {tab === "overview" && <TabOverview />}
            {tab === "pesanan" && <TabPesanan />}
            {tab === "penghasilan" && <TabPenghasilan />}
            {tab === "ads" && <TabAds />}
            {tab === "affiliate" && <TabAffiliate />}
            {tab === "live" && <TabLive />}
          </div>
        </div>
      </div>
    </div>
  );
}